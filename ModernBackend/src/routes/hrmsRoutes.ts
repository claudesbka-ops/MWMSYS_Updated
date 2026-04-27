import { Router } from "express";

import { prisma } from "../db";
import { checkRole, requireAuth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { requireActivePlanForWrite } from "../middleware/subscription";
import { ensureHrmsRequestTablesExist, ensureRosterTablesExist } from "../db/schemaMigrations";
import { buildWorkerScopeWhere } from "../services/queryGuard";
import { getIO } from "../services/socketService";

export const hrmsRouter = Router();

// ---------- Attendance ----------

hrmsRouter.get("/Api/HRMS/Attendance", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    await ensureRosterTablesExist();

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (!workerIds.length) return res.json([]);

    const rows = await prisma.tbl_Attendance.findMany({
      where: { workerId: { in: workerIds } },
      orderBy: [{ id: "desc" }],
      take: 1000,
    });

    const attendanceRows = (rows ?? []) as Array<any>;
    const keyPairs: Array<{ workerId: string; dateStr: string }> = [];
    for (const r of attendanceRows) {
      const workerId = (r?.workerId ?? "").toString();
      const d = r?.checkIn ? new Date(r.checkIn) : null;
      if (!workerId || !d || isNaN(d.getTime())) continue;
      keyPairs.push({ workerId, dateStr: d.toISOString().slice(0, 10) });
    }

    const uniqueKey = new Set(keyPairs.map((k) => `${k.workerId}__${k.dateStr}`));
    const pairs = Array.from(uniqueKey).map((x) => {
      const [workerId, dateStr] = x.split("__");
      return { workerId, dateStr };
    });

    const shiftByWorkerDay = new Map<string, { startTime: string | null; endTime: string | null }>();
    if (pairs.length) {
      const whereParts: string[] = [];
      const params: any[] = [];
      let p = 1;
      for (const pair of pairs) {
        whereParts.push(`(r.workerId=@P${p} AND r.[date]=CAST(@P${p + 1} AS DATE))`);
        params.push(pair.workerId, pair.dateStr);
        p += 2;
      }

      const q =
        "SELECT TOP (50000) r.workerId, r.[date] as d, s.startTime, s.endTime " +
        "FROM dbo.Tbl_Roster_Assignment r LEFT JOIN dbo.Tbl_Shift_Template s ON s.id=r.shiftId " +
        (whereParts.length ? `WHERE ${whereParts.join(" OR ")}` : "");

      const roster = (await prisma.$queryRawUnsafe(q, ...params)) as any[];
      for (const rr of roster ?? []) {
        const workerId = (rr.workerId ?? "").toString();
        const d = rr.d ? new Date(rr.d) : null;
        const dateStr = d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
        if (!workerId || !dateStr) continue;
        shiftByWorkerDay.set(`${workerId}__${dateStr}`, {
          startTime: rr.startTime != null ? String(rr.startTime) : null,
          endTime: rr.endTime != null ? String(rr.endTime) : null,
        });
      }
    }

    const graceMinutes = 5;
    const parseTime = (t: string | null): { hh: number; mm: number } | null => {
      if (!t) return null;
      const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
      return { hh, mm };
    };

    const withFlags = attendanceRows.map((r) => {
      const checkIn = r?.checkIn ? new Date(r.checkIn) : null;
      const checkOut = r?.checkOut ? new Date(r.checkOut) : null;
      const dateStr = checkIn && !isNaN(checkIn.getTime()) ? checkIn.toISOString().slice(0, 10) : "";
      const shift = dateStr ? shiftByWorkerDay.get(`${String(r.workerId)}__${dateStr}`) : undefined;
      const start = parseTime(shift?.startTime ?? null);
      const end = parseTime(shift?.endTime ?? null);

      let plannedStart: Date | null = null;
      let plannedEnd: Date | null = null;
      if (dateStr && start) {
        plannedStart = new Date(`${dateStr}T00:00:00.000Z`);
        plannedStart.setUTCHours(start.hh, start.mm, 0, 0);
      }
      if (dateStr && end) {
        plannedEnd = new Date(`${dateStr}T00:00:00.000Z`);
        plannedEnd.setUTCHours(end.hh, end.mm, 0, 0);
      }

      const workedHours =
        checkIn && checkOut && !isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())
          ? Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 36e5)
          : 0;

      const lateMinutes =
        plannedStart && checkIn
          ? Math.max(0, Math.round((checkIn.getTime() - plannedStart.getTime()) / 60000) - graceMinutes)
          : 0;

      const earlyLeaveMinutes =
        plannedEnd && checkOut
          ? Math.max(0, Math.round((plannedEnd.getTime() - checkOut.getTime()) / 60000) - graceMinutes)
          : 0;

      return {
        ...r,
        workedHours,
        plannedStartTime: shift?.startTime ?? null,
        plannedEndTime: shift?.endTime ?? null,
        lateMinutes: Number.isFinite(lateMinutes) ? lateMinutes : 0,
        earlyLeaveMinutes: Number.isFinite(earlyLeaveMinutes) ? earlyLeaveMinutes : 0,
      };
    });

    return res.json(withFlags ?? []);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.get("/Api/HRMS/Attendance/me", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rows = await prisma.tbl_Attendance.findMany({
      where: { workerId: userKey },
      orderBy: [{ id: "desc" }],
      take: 200,
    });
    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post("/Api/HRMS/Attendance/ClockIn", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const lat = req.body?.lat != null ? Number(req.body.lat) : null;
    const lng = req.body?.lng != null ? Number(req.body.lng) : null;
    const photoUrl = (req.body?.photoUrl ?? null) != null ? String(req.body.photoUrl) : null;

    const created = await prisma.tbl_Attendance.create({
      data: {
        workerId: userKey,
        checkIn: new Date(),
        checkOut: null,
        lat: lat != null && Number.isFinite(lat) ? lat : null,
        lng: lng != null && Number.isFinite(lng) ? lng : null,
        photoUrl,
      } as any,
    });

    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post("/Api/HRMS/Attendance/ClockOut", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const open = await prisma.tbl_Attendance.findFirst({
      where: { workerId: userKey, checkOut: null },
      orderBy: [{ id: "desc" }],
    });

    if (!open) return res.status(409).json({ error: "No open attendance record" });

    const updated = await prisma.tbl_Attendance.update({
      where: { id: open.id },
      data: { checkOut: new Date() },
    });
    return res.json(updated);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post(
  "/Api/HRMS/Attendance/Photo",
  requireAuth,
  checkRole([2]),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const uploaded = (req as any).file as { filename?: string } | undefined;
      if (!uploaded?.filename) return res.status(400).json({ error: "file is required" });
      const relPath = `/uploads/${uploaded.filename}`;
      const absUrl = `${req.protocol}://${req.get("host")}${relPath}`;
      return res.status(201).json({ url: absUrl, path: relPath });
    } catch (e) {
      return next(e);
    }
  }
);

// ---------- Overtime ----------

hrmsRouter.get("/Api/HRMS/Overtime/me", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rows = (await prisma.$queryRawUnsafe(
      "SELECT TOP (1000) id, workerId, workDate, hours, reason, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Overtime_Request WHERE workerId=@P1 ORDER BY id DESC",
      userKey
    )) as any[];

    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post("/Api/HRMS/Overtime/Request", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rawDate = (req.body?.workDate ?? req.body?.date ?? "").toString();
    const workDate = rawDate ? new Date(String(rawDate)) : null;
    const hours = Number(req.body?.hours ?? 0);
    const reason = (req.body?.reason ?? "").toString();
    if (!workDate || isNaN(workDate.getTime())) return res.status(400).json({ error: "workDate is required" });
    if (!Number.isFinite(hours) || hours <= 0) return res.status(400).json({ error: "hours is required" });

    const dStr = workDate.toISOString().slice(0, 10);
    const rows = (await prisma.$queryRawUnsafe(
      "INSERT INTO dbo.Tbl_HRMS_Overtime_Request(workerId, workDate, hours, reason) OUTPUT INSERTED.id, INSERTED.workerId, INSERTED.workDate, INSERTED.hours, INSERTED.reason, INSERTED.status, INSERTED.createdOn VALUES (@P1, CAST(@P2 AS DATE), @P3, @P4)",
      userKey,
      dStr,
      hours,
      reason
    )) as any[];

    return res.json((rows ?? [])[0] ?? null);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.get("/Api/HRMS/Overtime", requireAuth, checkRole([1, 3, 4]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const roleId = Number((req as any).user?.roleId ?? 0);
    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: roleId === 1 ? {} : scopeWhere,
      select: { Worker_Id: true, Name: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (roleId !== 1 && !workerIds.length) return res.json([]);

    const limit = Math.min(500, Math.max(1, Number((Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit) ?? 200)));

    const rows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT TOP (@P1) id, workerId, workDate, hours, reason, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Overtime_Request ORDER BY id DESC"
        : `SELECT TOP (@P1) id, workerId, workDate, hours, reason, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Overtime_Request WHERE workerId IN (${workerIds
            .map((_, i) => `@P${i + 2}`)
            .join(",")}) ORDER BY id DESC`,
      limit,
      ...(roleId === 1 ? [] : workerIds)
    )) as any[];

    const nameById = new Map<string, string | null>();
    for (const w of scopedWorkers ?? []) {
      const id = (w.Worker_Id ?? "").toString();
      if (id) nameById.set(id, w.Name ?? null);
    }

    const ids = Array.from(new Set((rows ?? []).map((r) => Number(r?.id ?? 0)).filter((x) => Number.isFinite(x) && x > 0)));
    let attByClaim = new Map<number, any[]>();
    if (ids.length) {
      const attRows = (await prisma.$queryRawUnsafe(
        `SELECT id, claimId, filePath, originalName, mimeType, fileSize, createdOn FROM dbo.Tbl_HRMS_Expense_Attachment WHERE claimId IN (${ids
          .map((_, i) => `@P${i + 1}`)
          .join(",")}) ORDER BY id DESC`,
        ...ids
      )) as any[];
      attByClaim = new Map<number, any[]>();
      for (const a of attRows ?? []) {
        const claimId = Number(a?.claimId ?? 0);
        if (!attByClaim.has(claimId)) attByClaim.set(claimId, []);
        attByClaim.get(claimId)!.push({
          id: a.id,
          claimId: a.claimId,
          url: a.filePath,
          filePath: a.filePath,
          originalName: a.originalName ?? null,
          mimeType: a.mimeType ?? null,
          fileSize: a.fileSize ?? null,
          createdOn: a.createdOn,
        });
      }
    }

    return res.json(
      (rows ?? []).map((r) => ({
        ...r,
        workerName: nameById.get((r.workerId ?? "").toString()) ?? null,
        attachments: attByClaim.get(Number(r?.id ?? 0)) ?? [],
      }))
    );
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post("/Api/HRMS/Overtime/Decision", requireAuth, checkRole([1, 3, 4]), requireActivePlanForWrite, async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const id = Number(req.body?.id ?? 0);
    const status = (req.body?.status ?? "").toString();
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id is required" });
    if (status !== "Approved" && status !== "Rejected") return res.status(400).json({ error: "Invalid status" });

    const row = (await prisma.$queryRawUnsafe(
      "SELECT TOP (1) id, workerId FROM dbo.Tbl_HRMS_Overtime_Request WHERE id=@P1",
      id
    )) as any[];
    const workerId = (row?.[0]?.workerId ?? "").toString();
    if (!workerId) return res.status(404).json({ error: "Not found" });

    const roleId = Number((req as any).user?.roleId ?? 0);
    if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere((req as any).user);
      const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
      if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
    }

    const decisionBy = ((req as any).user?.userKey ?? "").toString().trim() || "approver";
    await prisma.$executeRawUnsafe(
      "UPDATE dbo.Tbl_HRMS_Overtime_Request SET status=@P1, decisionBy=@P2, decisionOn=GETDATE() WHERE id=@P3",
      status,
      decisionBy,
      id
    );

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

// ---------- Expense claims ----------

hrmsRouter.post("/Api/HRMS/Expenses/Claim", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rawDate = (req.body?.claimDate ?? req.body?.date ?? "").toString();
    const claimDate = rawDate ? new Date(String(rawDate)) : null;
    const amount = Number(req.body?.amount ?? 0);
    const category = (req.body?.category ?? "").toString();
    const description = (req.body?.description ?? "").toString();
    if (!claimDate || isNaN(claimDate.getTime())) return res.status(400).json({ error: "claimDate is required" });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "amount is required" });

    const dStr = claimDate.toISOString().slice(0, 10);
    const rows = (await prisma.$queryRawUnsafe(
      "INSERT INTO dbo.Tbl_HRMS_Expense_Claim(workerId, claimDate, amount, category, description) OUTPUT INSERTED.id, INSERTED.workerId, INSERTED.claimDate, INSERTED.amount, INSERTED.category, INSERTED.description, INSERTED.status, INSERTED.createdOn VALUES (@P1, CAST(@P2 AS DATE), @P3, @P4, @P5)",
      userKey,
      dStr,
      amount,
      category,
      description
    )) as any[];

    return res.json((rows ?? [])[0] ?? null);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post(
  "/Api/HRMS/Expenses/:id/Attachments",
  requireAuth,
  checkRole([2]),
  upload.array("files", 5),
  async (req, res, next) => {
    try {
      await ensureHrmsRequestTablesExist();

      const id = Number(req.params?.id ?? 0);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid claim id" });

      const userKey = ((req as any).user?.userKey ?? "").toString().trim();
      if (!userKey) return res.status(400).json({ error: "Missing worker id" });

      const claim = (await prisma.$queryRawUnsafe(
        "SELECT TOP (1) id, workerId FROM dbo.Tbl_HRMS_Expense_Claim WHERE id=@P1",
        id
      )) as any[];
      const claimWorkerId = (claim?.[0]?.workerId ?? "").toString();
      if (!claimWorkerId) return res.status(404).json({ error: "Claim not found" });
      if (claimWorkerId !== userKey) return res.status(403).json({ error: "Forbidden" });

      const files = ((req as any).files ?? []) as Array<{ filename?: string; originalname?: string; mimetype?: string; size?: number }>;
      if (!files.length) return res.status(400).json({ error: "No files uploaded" });

      const inserted: any[] = [];
      for (const f of files) {
        if (!f?.filename) continue;
        const filePath = `/uploads/${f.filename}`;
        const rows = (await prisma.$queryRawUnsafe(
          "INSERT INTO dbo.Tbl_HRMS_Expense_Attachment(claimId, filePath, originalName, mimeType, fileSize) OUTPUT INSERTED.id, INSERTED.claimId, INSERTED.filePath, INSERTED.originalName, INSERTED.mimeType, INSERTED.fileSize, INSERTED.createdOn VALUES (@P1, @P2, @P3, @P4, @P5)",
          id,
          filePath,
          (f.originalname ?? "").toString(),
          (f.mimetype ?? "").toString(),
          Number(f.size ?? 0)
        )) as any[];
        if (rows?.[0]) inserted.push(rows[0]);
      }

      return res.json({ ok: true, attachments: inserted });
    } catch (e) {
      return next(e);
    }
  }
);

hrmsRouter.get("/Api/HRMS/Expenses/me", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rows = (await prisma.$queryRawUnsafe(
      "SELECT TOP (1000) id, workerId, claimDate, amount, category, description, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Expense_Claim WHERE workerId=@P1 ORDER BY id DESC",
      userKey
    )) as any[];

    const ids = Array.from(new Set((rows ?? []).map((r) => Number(r?.id ?? 0)).filter((x) => Number.isFinite(x) && x > 0)));
    let attByClaim = new Map<number, any[]>();
    if (ids.length) {
      const attRows = (await prisma.$queryRawUnsafe(
        `SELECT id, claimId, filePath, originalName, mimeType, fileSize, createdOn FROM dbo.Tbl_HRMS_Expense_Attachment WHERE claimId IN (${ids
          .map((_, i) => `@P${i + 1}`)
          .join(",")}) ORDER BY id DESC`,
        ...ids
      )) as any[];
      attByClaim = new Map<number, any[]>();
      for (const a of attRows ?? []) {
        const claimId = Number(a?.claimId ?? 0);
        if (!attByClaim.has(claimId)) attByClaim.set(claimId, []);
        attByClaim.get(claimId)!.push({
          id: a.id,
          claimId: a.claimId,
          url: a.filePath,
          filePath: a.filePath,
          originalName: a.originalName ?? null,
          mimeType: a.mimeType ?? null,
          fileSize: a.fileSize ?? null,
          createdOn: a.createdOn,
        });
      }
    }

    return res.json((rows ?? []).map((r) => ({ ...r, attachments: attByClaim.get(Number(r?.id ?? 0)) ?? [] })));
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.get("/Api/HRMS/Expenses", requireAuth, checkRole([1, 3, 4]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const roleId = Number((req as any).user?.roleId ?? 0);
    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: roleId === 1 ? {} : scopeWhere,
      select: { Worker_Id: true, Name: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (roleId !== 1 && !workerIds.length) return res.json([]);

    const limit = Math.min(500, Math.max(1, Number((Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit) ?? 200)));

    const rows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT TOP (@P1) id, workerId, claimDate, amount, category, description, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Expense_Claim ORDER BY id DESC"
        : `SELECT TOP (@P1) id, workerId, claimDate, amount, category, description, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Expense_Claim WHERE workerId IN (${workerIds
            .map((_, i) => `@P${i + 2}`)
            .join(",")}) ORDER BY id DESC`,
      limit,
      ...(roleId === 1 ? [] : workerIds)
    )) as any[];

    const nameById = new Map<string, string | null>();
    for (const w of scopedWorkers ?? []) {
      const id = (w.Worker_Id ?? "").toString();
      if (id) nameById.set(id, w.Name ?? null);
    }

    return res.json(
      (rows ?? []).map((r) => ({
        ...r,
        workerName: nameById.get((r.workerId ?? "").toString()) ?? null,
      }))
    );
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post("/Api/HRMS/Expenses/Decision", requireAuth, checkRole([1, 3, 4]), requireActivePlanForWrite, async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const id = Number(req.body?.id ?? 0);
    const status = (req.body?.status ?? "").toString();
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id is required" });
    if (status !== "Approved" && status !== "Rejected") return res.status(400).json({ error: "Invalid status" });

    const row = (await prisma.$queryRawUnsafe(
      "SELECT TOP (1) id, workerId FROM dbo.Tbl_HRMS_Expense_Claim WHERE id=@P1",
      id
    )) as any[];
    const workerId = (row?.[0]?.workerId ?? "").toString();
    if (!workerId) return res.status(404).json({ error: "Not found" });

    const roleId = Number((req as any).user?.roleId ?? 0);
    if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere((req as any).user);
      const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
      if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
    }

    const decisionBy = ((req as any).user?.userKey ?? "").toString().trim() || "approver";
    await prisma.$executeRawUnsafe(
      "UPDATE dbo.Tbl_HRMS_Expense_Claim SET status=@P1, decisionBy=@P2, decisionOn=GETDATE() WHERE id=@P3",
      status,
      decisionBy,
      id
    );

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

// ---------- Leave ----------

hrmsRouter.get("/Api/HRMS/Leave", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);

    if (roleId === 2) {
      const userKey = ((req as any).user?.userKey ?? "").toString().trim();
      const rows = await prisma.tbl_Leave.findMany({
        where: { workerId: userKey },
        orderBy: [{ id: "desc" }],
        take: 500,
      });
      return res.json(rows ?? []);
    }

    if (![1, 3, 4].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (!workerIds.length) return res.json([]);

    const rows = await prisma.tbl_Leave.findMany({
      where: { workerId: { in: workerIds } },
      orderBy: [{ id: "desc" }],
      take: 1000,
    });
    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post("/Api/HRMS/Leave/Apply", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const leaveType = (req.body?.leaveType ?? "").toString().trim();
    const startDateRaw = req.body?.startDate;
    const endDateRaw = req.body?.endDate;
    const startDate = startDateRaw ? new Date(String(startDateRaw)) : null;
    const endDate = endDateRaw ? new Date(String(endDateRaw)) : null;
    if (!leaveType || !startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "leaveType, startDate, endDate are required" });
    }

    const created = await prisma.tbl_Leave.create({
      data: {
        workerId: userKey,
        leaveType,
        startDate,
        endDate,
        status: "Pending",
      },
    });
    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post("/Api/HRMS/Leave/Decision", requireAuth, requireActivePlanForWrite, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    const id = Number(req.body?.id ?? 0);
    const decision = (req.body?.status ?? "").toString().trim();
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id is required" });
    if (decision !== "Approved" && decision !== "Rejected") return res.status(400).json({ error: "Invalid status" });

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));

    const row = await prisma.tbl_Leave.findFirst({ where: { id } });
    if (!row) return res.status(404).json({ error: "Not found" });
    if (roleId !== 1 && !workerIds.has((row.workerId ?? "").toString())) return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.tbl_Leave.update({ where: { id }, data: { status: decision } });

    try {
      getIO().to("authorities").emit("new_trigger", {
        id: updated.id,
        title: `Leave ${decision}`,
        description: `Leave request ${decision} for worker ${String(updated.workerId ?? "")}`,
        workerId: updated.workerId ?? null,
        companyName: null,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // ignore emit errors
    }

    return res.json(updated);
  } catch (e) {
    return next(e);
  }
});

// ---------- Payroll ----------

// Worker-scoped read of own payroll history. Workers (roleId === 2) only see
// their own rows.
hrmsRouter.get("/Api/HRMS/Payroll/Mine", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (roleId !== 2) return res.status(403).json({ error: "Forbidden" });

    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rows = await prisma.tbl_Payroll.findMany({
      where: { workerId: userKey },
      orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
      take: 200,
    });
    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.get("/Api/HRMS/Payroll", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (!workerIds.length) return res.json([]);

    const rows = await prisma.tbl_Payroll.findMany({
      where: { workerId: { in: workerIds } },
      orderBy: [{ id: "desc" }],
      take: 1000,
    });
    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post("/Api/HRMS/Payroll/Upload", requireAuth, requireActivePlanForWrite, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    const workerId = (req.body?.workerId ?? "").toString().trim();
    const month = Number(req.body?.month ?? 0);
    const year = Number(req.body?.year ?? 0);
    const amount = Number(req.body?.amount ?? 0);
    const voucherUrl = (req.body?.voucherUrl ?? "").toString().trim();
    const isPaid = req.body?.isPaid != null ? Boolean(req.body.isPaid) : false;
    if (!workerId || !Number.isFinite(month) || !Number.isFinite(year)) {
      return res.status(400).json({ error: "workerId, month, year are required" });
    }

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
    if (roleId !== 1 && !scopedWorker) return res.status(403).json({ error: "Forbidden" });

    const created = await prisma.tbl_Payroll.create({
      data: {
        workerId,
        month,
        year,
        amount: Number.isFinite(amount) ? amount : 0,
        voucherUrl: voucherUrl || null,
        isPaid,
      } as any,
    });

    try {
      getIO().to("authorities").emit("new_trigger", {
        id: created.id,
        title: "Payroll uploaded",
        description: `Payroll uploaded for worker ${workerId} (${month}/${year})`,
        workerId,
        companyName: null,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // ignore emit errors
    }

    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});
