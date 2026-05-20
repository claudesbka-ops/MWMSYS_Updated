import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { getAuditLog, getUserLoginHistory } from "../controllers/auditController";

export const auditRouter = Router();

// GET /Api/Audit/Log - Admin only
auditRouter.get("/Api/Audit/Log", requireAuth, requireAdmin, getAuditLog);

// GET /Api/Audit/LoginHistory/:userId - Admin only
auditRouter.get("/Api/Audit/LoginHistory/:userId", requireAuth, requireAdmin, getUserLoginHistory);
