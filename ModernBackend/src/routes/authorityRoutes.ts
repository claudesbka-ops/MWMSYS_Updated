import { Router } from "express";
import { requireAuth, checkRole } from "../middleware/auth";
import {
  embassyDashboard,
  embassyAtRisk,
  embassyDocumentExpiry,
  embassyWorkers,
  labourDashboard,
  labourWorkforceStats,
  labourComplianceOverview,
  labourDisputeOverview,
} from "../controllers/authorityController";

const router = Router();

// Embassy Routes (Role 5 = Embassy Source, Role 6 = Embassy Destination)

/**
 * GET /Api/Authority/Embassy/Dashboard
 * Embassy dashboard stats (total nationals, at-risk, docs expiring)
 */
router.get(
  "/Api/Authority/Embassy/Dashboard",
  requireAuth,
  checkRole([5, 6]),
  embassyDashboard
);

/**
 * GET /Api/Authority/Embassy/AtRisk
 * Nationals with risk score > 50
 */
router.get(
  "/Api/Authority/Embassy/AtRisk",
  requireAuth,
  checkRole([5, 6]),
  embassyAtRisk
);

/**
 * GET /Api/Authority/Embassy/DocumentExpiry
 * Nationals with documents expiring in X days
 * Query: days (default 60)
 */
router.get(
  "/Api/Authority/Embassy/DocumentExpiry",
  requireAuth,
  checkRole([5, 6]),
  embassyDocumentExpiry
);

/**
 * GET /Api/Authority/Embassy/Workers
 * Full list of national workers with search
 * Query: search, limit
 */
router.get(
  "/Api/Authority/Embassy/Workers",
  requireAuth,
  checkRole([5, 6]),
  embassyWorkers
);

// Labour Department Routes (Role 7 = Labour)

/**
 * GET /Api/Authority/Labour/Dashboard
 * Labour department dashboard stats
 */
router.get(
  "/Api/Authority/Labour/Dashboard",
  requireAuth,
  checkRole([7]),
  labourDashboard
);

/**
 * GET /Api/Authority/Labour/WorkforceStats
 * Workforce statistics for charts (nationality, employer, compliance breakdown)
 */
router.get(
  "/Api/Authority/Labour/WorkforceStats",
  requireAuth,
  checkRole([7]),
  labourWorkforceStats
);

/**
 * GET /Api/Authority/Labour/ComplianceOverview
 * Compliance overview for all employers
 */
router.get(
  "/Api/Authority/Labour/ComplianceOverview",
  requireAuth,
  checkRole([7]),
  labourComplianceOverview
);

/**
 * GET /Api/Authority/Labour/DisputeOverview
 * All disputes with AI severity
 * Query: severity, status, limit
 */
router.get(
  "/Api/Authority/Labour/DisputeOverview",
  requireAuth,
  checkRole([7]),
  labourDisputeOverview
);

export { router as authorityRouter };
