import { Request, Response, NextFunction } from "express";
import { prisma } from "../db";
import {
  validateAndParseCsv,
  validateEmployersExist,
  processImport,
  generateCsvTemplate,
  type CsvWorkerRow,
} from "../services/bulkImportService";

const MAX_ROWS = 500;

/**
 * POST /Api/BulkImport/Upload
 * Upload CSV and return preview with validation
 */
export async function uploadCsv(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    const agencyId = user?.userKey?.toString();
    const roleId = Number(user?.roleId ?? 0);

    if (roleId !== 4) {
      return res.status(403).json({ error: "Only agencies can import workers" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "CSV file is required" });
    }

    // Validate file size (2MB limit)
    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: "File size exceeds 2MB limit" });
    }

    // Parse and validate CSV
    const preview = validateAndParseCsv(req.file.buffer);

    if (preview.totalRows === 0) {
      return res.status(400).json({ error: "No valid rows found in CSV" });
    }

    if (preview.totalRows > MAX_ROWS) {
      return res.status(400).json({ error: `Maximum ${MAX_ROWS} rows allowed per import` });
    }

    // Validate employers exist
    const employerErrors = await validateEmployersExist(preview.rows);
    preview.errors.push(...employerErrors);
    preview.validRows = preview.totalRows - preview.errors.filter((e) => e.row > 0).length;

    // Create import job record
    const job = await prisma.tbl_Import_Jobs.create({
      data: {
        Agency_Id: agencyId,
        File_Name: req.file.originalname,
        Total_Rows: preview.totalRows,
        Status: "processing",
        Successful: 0,
        Failed: 0,
      },
    });

    // Return preview with job ID
    return res.json({
      jobId: job.Id,
      preview: {
        totalRows: preview.totalRows,
        validRows: preview.validRows,
        sampleRows: preview.rows.slice(0, 5),
        errors: preview.errors,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /Api/BulkImport/Confirm/:jobId
 * Confirm and execute the import
 */
export async function confirmImport(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    const agencyId = user?.userKey?.toString();
    const roleId = Number(user?.roleId ?? 0);

    if (roleId !== 4) {
      return res.status(403).json({ error: "Only agencies can import workers" });
    }

    const jobId = parseInt(req.params.jobId, 10);
    if (!Number.isFinite(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    // Get job and verify ownership
    const job = await prisma.tbl_Import_Jobs.findFirst({
      where: { Id: jobId, Agency_Id: agencyId },
    });

    if (!job) {
      return res.status(404).json({ error: "Import job not found" });
    }

    if (job.Status !== "processing") {
      return res.status(400).json({ error: "Job already processed" });
    }

    // Re-parse CSV from memory (in production, store temp file or re-upload)
    // For now, this requires re-upload - in real implementation we'd store the parsed rows
    // Return success pending implementation detail
    return res.json({
      message: "Use upload endpoint to get preview, then confirm with same file",
      jobId,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /Api/BulkImport/Execute/:jobId
 * Actually execute the import with stored rows
 */
export async function executeImport(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    const agencyId = user?.userKey?.toString();
    const roleId = Number(user?.roleId ?? 0);

    if (roleId !== 4) {
      return res.status(403).json({ error: "Only agencies can import workers" });
    }

    const jobId = parseInt(req.params.jobId, 10);
    if (!Number.isFinite(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    // Get rows from request body (sent from frontend after preview)
    const rows: CsvWorkerRow[] = req.body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows to import" });
    }

    if (rows.length > MAX_ROWS) {
      return res.status(400).json({ error: `Maximum ${MAX_ROWS} rows allowed` });
    }

    // Process import
    const result = await processImport(jobId, rows, agencyId);

    return res.json({
      success: true,
      jobId,
      ...result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /Api/BulkImport/History
 * Get import history for agency
 */
export async function getImportHistory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    const agencyId = user?.userKey?.toString();
    const roleId = Number(user?.roleId ?? 0);

    if (roleId !== 4) {
      return res.status(403).json({ error: "Only agencies can view import history" });
    }

    const jobs = await prisma.tbl_Import_Jobs.findMany({
      where: { Agency_Id: agencyId },
      orderBy: { Imported_At: "desc" },
      take: 10,
    });

    return res.json({ jobs });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /Api/BulkImport/Template
 * Download CSV template
 */
export function downloadTemplate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const template = generateCsvTemplate();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=worker_import_template.csv");
    return res.send(template);
  } catch (err) {
    return next(err);
  }
}
