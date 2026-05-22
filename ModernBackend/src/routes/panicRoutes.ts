import { Router, type Request, type Response } from "express";

import { prisma } from "../db";
import {
  checkRole,
  requireAdmin,
  requireAlertViewer,
  requireAuth,
  requireAuthority,
} from "../middleware/auth";
import { upload } from "../middleware/upload";
import { getIO } from "../services/socketService";
import { buildWorkerScopeWhere } from "../services/queryGuard";
import { findWorkerIdByJwtUserId, findWorkerPassportByJwtUserId } from "../services/workerLookup";

// ---------- Panic-only helpers ----------

async function findMemberInfoIdByPassport(passportNo: string): Promise<number | null> {
  const candidates = [
    `SELECT "MemberInfoId" FROM "MemberInfo" WHERE "PassportNo" = $1 LIMIT 1`,
    `SELECT "MemberInfoId" FROM "MemberInfo" WHERE "PassportNumber" = $1 LIMIT 1`,
    `SELECT "MemberInfoId" FROM "MemberInfo" WHERE "Passport" = $1 LIMIT 1`,
  ];

  for (const sql of candidates) {
    try {
      const rows = (await prisma.$queryRawUnsafe(sql, passportNo)) as any[];
      const row = Array.isArray(rows) ? rows[0] : null;
      const value = row?.MemberInfoId;
      if (value != null) return Number(value);
    } catch {
      // ignore and try next
    }
  }

  return null;
}

async function findWorkerMetadataByPassport(passportNo: string): Promise<
  | { workerId: string; currentLocation: string | null; companyName: string | null; passportPhoto: string | null }
  | null
> {
  if (!passportNo) return null;

  try {
    const row = await prisma.tbl_Worker_PersonalInfo.findFirst({
      where: {
        Passport_Number: passportNo,
      },
      select: {
        Worker_Id: true,
        Photo: true,
      },
    });

    if (!row?.Worker_Id) return null;

    return {
      workerId: String(row.Worker_Id),
      currentLocation: null,
      companyName: null,
      passportPhoto: row.Photo != null ? String(row.Photo) : null,
    };
  } catch {
    return null;
  }
}

async function handlePanic(req: Request, res: Response) {
  let passportNo = (req.body.PassportNo ?? req.body.passportNo ?? "").toString().trim();
  const title = (req.body.Title ?? req.body.title ?? "Panic Alert").toString();
  const description = (req.body.Description ?? req.body.description ?? "Panic alert triggered").toString();
  const latitude = (req.body.Latitude ?? req.body.latitude ?? req.body.lattitude ?? "").toString();
  const longitude = (req.body.Longitude ?? req.body.longitude ?? "").toString();

  let memberInfoId = Number(req.body.MemberInfoId ?? req.body.memberInfoId ?? 0);

  const jwtUserId = Number((req as any).user?.userId ?? 0);
  const isAuthed = Number.isFinite(jwtUserId) && jwtUserId > 0;
  const workerIdFromJwt = isAuthed ? await findWorkerIdByJwtUserId(jwtUserId) : null;

  if (!passportNo && !memberInfoId) {
    if (isAuthed) {
      passportNo = (await findWorkerPassportByJwtUserId(jwtUserId)) ?? "";
    }
  }

  if (!memberInfoId && passportNo) {
    memberInfoId = (await findMemberInfoIdByPassport(passportNo)) ?? 0;
  }

  if (!memberInfoId && !passportNo && !workerIdFromJwt) {
    return res.status(400).json({ error: "MemberInfoId or PassportNo is required" });
  }

  if (!memberInfoId && !isAuthed) {
    return res.status(400).json({ error: "MemberInfoId or PassportNo is required" });
  }

  try {
    const uploaded = (req as any).file as { filename?: string } | undefined;
    const uploadPath = uploaded?.filename ? `/uploads/${uploaded.filename}` : null;

    const workerMeta = passportNo ? await findWorkerMetadataByPassport(passportNo) : null;

    const created = await prisma.tbl_ProbSol.create({
      data: {
        Prob_ID: passportNo || workerIdFromJwt || (memberInfoId ? memberInfoId.toString() : ""),
        Type: "Panic",
        Title: title,
        Description:
          latitude || longitude
            ? `${description} (lat=${latitude || ""}, lng=${longitude || ""})`
            : description,
        ProbStatus: "Pending",
        Updated_By: workerIdFromJwt || passportNo || "worker",
        Updated_On: new Date(),
        worker_ID: workerIdFromJwt || null,
        Current_Location: workerMeta?.currentLocation ?? undefined,
        Company_Name: workerMeta?.companyName ?? undefined,
        ...(uploadPath
          ? {
              DocumentPath: uploadPath,
            }
          : {}),
        IsResolved: false,
        Lat: Number.isFinite(Number(latitude)) ? (Number(latitude) as any) : undefined,
        Lng: Number.isFinite(Number(longitude)) ? (Number(longitude) as any) : undefined,
      },
    });

    const data = {
      id: created.ID,
      title,
      description,
      passportNo: passportNo || undefined,
      memberInfoId: memberInfoId || undefined,
      workerId: workerMeta?.workerId ?? workerIdFromJwt ?? undefined,
      currentLocation: workerMeta?.currentLocation ?? undefined,
      companyName: workerMeta?.companyName ?? undefined,
      passportPhoto: workerMeta?.passportPhoto ?? undefined,
      uploadedFileUrl: uploadPath ? `${req.protocol}://${req.get("host")}${uploadPath}` : undefined,
      createdAt: new Date().toISOString(),
    };

    getIO().to("admin").emit("new_trigger", data);

    console.log("New alert emitted", {
      id: created.ID,
      title,
      passportNo,
      memberInfoId,
    });

    return res.status(200).json({ ProblemAndActionId: created.ID });
  } catch (e) {
    throw e;
  }
}

