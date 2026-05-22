import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";

import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { uploadsDir, safeUnlinkUpload } from "../middleware/upload";
import { ensureDisputeTableExists, ensureDisputeTimelineTable } from "../db/schemaMigrations";
import { buildWorkerScopeWhere } from "../services/queryGuard";

const disputesDir = path.join(uploadsDir, "disputes");
fs.mkdirSync(disputesDir, { recursive: true });

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

const disputeUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, disputesDir),
    filename: (_req, file, cb) => {
      const safe = (file.originalname || "proof").replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = path.extname(safe);
      const base = path.basename(safe, ext);
      cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}_${base}${ext}`);
    },
  }),
  limits: { fileSize: MAX_PROOF_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file) return cb(null, true);
    if (ALLOWED_PROOF_MIME.has((file.mimetype ?? "").toLowerCase())) return cb(null, true);
    cb(new Error("Proof must be an image or PDF"));
  },
});

export const disputeRouter = Router();

async function insertTimelineEntry(params: {
  disputeId: number;
  action: string;
  actorId?: string | null;
  actorRole?: string | null;
  note?: string | null;
}): Promise<void> {
  try {
    await ensureDisputeTimelineTable();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Tbl_Dispute_Timeline"("Dispute_Id","Action","Actor_Id","Actor_Role","Note") VALUES ($1,$2,$3,$4,$5)`,
      params.disputeId,
      params.action.slice(0, 100),
      params.actorId ?? null,
      params.actorRole ?? null,
      params.note ? params.note.slice(0, 500) : null,
    );
  } catch {
    // non-blocking — don't fail the main operation if timeline write fails
  }
}

type DisputeRow = {
  Id: number;
  Worker_Id: string;
  Employer_Id: string;
  Dispute_Month: string;
  Expected_Amount: any;
  Received_Amount: any;
  Description: string;
  Proof_File_Path: string | null;
  Status: string;
  Employer_Comment: string | null;
  Submitted_At: Date | string | null;
  Reviewed_At: Date | string | null;
  Reviewed_By: string | null;
};

async function hydrateDisputes(rows: DisputeRow[]): Promise<any[]> {
  if (!rows || rows.length === 0) return [];

  const workerIds = Array.from(
    new Set(rows.map((r) => (r.Worker_Id ?? "").toString()).filter(Boolean))
  );
  const employerIds = Array.from(
    new Set(rows.map((r) => (r.Employer_Id ?? "").toString()).filter(Boolean))
  );

  const [workers, employers] = await Promise.all([
    workerIds.length
      ? prisma.tbl_Worker_PersonalInfo.findMany({
          where: { Worker_Id: { in: workerIds } },
          select: { Worker_Id: true, Name: true, Passport_Number: true },
        })
      : Promise.resolve([] as Array<{ Worker_Id: string; Name: string | null; Passport_Number: string | null }>),
    employerIds.length
      ? prisma.tbl_Employer.findMany({
          where: { User_Id: { in: employerIds } },
          select: { User_Id: true, Employer_Name: true },
        })
      : Promise.resolve([] as Array<{ User_Id: string; Employer_Name: string }>),
  ]);

  const workerMap = new Map(
    (workers ?? []).map((w) => [
      (w.Worker_Id ?? "").toString(),
      {
        name: (w.Name ?? "").toString(),
        passport: (w.Passport_Number ?? "").toString(),
      },
    ])
  );
  const employerMap = new Map(
    (employers ?? []).map((e) => [(e.User_Id ?? "").toString(), (e.Employer_Name ?? "").toString()])
  );

  return rows.map((r) => ({
    id: r.Id,
    workerId: r.Worker_Id,
    employerId: r.Employer_Id,
    workerName: workerMap.get((r.Worker_Id ?? "").toString())?.name ?? null,
    workerPassport: workerMap.get((r.Worker_Id ?? "").toString())?.passport ?? null,
    employerName: employerMap.get((r.Employer_Id ?? "").toString()) ?? null,
    disputeMonth: r.Dispute_Month,
    expectedAmount: r.Expected_Amount != null ? Number(r.Expected_Amount) : 0,
    receivedAmount: r.Received_Amount != null ? Number(r.Received_Amount) : 0,
    description: r.Description,
    hasProof: !!r.Proof_File_Path,
    status: r.Status,
    employerComment: r.Employer_Comment,
    submittedAt: r.Submitted_At,
    reviewedAt: r.Reviewed_At,
    reviewedBy: r.Reviewed_By,
  }));
}

// ---------- POST /Api/Dispute/Submit ----------

