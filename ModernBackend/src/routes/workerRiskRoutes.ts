import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, checkRole } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimitMiddleware";
import { buildWorkerScopeWhere } from "../services/queryGuard";
import {
  calculateAndStoreWorkerRisk,
  getWorkerRiskScore,
  calculateAllWorkerRisks,
  getRiskDashboardSummary,
} from "../controllers/workerRiskController";

const router = Router();

/**
 * POST /Api/Risk/Calculate/:workerId
 * Calculate and store risk score for one worker
 * Admin, Agency, Employer (own workers only)
 */
router.post(
  "/Api/Risk/Calculate/:workerId",
  requireAuth,
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const roleId = Number(user?.roleId ?? 0);
      const userId = (user?.userId ?? "").toString();
      const workerId = String(req.params.workerId);

      // Verify worker exists and user has access
      const worker = await prisma.tbl_Worker_PersonalInfo.findUnique({
        where: { Worker_Id: workerId },
        select: { Employer_Id: true },
      });

      if (!worker) {
        return res.status(404).json({ error: "Worker not found" });
      }

      // Access control
      if (roleId === 3) {
        // Employer - check ownership
        const employer = await prisma.tbl_Employer.findFirst({
          where: { User_Id: userId },
          select: { Employer_Name: true },
        });
        if (!employer?.Employer_Name) {
          return res.status(403).json({ error: "Employer not found" });
        }
        // Check if worker belongs to this employer
        const workerEmployer = await prisma.tbl_Worker_EmployerInfo.findFirst({
          where: { Worker_Id: workerId, Employer_Name: employer.Employer_Name },
        });
        if (!workerEmployer) {
          return res.status(403).json({ error: "Worker not in your scope" });
        }
      } else if (roleId === 2) {
        // Agency - check if worker is linked to agency
        const agent = await prisma.tbl_Agent.findFirst({
          where: { User_Id: userId },
          select: { Agent_Name: true },
        });
        if (!agent?.Agent_Name) {
          return res.status(403).json({ error: "Agency not found" });
        }
        const linked = await prisma.tbl_Worker_RecruitAgent.findFirst({
          where: { Worker_Id: workerId, Malaysian_Reqruitment_Agency: agent.Agent_Name },
        });
        if (!linked) {
          return res.status(403).json({ error: "Worker not in your scope" });
        }
      } else if (roleId !== 1) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await calculateAndStoreWorkerRisk(workerId);
      if (!result) {
        return res.status(500).json({ error: "Failed to calculate risk" });
      }

      return res.json({
        success: true,
        workerId: result.workerId,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        breakdown: {
          docScore: result.breakdown.docScore,
          disputeScore: result.breakdown.disputeScore,
          complianceScore: result.breakdown.complianceScore,
          details: result.breakdown.details,
        },
        aiSummary: result.aiSummary,
        calculatedAt: result.calculatedAt,
      });
    } catch (e) {
      return next(e);
    }
  }
);

/**
 * POST /Api/Risk/CalculateAll
 * Calculate risk for all workers (Admin only) - AI rate limited
 */
router.post(
  "/Api/Risk/CalculateAll",
  requireAuth,
  aiRateLimiter,
  checkRole([1]), // Admin only
  async (req, res, next) => {
    try {
      const result = await calculateAllWorkerRisks();
      return res.json({
        success: true,
        ...result,
      });
    } catch (e) {
      return next(e);
    }
  }
);

/**
 * GET /Api/Risk/Score/:workerId
 * Get latest risk score for a worker
 */
router.get(
  "/Api/Risk/Score/:workerId",
  requireAuth,
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const roleId = Number(user?.roleId ?? 0);
      const userId = (user?.userId ?? "").toString();
      const workerId = String(req.params.workerId);

      // Access control
      if (roleId === 3) {
        const employer = await prisma.tbl_Employer.findFirst({
          where: { User_Id: userId },
          select: { Employer_Name: true },
        });
        if (!employer?.Employer_Name) {
          return res.status(403).json({ error: "Employer not found" });
        }
        const workerEmployer = await prisma.tbl_Worker_EmployerInfo.findFirst({
          where: { Worker_Id: workerId, Employer_Name: employer.Employer_Name },
        });
        if (!workerEmployer) {
          return res.status(403).json({ error: "Worker not in your scope" });
        }
      } else if (roleId === 2) {
        const agent = await prisma.tbl_Agent.findFirst({
          where: { User_Id: userId },
          select: { Agent_Name: true },
        });
        if (!agent?.Agent_Name) {
          return res.status(403).json({ error: "Agency not found" });
        }
        const linked = await prisma.tbl_Worker_RecruitAgent.findFirst({
          where: { Worker_Id: workerId, Malaysian_Reqruitment_Agency: agent.Agent_Name },
        });
        if (!linked) {
          return res.status(403).json({ error: "Worker not in your scope" });
        }
      } else if (roleId !== 1) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await getWorkerRiskScore(workerId);
      if (!result) {
        return res.status(404).json({ error: "No risk score found. Run Calculate first." });
      }

      return res.json({
        workerId: result.workerId,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        breakdown: {
          docScore: result.breakdown.docScore,
          disputeScore: result.breakdown.disputeScore,
          complianceScore: result.breakdown.complianceScore,
          details: result.breakdown.details,
        },
        aiSummary: result.aiSummary,
        calculatedAt: result.calculatedAt,
      });
    } catch (e) {
      return next(e);
    }
  }
);

/**
 * GET /Api/Risk/Dashboard
 * Get risk dashboard summary
 * Admin + Agency
 */
router.get(
  "/Api/Risk/Dashboard",
  requireAuth,
  checkRole([1, 2]),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const roleId = Number(user?.roleId ?? 0);
      const userId = (user?.userId ?? "").toString();

      let agencyId: string | undefined;
      if (roleId === 2) {
        const agent = await prisma.tbl_Agent.findFirst({
          where: { User_Id: userId },
          select: { Agent_Name: true },
        });
        agencyId = agent?.Agent_Name;
      }

      const summary = await getRiskDashboardSummary(agencyId);
      return res.json(summary);
    } catch (e) {
      return next(e);
    }
  }
);

export { router as workerRiskRouter };
