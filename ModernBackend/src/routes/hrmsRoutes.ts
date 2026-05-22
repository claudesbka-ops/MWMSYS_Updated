import { Router } from "express";

import { prisma } from "../db";
import { checkRole, requireAuth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { requireActivePlanForWrite } from "../middleware/subscription";
import { ensureGeofenceAttendanceColumn, ensureHrmsRequestTablesExist, ensureOvertimeColumns, ensureRosterTablesExist } from "../db/schemaMigrations";
import { checkGeofences } from "./geofenceRoutes";
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
        whereParts.push(`(r."workerId"=$${p} AND r."date"=CAST($${p + 1} AS DATE))`);
        params.push(pair.workerId, pair.dateStr);
        p += 2;
      }

      const q =
        `SELECT r."workerId", r."date" as d, s."startTime", s."endTime" ` +
        `FROM "Tbl_Roster_Assignment" r LEFT JOIN "Tbl_Shift_Template" s ON s.id=r."shiftId" ` +
        (whereParts.length ? `WHERE ${whereParts.join(" OR ")} ` : "") +
        `LIMIT 50000`;

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
    const gpsAvailable = lat != null && Number.isFinite(lat) && lng != null && Number.isFinite(lng);

    // Create attendance record first — clock-in is NEVER blocked
    const created = await prisma.tbl_Attendance.create({
      data: {
        workerId: userKey,
        checkIn: new Date(),
        checkOut: null,
        lat: gpsAvailable ? lat : null,
        lng: gpsAvailable ? lng : null,
        photoUrl,
      } as any,
    });

    // Geofence check — only when GPS coordinates are present
    if (gpsAvailable) {
      try {
        await ensureGeofenceAttendanceColumn();

        // Find the worker's current employer
        const empRow = await prisma.tbl_Worker_EmployerInfo.findFirst({
          where: { Worker_Id: userKey },
          select: { Employer_Id: true },
        });
        const employerId = (empRow?.Employer_Id ?? "").toString().trim();

        if (employerId) {
          const { withinAny } = await checkGeofences(employerId, lat!, lng!);

          // Stamp Is_Within_Geofence on the attendance row (informational only)
          await prisma.$executeRawUnsafe(
            `UPDATE "Tbl_Attendance" SET "Is_Within_Geofence"=$1 WHERE id=$2`,
            withinAny, Number(created.id)
          );

          if (!withinAny) {
            // Notify employer + admin — clock-in still succeeded above
            const io = getIO();
            const payload = {
              type: "geofence_violation",
              workerId: userKey,
              employerId,
              lat,
              lng,
              timestamp: new Date().toISOString(),
            };
            io.to(`employer_${employerId}`).emit("geofence_violation", payload);
            io.to("admin").emit("geofence_violation", payload);
          }
        }
      } catch {
        // Geofence check failure must never prevent a successful clock-in response
      }
    }

    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.post("/Api/HRMS/Attendance/ClockOut", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const lat = req.body?.lat != null ? Number(req.body.lat) : null;
    const lng = req.body?.lng != null ? Number(req.body.lng) : null;

    const open = await prisma.tbl_Attendance.findFirst({
      where: { workerId: userKey, checkOut: null },
      orderBy: [{ id: "desc" }],
    });

    if (!open) return res.status(409).json({ error: "No open attendance record" });

    await ensureOvertimeColumns();

    const checkIn = open.checkIn ? new Date(open.checkIn) : null;
    const checkOut = new Date();
    let hoursWorked: number | null = null;
    const status = "present";

    if (checkIn) {
      const diffMs = checkOut.getTime() - checkIn.getTime();
      hoursWorked = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    }

    const STANDARD_HOURS = 8;
    const dayOfWeek = checkOut.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hw = hoursWorked ?? 0;
    const overtimeHours = isWeekend
      ? Number(hw.toFixed(2))
      : Number(Math.max(0, hw - STANDARD_HOURS).toFixed(2));
    const isOvertime = isWeekend || hw > STANDARD_HOURS;

    await prisma.$executeRawUnsafe(
      `UPDATE "Tbl_Attendance" SET "checkOut"=$1, "clockOutLat"=$2, "clockOutLng"=$3, "hoursWorked"=$4, status=$5, "Is_Overtime"=$6, "Overtime_Hours"=$7, "Is_Weekend"=$8 WHERE id=$9`,
      checkOut,
      lat,
      lng,
      hoursWorked,
      status,
      isOvertime,
      overtimeHours,
      isWeekend,
      open.id
    );

    const updated = await prisma.tbl_Attendance.findFirst({ where: { id: open.id } });
    return res.json(updated);
  } catch (e) {
    return next(e);
  }
});

