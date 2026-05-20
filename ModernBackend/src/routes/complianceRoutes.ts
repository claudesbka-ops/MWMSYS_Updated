import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, checkRole, requireAuthority } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimitMiddleware";
import {
  runComplianceScan,
  getAlerts,
  getEmployerScores,
  resolveAlert,
  getDashboardSummary,
} from "../controllers/complianceController";

const router = Router();

/**
 * Build worker scope based on user role
 * - Admin (role 1): All workers
 * - Agency: Workers linked to their agency
 * - Employer: Workers linked to them
 */
async function buildWorkerScopeWhere(user: any): Promise<any> {
  const roleId = Number(user?.roleId ?? 0);
  const userId = (user?.userId ?? "").toString();

  // Admin - sees all
  if (roleId === 1) {
    return {};
  }

  // Agency - sees workers linked to their agency
  if (roleId === 2) {
    const agent = await prisma.tbl_Agent.findFirst({
      where: { User_Id: userId },
      select: { Agent_Name: true },
    });
    const agentName = agent?.Agent_Name;
    if (!agentName) return { Worker_Id: "__NO_ACCESS__" };

    const linkedWorkers = await prisma.tbl_Worker_RecruitAgent.findMany({
      where: { Malaysian_Reqruitment_Agency: agentName },
      select: { Worker_Id: true },
    });
    const workerIds = linkedWorkers.map((w) => w.Worker_Id).filter(Boolean);
    if (workerIds.length === 0) return { Worker_Id: "__NO_ACCESS__" };
    return { Worker_Id: { in: workerIds } };
  }

  // Employer - sees their workers
  if (roleId === 3) {
    const employer = await prisma.tbl_Employer.findFirst({
      where: { User_Id: userId },
      select: { Employer_Name: true },
    });
    if (!employer?.Employer_Name) return { Worker_Id: "__NO_ACCESS__" };

    const workers = await prisma.tbl_Worker_EmployerInfo.findMany({
      where: { Employer_Name: employer.Employer_Name },
      select: { Worker_Id: true },
    });
    const workerIds = workers.map((w) => w.Worker_Id).filter(Boolean);
    if (workerIds.length === 0) return { Worker_Id: "__NO_ACCESS__" };
    return { Worker_Id: { in: workerIds } };
  }

  // Other roles - no access
  return { Worker_Id: "__NO_ACCESS__" };
}

/**
 * POST /Api/Compliance/Scan
 * Trigger full compliance scan (Admin + Agency only) - AI rate limited
 */
router.post(
  "/Api/Compliance/Scan",
  requireAuth,
  aiRateLimiter,
  checkRole([1, 2]),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const roleId = Number(user?.roleId ?? 0);
      const userId = (user?.userId ?? "").toString();

      // Get scoped workers
      const scopeWhere = await buildWorkerScopeWhere(user);
      const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
        where: scopeWhere,
        select: { Worker_Id: true },
        take: 5000,
      });
      const workerIds = scopedWorkers.map((w) => w.Worker_Id);

      if (workerIds.length === 0) {
        return res.json({
          totalWorkers: 0,
          criticalAlerts: 0,
          highAlerts: 0,
          mediumAlerts: 0,
          lowAlerts: 0,
          scoresUpdated: 0,
          scanRunAt: new Date(),
        });
      }

      // Get agency info if applicable
      let agencyId: string | undefined;
      if (roleId === 2) {
        const agent = await prisma.tbl_Agent.findFirst({
          where: { User_Id: userId },
          select: { Agent_Name: true },
        });
        agencyId = agent?.Agent_Name;
      }

      // Run scan
      const summary = await runComplianceScan(workerIds, roleId, agencyId);
      return res.json(summary);
    } catch (e) {
      return next(e);
    }
  }
);

/**
 * GET /Api/Compliance/Alerts
 * Get compliance alerts with filtering (Admin + Agency)
 */
router.get("/Api/Compliance/Alerts", requireAuth, checkRole([1, 2]), async (req, res, next) => {
  try {
    const user = (req as any).user;
    const roleId = Number(user?.roleId ?? 0);
    const userId = (user?.userId ?? "").toString();

    // Parse query params
    const severity = Array.isArray(req.query.severity)
      ? req.query.severity[0]
      : req.query.severity;
    const employerId = Array.isArray(req.query.employerId)
      ? req.query.employerId[0]
      : req.query.employerId;
    const resolved = req.query.resolved === "true" ? true : req.query.resolved === "false" ? false : undefined;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
    const skip = (page - 1) * limit;

    // Get agency ID for filtering
    let agencyId: string | undefined;
    if (roleId === 2) {
      const agent = await prisma.tbl_Agent.findFirst({
        where: { User_Id: userId },
        select: { Agent_Name: true },
      });
      agencyId = agent?.Agent_Name;
    }

    const result = await getAlerts(
      {
        severity: severity as string,
        employerId: employerId as string,
        isResolved: resolved,
        agencyId,
      },
      skip,
      limit
    );

    return res.json({
      alerts: result.alerts,
      total: result.total,
      page,
      limit,
      pages: Math.ceil(result.total / limit),
    });
  } catch (e) {
    return next(e);
  }
});

/**
 * GET /Api/Compliance/Scores
 * Get employer compliance scores (Admin + Agency)
 */
router.get("/Api/Compliance/Scores", requireAuth, checkRole([1, 2]), async (req, res, next) => {
  try {
    const user = (req as any).user;
    const roleId = Number(user?.roleId ?? 0);
    const userId = (user?.userId ?? "").toString();

    // Get agency ID for filtering
    let agencyId: string | undefined;
    if (roleId === 2) {
      const agent = await prisma.tbl_Agent.findFirst({
        where: { User_Id: userId },
        select: { Agent_Name: true },
      });
      agencyId = agent?.Agent_Name;
    }

    const scores = await getEmployerScores(agencyId);
    return res.json({ scores });
  } catch (e) {
    return next(e);
  }
});

/**
 * PATCH /Api/Compliance/Alerts/:id/Resolve
 * Mark alert as resolved (Admin + Agency)
 */
router.patch(
  "/Alerts/:id/Resolve",
  requireAuth,
  checkRole([1, 2]),
  async (req, res, next) => {
    try {
      const alertId = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(alertId) || alertId <= 0) {
        return res.status(400).json({ error: "Invalid alert ID" });
      }

      const success = await resolveAlert(alertId);
      if (!success) {
        return res.status(404).json({ error: "Alert not found" });
      }

      return res.json({ success: true, resolvedAt: new Date() });
    } catch (e) {
      return next(e);
    }
  }
);

/**
 * GET /Api/Compliance/Dashboard
 * Get dashboard summary stats (Admin + Agency)
 */
router.get("/Api/Compliance/Dashboard", requireAuth, checkRole([1, 2]), async (req, res, next) => {
  try {
    const user = (req as any).user;
    const roleId = Number(user?.roleId ?? 0);
    const userId = (user?.userId ?? "").toString();

    // Get agency ID for filtering
    let agencyId: string | undefined;
    if (roleId === 2) {
      const agent = await prisma.tbl_Agent.findFirst({
        where: { User_Id: userId },
        select: { Agent_Name: true },
      });
      agencyId = agent?.Agent_Name;
    }

    const summary = await getDashboardSummary(agencyId);
    return res.json(summary);
  } catch (e) {
    return next(e);
  }
});

export const complianceRouter = router;