disputeRouter.post(
  "/Api/Dispute/Submit",
  requireAuth,
  disputeUpload.single("proof"),
  async (req, res, next) => {
    try {
      const user = (req as any).user as any;
      const roleId = Number(user?.roleId ?? 0);
      if (roleId !== 2) {
        if (req.file) safeUnlinkProof(req.file.filename);
        return res.status(403).json({ error: "Only workers can submit a dispute" });
      }

      const workerId = (user?.userKey ?? "").toString().trim();
      if (!workerId) {
        if (req.file) safeUnlinkProof(req.file.filename);
        return res.status(400).json({ error: "Missing worker id" });
      }

      const disputeMonth = (req.body?.disputeMonth ?? "").toString().trim();
      const expectedRaw = req.body?.expectedAmount;
      const receivedRaw = req.body?.receivedAmount;
      const description = (req.body?.description ?? "").toString().trim();

      if (!disputeMonth || !description) {
        if (req.file) safeUnlinkProof(req.file.filename);
        return res.status(400).json({ error: "disputeMonth and description are required" });
      }

      const expected = Number(expectedRaw);
      const received = Number(receivedRaw);
      if (!Number.isFinite(expected) || !Number.isFinite(received)) {
        if (req.file) safeUnlinkProof(req.file.filename);
        return res.status(400).json({ error: "expectedAmount and receivedAmount must be numbers" });
      }

      await ensureDisputeTableExists();

      // Resolve employer from the worker record.
      const workerRow = await prisma.tbl_Worker_PersonalInfo.findFirst({
        where: { Worker_Id: workerId },
        select: { Employer_Id: true },
      });
      const employerId = (workerRow?.Employer_Id ?? "").toString().trim();
      if (!employerId) {
        if (req.file) safeUnlinkProof(req.file.filename);
        return res.status(400).json({
          error: "No employer linked to this worker — cannot route the dispute",
        });
      }

      const proofPath = req.file ? `/uploads/disputes/${req.file.filename}` : null;

      const created = await prisma.tbl_SalaryDispute.create({
        data: {
          Worker_Id: workerId,
          Employer_Id: employerId,
          Dispute_Month: disputeMonth.slice(0, 20),
          Expected_Amount: expected,
          Received_Amount: received,
          Description: description.slice(0, 1000),
          Proof_File_Path: proofPath,
          Status: "Pending",
        },
      });

      const hydrated = await hydrateDisputes([created as unknown as DisputeRow]);

      await insertTimelineEntry({
        disputeId: created.Id,
        action: "submitted",
        actorId: workerId,
        actorRole: "worker",
        note: `Dispute submitted for ${disputeMonth}`,
      });

      return res.status(201).json(hydrated[0] ?? { id: created.Id });
    } catch (e: any) {
      if ((e?.message ?? "").toLowerCase().includes("proof must be")) {
        return res.status(400).json({ error: e.message });
      }
      return next(e);
    }
  }
);

function safeUnlinkProof(filename: string) {
  safeUnlinkUpload(`/uploads/disputes/${filename}`);
}

// ---------- GET /Api/Dispute/MyDisputes (worker) ----------

disputeRouter.get("/Api/Dispute/MyDisputes", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    if (roleId !== 2) return res.status(403).json({ error: "Only workers can view their disputes" });

    const workerId = (user?.userKey ?? "").toString().trim();
    if (!workerId) return res.json([]);

    await ensureDisputeTableExists();

    const rows = await prisma.tbl_SalaryDispute.findMany({
      where: { Worker_Id: workerId },
      orderBy: [{ Submitted_At: "desc" }],
      take: 500,
    });

    return res.json(await hydrateDisputes(rows as unknown as DisputeRow[]));
  } catch (e) {
    return next(e);
  }
});

// ---------- GET /Api/Dispute/Incoming (employer) ----------

disputeRouter.get("/Api/Dispute/Incoming", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    if (roleId !== 3) return res.status(403).json({ error: "Only employers have a dispute inbox" });

    const employerId = (user?.userKey ?? "").toString().trim();
    if (!employerId) return res.json([]);

    await ensureDisputeTableExists();

    const rows = await prisma.tbl_SalaryDispute.findMany({
      where: { Employer_Id: employerId },
      orderBy: [{ Submitted_At: "desc" }],
      take: 1000,
    });

    return res.json(await hydrateDisputes(rows as unknown as DisputeRow[]));
  } catch (e) {
    return next(e);
  }
});

// ---------- GET /Api/Dispute/All (admin + agency) ----------

disputeRouter.get("/Api/Dispute/All", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    if (roleId !== 1 && roleId !== 4 && roleId !== 7) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await ensureDisputeTableExists();

    const rawStatus = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
    const status = (rawStatus ?? "").toString().trim();

    let workerIdFilter: string[] | null = null;
    if (roleId === 4) {
      // Agency: restrict to workers inside the agency scope.
      const scopeWhere = await buildWorkerScopeWhere(user);
      const scoped = await prisma.tbl_Worker_PersonalInfo.findMany({
        where: scopeWhere,
        select: { Worker_Id: true },
        take: 5000,
      });
      workerIdFilter = Array.from(
        new Set((scoped ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean))
      );
      if (workerIdFilter.length === 0) return res.json([]);
    }

    const where: Record<string, any> = {};
    if (workerIdFilter) where.Worker_Id = { in: workerIdFilter };
    if (status && status !== "All") where.Status = status;

    const rows = await prisma.tbl_SalaryDispute.findMany({
      where,
      orderBy: [{ Submitted_At: "desc" }],
      take: 2000,
    });

    return res.json(await hydrateDisputes(rows as unknown as DisputeRow[]));
  } catch (e) {
    return next(e);
  }
});