hrmsRouter.get("/Api/HRMS/Shifts/OvertimeSummary", requireAuth, checkRole([1, 3, 4]), async (req, res, next) => {
  try {
    await ensureOvertimeColumns();

    const roleId = Number((req as any).user?.roleId ?? 0);
    const monthParam = ((Array.isArray(req.query.month) ? req.query.month[0] : req.query.month) ?? "").toString().trim();

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: roleId === 1 ? {} : scopeWhere,
      select: { Worker_Id: true, Name: true },
      take: 5000,
    });
    const nameById = new Map<string, string | null>();
    for (const w of scopedWorkers ?? []) nameById.set((w.Worker_Id ?? "").toString(), w.Name ?? null);
    const workerIds = Array.from(nameById.keys());
    if (roleId !== 1 && !workerIds.length) return res.json([]);

    let dateFilter = "";
    const params: any[] = roleId === 1 ? [] : workerIds;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const paramIdx = params.length + 1;
      dateFilter = ` AND TO_CHAR("checkIn", 'YYYY-MM') = $${paramIdx}`;
      params.push(monthParam);
    }

    const rows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? `SELECT "workerId",
             COALESCE(SUM(CASE WHEN "Is_Overtime" = FALSE AND "Is_Weekend" = FALSE THEN LEAST("hoursWorked", 8) ELSE 0 END), 0) AS "regularHours",
             COALESCE(SUM(CASE WHEN "Is_Overtime" = TRUE AND "Is_Weekend" = FALSE THEN "Overtime_Hours" ELSE 0 END), 0) AS "overtimeHours",
             COALESCE(SUM(CASE WHEN "Is_Weekend" = TRUE THEN "Overtime_Hours" ELSE 0 END), 0) AS "weekendHours",
             COALESCE(SUM("hoursWorked"), 0) AS "totalHours"
           FROM "Tbl_Attendance"
           WHERE "checkOut" IS NOT NULL${dateFilter}
           GROUP BY "workerId" ORDER BY "totalHours" DESC LIMIT 500`
        : `SELECT "workerId",
             COALESCE(SUM(CASE WHEN "Is_Overtime" = FALSE AND "Is_Weekend" = FALSE THEN LEAST("hoursWorked", 8) ELSE 0 END), 0) AS "regularHours",
             COALESCE(SUM(CASE WHEN "Is_Overtime" = TRUE AND "Is_Weekend" = FALSE THEN "Overtime_Hours" ELSE 0 END), 0) AS "overtimeHours",
             COALESCE(SUM(CASE WHEN "Is_Weekend" = TRUE THEN "Overtime_Hours" ELSE 0 END), 0) AS "weekendHours",
             COALESCE(SUM("hoursWorked"), 0) AS "totalHours"
           FROM "Tbl_Attendance"
           WHERE "checkOut" IS NOT NULL AND "workerId" IN (${workerIds.map((_, i) => `$${i + 1}`).join(",")})${dateFilter}
           GROUP BY "workerId" ORDER BY "totalHours" DESC LIMIT 500`,
      ...params
    )) as any[];

    return res.json(
      (rows ?? []).map((r) => ({
        workerId: r.workerId,
        name: nameById.get((r.workerId ?? "").toString()) ?? null,
        regularHours: Number(r.regularHours ?? 0),
        overtimeHours: Number(r.overtimeHours ?? 0),
        weekendHours: Number(r.weekendHours ?? 0),
        totalHours: Number(r.totalHours ?? 0),
      }))
    );
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
      `SELECT id, "workerId", "workDate", hours, reason, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Overtime_Request" WHERE "workerId"=$1 ORDER BY id DESC LIMIT 1000`,
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
      `INSERT INTO "Tbl_HRMS_Overtime_Request"("workerId", "workDate", hours, reason) VALUES ($1, CAST($2 AS DATE), $3, $4) RETURNING id, "workerId", "workDate", hours, reason, status, "createdOn"`,
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
        ? `SELECT id, "workerId", "workDate", hours, reason, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Overtime_Request" ORDER BY id DESC LIMIT $1`
        : `SELECT id, "workerId", "workDate", hours, reason, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Overtime_Request" WHERE "workerId" IN (${workerIds
            .map((_, i) => `$${i + 2}`)
            .join(",")}) ORDER BY id DESC LIMIT $1`,
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
        `SELECT id, "claimId", "filePath", "originalName", "mimeType", "fileSize", "createdOn" FROM "Tbl_HRMS_Expense_Attachment" WHERE "claimId" IN (${ids
          .map((_, i) => `$${i + 1}`)
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
      `SELECT id, "workerId" FROM "Tbl_HRMS_Overtime_Request" WHERE id=$1 LIMIT 1`,
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
      `UPDATE "Tbl_HRMS_Overtime_Request" SET status=$1, "decisionBy"=$2, "decisionOn"=NOW() WHERE id=$3`,
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
      `INSERT INTO "Tbl_HRMS_Expense_Claim"("workerId", "claimDate", amount, category, description) VALUES ($1, CAST($2 AS DATE), $3, $4, $5) RETURNING id, "workerId", "claimDate", amount, category, description, status, "createdOn"`,
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
        `SELECT id, "workerId" FROM "Tbl_HRMS_Expense_Claim" WHERE id=$1 LIMIT 1`,
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
          `INSERT INTO "Tbl_HRMS_Expense_Attachment"("claimId", "filePath", "originalName", "mimeType", "fileSize") VALUES ($1, $2, $3, $4, $5) RETURNING id, "claimId", "filePath", "originalName", "mimeType", "fileSize", "createdOn"`,
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
      `SELECT id, "workerId", "claimDate", amount, category, description, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Expense_Claim" WHERE "workerId"=$1 ORDER BY id DESC LIMIT 1000`,
      userKey
    )) as any[];

    const ids = Array.from(new Set((rows ?? []).map((r) => Number(r?.id ?? 0)).filter((x) => Number.isFinite(x) && x > 0)));
    let attByClaim = new Map<number, any[]>();
    if (ids.length) {
      const attRows = (await prisma.$queryRawUnsafe(
        `SELECT id, "claimId", "filePath", "originalName", "mimeType", "fileSize", "createdOn" FROM "Tbl_HRMS_Expense_Attachment" WHERE "claimId" IN (${ids
          .map((_, i) => `$${i + 1}`)
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
        ? `SELECT id, "workerId", "claimDate", amount, category, description, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Expense_Claim" ORDER BY id DESC LIMIT $1`
        : `SELECT id, "workerId", "claimDate", amount, category, description, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Expense_Claim" WHERE "workerId" IN (${workerIds
            .map((_, i) => `$${i + 2}`)
            .join(",")}) ORDER BY id DESC LIMIT $1`,
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
      `SELECT id, "workerId" FROM "Tbl_HRMS_Expense_Claim" WHERE id=$1 LIMIT 1`,
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
      `UPDATE "Tbl_HRMS_Expense_Claim" SET status=$1, "decisionBy"=$2, "decisionOn"=NOW() WHERE id=$3`,
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
