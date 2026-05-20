import { Router } from "express";
import { requireAuth, checkRole } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimitMiddleware";
import {
  scoreSingleDispute,
  scoreAllUnscoredDisputes,
  getSeveritySummary,
  getScoredDisputes,
} from "../controllers/disputeAiController";

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

export { router as disputeAiRouter };