// ---------- PUT /Api/Dispute/Review (employer + admin) ----------

disputeRouter.put("/Api/Dispute/Review", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    if (roleId !== 1 && roleId !== 3) {
      return res.status(403).json({ error: "Only employers or admins can review disputes" });
    }

    const idRaw = req.body?.id;
    const id = Number(idRaw);
    const status = (req.body?.status ?? "").toString().trim();
    const comment = (req.body?.employerComment ?? req.body?.comment ?? "").toString().trim();

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "id is required" });
    }
    if (status !== "Accepted" && status !== "Rejected") {
      return res.status(400).json({ error: "status must be Accepted or Rejected" });
    }

    await ensureDisputeTableExists();

    const existing = await prisma.tbl_SalaryDispute.findFirst({ where: { Id: id } });
    if (!existing) return res.status(404).json({ error: "Dispute not found" });

    // Employer can only act on disputes against their own account.
    if (roleId === 3) {
      const employerId = (user?.userKey ?? "").toString().trim();
      if (!employerId || existing.Employer_Id !== employerId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const reviewer = (user?.userKey ?? "").toString().trim() || null;
    const updated = await prisma.tbl_SalaryDispute.update({
      where: { Id: id },
      data: {
        Status: status,
        Employer_Comment: comment ? comment.slice(0, 500) : null,
        Reviewed_At: new Date(),
        Reviewed_By: reviewer,
      },
    });

    const hydrated = await hydrateDisputes([updated as unknown as DisputeRow]);

    const reviewerRole = roleId === 1 ? "admin" : "employer";
    await insertTimelineEntry({
      disputeId: id,
      action: status === "Accepted" ? "accepted" : "rejected",
      actorId: reviewer,
      actorRole: reviewerRole,
      note: comment || null,
    });

    return res.json(hydrated[0] ?? { id: updated.Id });
  } catch (e) {
    return next(e);
  }
});

// ---------- GET /Api/Disputes/:id/Timeline ----------

disputeRouter.get("/Api/Disputes/:id/Timeline", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid dispute id" });
    }

    await ensureDisputeTableExists();
    await ensureDisputeTimelineTable();

    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    const userKey = (user?.userKey ?? "").toString().trim();

    const dispute = await prisma.tbl_SalaryDispute.findFirst({ where: { Id: id } });
    if (!dispute) return res.status(404).json({ error: "Dispute not found" });

    // Access check: worker sees own, employer sees own, admin/agency/labour see all
    let allowed = false;
    if (roleId === 1 || roleId === 4 || roleId === 7) {
      allowed = true;
    } else if (roleId === 2) {
      allowed = userKey === dispute.Worker_Id;
    } else if (roleId === 3) {
      allowed = userKey === dispute.Employer_Id;
    }
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "Id","Dispute_Id","Action","Actor_Id","Actor_Role","Note","Created_At"
       FROM "Tbl_Dispute_Timeline"
       WHERE "Dispute_Id" = $1
       ORDER BY "Created_At" ASC`,
      id,
    )) as any[];

    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

// ---------- GET /Api/Dispute/File/:id (secure download) ----------

disputeRouter.get("/Api/Dispute/File/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid dispute id" });
    }

    await ensureDisputeTableExists();

    const dispute = await prisma.tbl_SalaryDispute.findFirst({ where: { Id: id } });
    if (!dispute || !dispute.Proof_File_Path) {
      return res.status(404).json({ error: "No proof file on record" });
    }

    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    const userKey = (user?.userKey ?? "").toString().trim();

    let allowed = false;
    if (roleId === 1 || roleId === 7) {
      allowed = true; // admin + labour
    } else if (roleId === 2) {
      allowed = userKey === dispute.Worker_Id;
    } else if (roleId === 3) {
      allowed = userKey === dispute.Employer_Id;
    } else if (roleId === 4) {
      const scopeWhere = await buildWorkerScopeWhere(user);
      const match = await prisma.tbl_Worker_PersonalInfo.findFirst({
        where: { ...scopeWhere, Worker_Id: dispute.Worker_Id },
        select: { Worker_Id: true },
      });
      allowed = !!match;
    }

    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    // Serve the file from the uploads dir. Guard against path escape.
    const proofPath = (dispute.Proof_File_Path ?? "").toString();
    const filename = path.basename(proofPath);
    if (!filename || !proofPath.startsWith("/uploads/disputes/")) {
      return res.status(404).json({ error: "File missing" });
    }
    const full = path.join(disputesDir, filename);
    if (!fs.existsSync(full)) {
      return res.status(404).json({ error: "File missing" });
    }

    return res.sendFile(full);
  } catch (e) {
    return next(e);
  }
});