// ---------- Router ----------

export const panicRouter = Router();

// New route name requested
panicRouter.post("/panic", requireAuth, upload.single("file"), handlePanic);

// Backward-compatible route for existing frontend
panicRouter.post("/Api/Panic", requireAuth, upload.single("file"), handlePanic);

panicRouter.get("/Api/Panic/Latest", requireAuth, checkRole([1, 3, 4, 5, 6, 7]), async (req, res, next) => {
  const rawSinceId = Array.isArray(req.query.sinceId) ? req.query.sinceId[0] : req.query.sinceId;
  const sinceId = rawSinceId != null ? Number(rawSinceId) : 0;

  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));

    if (roleId !== 1 && !allowedWorkerIds.size) {
      return res.json([]);
    }

    const rows = await prisma.tbl_ProbSol.findMany({
      where: {
        Type: "Panic",
        ID: {
          gt: Number.isFinite(sinceId) ? sinceId : 0,
        },
        ...(roleId !== 1 ? { ProbStatus: { not: "Pending" } } : {}),
        ...(roleId !== 1 && allowedWorkerIds.size ? { worker_ID: { in: Array.from(allowedWorkerIds) } } : {}),
      },
      orderBy: {
        ID: "desc",
      },
    });

    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

panicRouter.post("/Api/Panic/Forward", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const panicId = Number(req.body?.panicId ?? req.body?.id ?? 0);
    const target = (req.body?.target ?? req.body?.embassy ?? "").toString().trim();
    if (!Number.isFinite(panicId) || panicId <= 0) {
      return res.status(400).json({ error: "panicId is required" });
    }
    if (target !== "embassy_source" && target !== "embassy_destination") {
      return res.status(400).json({ error: "target must be embassy_source or embassy_destination" });
    }

    const row = await prisma.tbl_ProbSol.findFirst({ where: { ID: panicId, Type: "Panic" } });
    if (!row) return res.status(404).json({ error: "Panic not found" });

    if ((row as any)?.ProbStatus?.toString() === "Pending") {
      await prisma.tbl_ProbSol.update({ where: { ID: panicId }, data: { ProbStatus: "Approved", Updated_On: new Date() } });
    }

    const payload = {
      id: row.ID,
      title: (row as any)?.Title ?? "Panic Alert",
      description: (row as any)?.Description ?? "",
      workerId: (row as any)?.worker_ID ?? null,
      companyName: (row as any)?.Company_Name ?? null,
      currentLocation: (row as any)?.Current_Location ?? null,
      status: "Approved",
      createdOn: (row as any)?.Updated_On ?? null,
    };

    const io = getIO();
    io.to(target).emit("panic_forwarded", payload);
    io.to(target).emit("new_trigger", payload);
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

panicRouter.get("/Api/Panic/Active", requireAuth, requireAlertViewer, async (_req, res, next) => {
  try {
    const roleId = Number((_req as any).user?.roleId ?? 0);
    const scopeWhere = await buildWorkerScopeWhere((_req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));

    const rows = await prisma.tbl_ProbSol.findMany({
      where: {
        Type: "Panic",
        OR: [{ IsResolved: false }, { IsResolved: null }],
        ...(roleId !== 1 ? { ProbStatus: { not: "Pending" } } : {}),
        ...(allowedWorkerIds.size ? { worker_ID: { in: Array.from(allowedWorkerIds) } } : {}),
      },
      select: {
        ID: true,
        Prob_ID: true,
        Type: true,
        Title: true,
        Description: true,
        ProbStatus: true,
        Updated_On: true,
        worker_ID: true,
        DocumentPath: true,
        Current_Location: true,
        Company_Name: true,
        Lat: true,
        Lng: true,
        IsResolved: true,
      },
      orderBy: [{ ID: "desc" }],
      take: 200,
    });

    const workerIds = Array.from(
      new Set((rows ?? []).map((r) => (r.worker_ID ?? "").toString()).filter(Boolean))
    );

    const workerInfoRows = workerIds.length
      ? await prisma.tbl_Worker_PersonalInfo.findMany({
          where: { Worker_Id: { in: workerIds } },
          select: {
            Worker_Id: true,
            Photo: true,
            Name: true,
            Passport_Number: true,
            Contact_Number: true,
            Nationality: true,
            Employer_Id: true,
          },
        })
      : [];

    const employerIds = Array.from(
      new Set((workerInfoRows ?? []).map((w) => (w.Employer_Id ?? "").toString()).filter(Boolean))
    );
    const employerRows = employerIds.length
      ? await prisma.tbl_Employer.findMany({
          where: { User_Id: { in: employerIds } },
          select: { User_Id: true, Employer_Name: true },
        })
      : [];
    const employerNameById = new Map<string, string>();
    for (const e of employerRows ?? []) employerNameById.set(e.User_Id, e.Employer_Name ?? "");

    const workerInfoById = new Map<string, {
      photo: string | null; name: string | null; passport: string | null;
      phone: string | null; nationality: string | null; employerName: string | null;
    }>();
    for (const w of workerInfoRows ?? []) {
      const empId = (w.Employer_Id ?? "").toString();
      workerInfoById.set(w.Worker_Id, {
        photo: w.Photo ?? null,
        name: w.Name ?? null,
        passport: w.Passport_Number ?? null,
        phone: w.Contact_Number ?? null,
        nationality: w.Nationality != null ? String(w.Nationality) : null,
        employerName: empId ? (employerNameById.get(empId) ?? null) : null,
      });
    }

    return res.json(
      (rows ?? []).map((r) => {
        const wi = r.worker_ID ? workerInfoById.get(r.worker_ID) ?? null : null;
        return {
          ...r,
          passportPhoto: wi?.photo ?? null,
          workerName: wi?.name ?? null,
          passportNumber: wi?.passport ?? null,
          phoneNumber: wi?.phone ?? null,
          nationality: wi?.nationality ?? null,
          employerName: wi?.employerName ?? r.Company_Name ?? null,
        };
      })
    );
  } catch (e) {
    return next(e);
  }
});

panicRouter.get("/Api/Panic/History", requireAuth, requireAuthority, async (_req, res, next) => {
  try {
    const scopeWhere = await buildWorkerScopeWhere((_req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));

    const rows = await prisma.tbl_ProbSol.findMany({
      where: {
        Type: "Panic",
        ...(allowedWorkerIds.size ? { worker_ID: { in: Array.from(allowedWorkerIds) } } : {}),
      },
      select: {
        ID: true,
        Prob_ID: true,
        Type: true,
        Title: true,
        Description: true,
        ProbStatus: true,
        Updated_On: true,
        worker_ID: true,
        DocumentPath: true,
        Current_Location: true,
        Company_Name: true,
        Lat: true,
        Lng: true,
        IsResolved: true,
      },
      orderBy: [{ ID: "desc" }],
      take: 500,
    });

    const workerIds = Array.from(
      new Set((rows ?? []).map((r) => (r.worker_ID ?? "").toString()).filter(Boolean))
    );

    const workerInfoRows = workerIds.length
      ? await prisma.tbl_Worker_PersonalInfo.findMany({
          where: { Worker_Id: { in: workerIds } },
          select: {
            Worker_Id: true,
            Photo: true,
            Name: true,
            Passport_Number: true,
            Contact_Number: true,
            Nationality: true,
            Employer_Id: true,
          },
        })
      : [];

    const employerIds = Array.from(
      new Set((workerInfoRows ?? []).map((w) => (w.Employer_Id ?? "").toString()).filter(Boolean))
    );
    const employerRows = employerIds.length
      ? await prisma.tbl_Employer.findMany({
          where: { User_Id: { in: employerIds } },
          select: { User_Id: true, Employer_Name: true },
        })
      : [];
    const employerNameById = new Map<string, string>();
    for (const e of employerRows ?? []) employerNameById.set(e.User_Id, e.Employer_Name ?? "");

    const workerInfoById = new Map<string, {
      photo: string | null; name: string | null; passport: string | null;
      phone: string | null; nationality: string | null; employerName: string | null;
    }>();
    for (const w of workerInfoRows ?? []) {
      const empId = (w.Employer_Id ?? "").toString();
      workerInfoById.set(w.Worker_Id, {
        photo: w.Photo ?? null,
        name: w.Name ?? null,
        passport: w.Passport_Number ?? null,
        phone: w.Contact_Number ?? null,
        nationality: w.Nationality != null ? String(w.Nationality) : null,
        employerName: empId ? (employerNameById.get(empId) ?? null) : null,
      });
    }

    return res.json(
      (rows ?? []).map((r) => {
        const wi = r.worker_ID ? workerInfoById.get(r.worker_ID) ?? null : null;
        return {
          ...r,
          passportPhoto: wi?.photo ?? null,
          workerName: wi?.name ?? null,
          passportNumber: wi?.passport ?? null,
          phoneNumber: wi?.phone ?? null,
          nationality: wi?.nationality ?? null,
          employerName: wi?.employerName ?? r.Company_Name ?? null,
        };
      })
    );
  } catch (e) {
    return next(e);
  }
});

panicRouter.post("/Api/Panic/Resolve", requireAuth, requireAuthority, async (req, res, next) => {
  const id = Number(req.body?.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "id is required" });
  }

  try {
    await prisma.tbl_ProbSol.update({
      where: { ID: id },
      data: {
        ProbStatus: "Resolved",
        Updated_On: new Date(),
        IsResolved: true,
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});
