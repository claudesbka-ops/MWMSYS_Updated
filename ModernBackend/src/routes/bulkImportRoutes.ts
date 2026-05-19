import { Router } from "express";
import multer from "multer";
import { requireAuth, checkRole } from "../middleware/auth";
import {
  uploadCsv,
  confirmImport,
  executeImport,
  getImportHistory,
  downloadTemplate,
} from "../controllers/bulkImportController";

const router = Router();

// Configure multer for memory storage (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept CSV files only
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

/**
 * POST /Api/BulkImport/Upload
 * Upload CSV file and get preview
 */
router.post(
  "/Api/BulkImport/Upload",
  requireAuth,
  checkRole([4]), // Agency only
  upload.single("file"),
  uploadCsv
);

/**
 * POST /Api/BulkImport/Confirm/:jobId
 * Confirm import (legacy endpoint - use Execute instead)
 */
router.post(
  "/Api/BulkImport/Confirm/:jobId",
  requireAuth,
  checkRole([4]),
  confirmImport
);

/**
 * POST /Api/BulkImport/Execute/:jobId
 * Execute the import with validated rows
 */
router.post(
  "/Api/BulkImport/Execute/:jobId",
  requireAuth,
  checkRole([4]),
  executeImport
);

/**
 * GET /Api/BulkImport/History
 * Get import history for agency
 */
router.get(
  "/Api/BulkImport/History",
  requireAuth,
  checkRole([4]),
  getImportHistory
);

/**
 * GET /Api/BulkImport/Template
 * Download CSV template
 */
router.get(
  "/Api/BulkImport/Template",
  requireAuth,
  checkRole([4]),
  downloadTemplate
);

export { router as bulkImportRouter };
