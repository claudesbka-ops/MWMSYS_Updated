import { Router } from "express";
import { requireAuth, checkRole } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimitMiddleware";
import {
  scoreSingleDispute,
  scoreAllUnscoredDisputes,
  getSeveritySummary,
  getScoredDisputes,
} from "../controllers/disputeAiController";
import { generateCaseSummary } from "../services/disputeAiService";
import { prisma } from "../db";
import { ensureDisputeTableExists, ensureDisputeTimelineTable } from "../db/schemaMigrations";

const router = Router();

/**
 * POST /Api/Disputes/Ai/Score/:disputeId
 * Score a single dispute (Admin + Agency)
 */
router.post(
  "/Api/Disputes/Ai/Score/:disputeId",
  requireAuth,
  checkRole([1, 2]),
  async (req, res, next) => {
    try {
      const disputeId = parseInt(String(req.params.disputeId), 10);
      if (!Number.isFinite(disputeId) || disputeId <= 0) {
        return res.status(400).json({ error: "Invalid dispute ID" });
      }

      const score = await scoreSingleDispute(disputeId);
      if (!score) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      return res.json({
        success: true,
        disputeId,
        ...score,
        scoredAt: new Date(),
      });
    } catch (e) {
      return next(e);
    }
  }
);

/**
 * POST /Api/Disputes/Ai/ScoreAll
 * Score ALL unscored disputes in one batch (Admin only) - AI rate limited
 */
router.post(
  "/Api/Disputes/Ai/ScoreAll",
  requireAuth,
  aiRateLimiter,
  checkRole([1]), // Admin only
  async (req, res, next) => {
    try {
      const result = await scoreAllUnscoredDisputes();
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
 * GET /Api/Disputes/Ai/Summary
 * Get severity counts summary (Admin + Agency)
 */
router.get(
  "/Api/Disputes/Ai/Summary",
  requireAuth,
  checkRole([1, 2]),
  async (req, res, next) => {
    try {
      const summary = await getSeveritySummary();
      return res.json(summary);
    } catch (e) {
      return next(e);
    }
  }
);

/**
 * GET /Api/Disputes/Ai/Disputes
 * Get AI-scored disputes with filters (Admin + Agency)
 */
router.get(
  "/Api/Disputes/Ai/Disputes",
  requireAuth,
  checkRole([1, 2]),
  async (req, res, next) => {
    try {
      const severity = Array.isArray(req.query.severity)
        ? req.query.severity[0]
        : req.query.severity;
      const employerId = Array.isArray(req.query.employerId)
        ? req.query.employerId[0]
        : req.query.employerId;
      const workerId = Array.isArray(req.query.workerId)
        ? req.query.workerId[0]
        : req.query.workerId;
      const unscoredOnly = req.query.unscoredOnly === "true";
      const limit = Math.min(100, parseInt((req.query.limit as string) || "50", 10));
      const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10));

      const result = await getScoredDisputes({
        severity: severity as string,
        employerId: employerId as string,
        workerId: workerId as string,
        unscoredOnly,
        limit,
        offset,
      });

      return res.json(result);
    } catch (e) {
      return next(e);
    }
  }
);

/**
 * POST /Api/Disputes/Ai/Summary/:disputeId
 * Generate (or regenerate) an AI case summary (Admin + Agency)
 */
router.post(
  "/Api/Disputes/Ai/Summary/:disputeId",
  requireAuth,
  aiRateLimiter,
  checkRole([1, 4]),
  async (req, res, next) => {
    try {
      const disputeId = parseInt(String(req.params.disputeId), 10);
      if (!Number.isFinite(disputeId) || disputeId <= 0) {
        return res.status(400).json({ error: "Invalid dispute ID" });
      }

      await ensureDisputeTableExists();
      await ensureDisputeTimelineTable();

      const row = (await prisma.$queryRawUnsafe(
        `SELECT d."Id",d."Worker_Id",d."Employer_Id",d."Dispute_Month",
                d."Expected_Amount",d."Received_Amount",d."Description",
                d."Proof_File_Path",d."Status",d."Employer_Comment",
                d."Submitted_At",d."Reviewed_At",
                d."Ai_Case_Summary",
                s."Ai_Severity",s."Ai_Severity_Score",
                w."Name" as "WorkerName",
                e."Employer_Name" as "EmployerName"
         FROM "Tbl_SalaryDispute" d
         LEFT JOIN "Tbl_SalaryDispute_AiScore" s ON s."Dispute_Id" = d."Id"
         LEFT JOIN "Tbl_Worker_PersonalInfo" w ON w."Worker_Id" = d."Worker_Id"
         LEFT JOIN "Tbl_Employer" e ON e."User_Id" = d."Employer_Id"
         WHERE d."Id" = $1
         LIMIT 1`,
        disputeId,
      )) as any[];

      if (!row || row.length === 0) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      const d = row[0];

      const summary = await generateCaseSummary({
        id: disputeId,
        workerId: d.Worker_Id,
        workerName: d.WorkerName ?? null,
        employerId: d.Employer_Id,
        employerName: d.EmployerName ?? null,
        disputeMonth: d.Dispute_Month,
        expectedAmount: Number(d.Expected_Amount ?? 0),
        receivedAmount: Number(d.Received_Amount ?? 0),
        description: d.Description ?? "",
        hasProof: !!d.Proof_File_Path,
        status: d.Status ?? "Pending",
        employerComment: d.Employer_Comment ?? null,
        aiSeverity: d.Ai_Severity ?? null,
        aiSeverityScore: d.Ai_Severity_Score != null ? Number(d.Ai_Severity_Score) : null,
        submittedAt: d.Submitted_At ? new Date(d.Submitted_At).toISOString() : null,
        reviewedAt: d.Reviewed_At ? new Date(d.Reviewed_At).toISOString() : null,
      });

      // Persist summary
      await prisma.$executeRawUnsafe(
        `UPDATE "Tbl_SalaryDispute" SET "Ai_Case_Summary" = $1 WHERE "Id" = $2`,
        summary,
        disputeId,
      );

      return res.json({
        disputeId,
        summary,
        generatedAt: new Date().toISOString(),
      });
    } catch (e) {
      return next(e);
    }
  }
);

export { router as disputeAiRouter };
