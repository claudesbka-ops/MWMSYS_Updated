"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hrmsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const subscription_1 = require("../middleware/subscription");
const schemaMigrations_1 = require("../db/schemaMigrations");
const queryGuard_1 = require("../services/queryGuard");
const socketService_1 = require("../services/socketService");
exports.hrmsRouter = (0, express_1.Router)();
// ---------- Attendance ----------
exports.hrmsRouter.get("/Api/HRMS/Attendance", auth_1.requireAuth, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (![1, 3, 4, 5, 6, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        await (0, schemaMigrations_1.ensureRosterTablesExist)();
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true },
            take: 5000,
        });
        const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
        if (!workerIds.length)
            return res.json([]);
        const rows = await db_1.prisma.tbl_Attendance.findMany({
            where: { workerId: { in: workerIds } },
            orderBy: [{ id: "desc" }],
            take: 1000,
        });
        const attendanceRows = (rows ?? []);
        const keyPairs = [];
        for (const r of attendanceRows) {
            const workerId = (r?.workerId ?? "").toString();
            const d = r?.checkIn ? new Date(r.checkIn) : null;
            if (!workerId || !d || isNaN(d.getTime()))
                continue;
            keyPairs.push({ workerId, dateStr: d.toISOString().slice(0, 10) });
        }
        const uniqueKey = new Set(keyPairs.map((k) => `${k.workerId}__${k.dateStr}`));
        const pairs = Array.from(uniqueKey).map((x) => {
            const [workerId, dateStr] = x.split("__");
            return { workerId, dateStr };
        });
        const shiftByWorkerDay = new Map();
        if (pairs.length) {
            const whereParts = [];
            const params = [];
            let p = 1;
            for (const pair of pairs) {
                whereParts.push(`(r."workerId"=$${p} AND r."date"=CAST($${p + 1} AS DATE))`);
                params.push(pair.workerId, pair.dateStr);
                p += 2;
            }
            const q = `SELECT r."workerId", r."date" as d, s."startTime", s."endTime" ` +
                `FROM "Tbl_Roster_Assignment" r LEFT JOIN "Tbl_Shift_Template" s ON s.id=r."shiftId" ` +
                (whereParts.length ? `WHERE ${whereParts.join(" OR ")} ` : "") +
                `LIMIT 50000`;
            const roster = (await db_1.prisma.$queryRawUnsafe(q, ...params));
            for (const rr of roster ?? []) {
                const workerId = (rr.workerId ?? "").toString();
                const d = rr.d ? new Date(rr.d) : null;
                const dateStr = d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
                if (!workerId || !dateStr)
                    continue;
                shiftByWorkerDay.set(`${workerId}__${dateStr}`, {
                    startTime: rr.startTime != null ? String(rr.startTime) : null,
                    endTime: rr.endTime != null ? String(rr.endTime) : null,
                });
            }
        }
        const graceMinutes = 5;
        const parseTime = (t) => {
            if (!t)
                return null;
            const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
            if (!m)
                return null;
            const hh = Number(m[1]);
            const mm = Number(m[2]);
            if (!Number.isFinite(hh) || !Number.isFinite(mm))
                return null;
            return { hh, mm };
        };
        const withFlags = attendanceRows.map((r) => {
            const checkIn = r?.checkIn ? new Date(r.checkIn) : null;
            const checkOut = r?.checkOut ? new Date(r.checkOut) : null;
            const dateStr = checkIn && !isNaN(checkIn.getTime()) ? checkIn.toISOString().slice(0, 10) : "";
            const shift = dateStr ? shiftByWorkerDay.get(`${String(r.workerId)}__${dateStr}`) : undefined;
            const start = parseTime(shift?.startTime ?? null);
            const end = parseTime(shift?.endTime ?? null);
            let plannedStart = null;
            let plannedEnd = null;
            if (dateStr && start) {
                plannedStart = new Date(`${dateStr}T00:00:00.000Z`);
                plannedStart.setUTCHours(start.hh, start.mm, 0, 0);
            }
            if (dateStr && end) {
                plannedEnd = new Date(`${dateStr}T00:00:00.000Z`);
                plannedEnd.setUTCHours(end.hh, end.mm, 0, 0);
            }
            const workedHours = checkIn && checkOut && !isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())
                ? Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 36e5)
                : 0;
            const lateMinutes = plannedStart && checkIn
                ? Math.max(0, Math.round((checkIn.getTime() - plannedStart.getTime()) / 60000) - graceMinutes)
                : 0;
            const earlyLeaveMinutes = plannedEnd && checkOut
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
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.get("/Api/HRMS/Attendance/me", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
    try {
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const rows = await db_1.prisma.tbl_Attendance.findMany({
            where: { workerId: userKey },
            orderBy: [{ id: "desc" }],
            take: 200,
        });
        return res.json(rows ?? []);
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.post("/Api/HRMS/Attendance/ClockIn", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
    try {
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const lat = req.body?.lat != null ? Number(req.body.lat) : null;
        const lng = req.body?.lng != null ? Number(req.body.lng) : null;
        const photoUrl = (req.body?.photoUrl ?? null) != null ? String(req.body.photoUrl) : null;
        const created = await db_1.prisma.tbl_Attendance.create({
            data: {
                workerId: userKey,
                checkIn: new Date(),
                checkOut: null,
                lat: lat != null && Number.isFinite(lat) ? lat : null,
                lng: lng != null && Number.isFinite(lng) ? lng : null,
                photoUrl,
            },
        });
        return res.status(201).json(created);
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.post("/Api/HRMS/Attendance/ClockOut", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
    try {
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const lat = req.body?.lat != null ? Number(req.body.lat) : null;
        const lng = req.body?.lng != null ? Number(req.body.lng) : null;
        const open = await db_1.prisma.tbl_Attendance.findFirst({
            where: { workerId: userKey, checkOut: null },
            orderBy: [{ id: "desc" }],
        });
        if (!open)
            return res.status(409).json({ error: "No open attendance record" });
        // Calculate hours worked
        const checkIn = open.checkIn ? new Date(open.checkIn) : null;
        const checkOut = new Date();
        let hoursWorked = null;
        let status = 'present';
        if (checkIn) {
            const diffMs = checkOut.getTime() - checkIn.getTime();
            hoursWorked = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
        }
        const updated = await db_1.prisma.tbl_Attendance.update({
            where: { id: open.id },
            data: {
                checkOut: checkOut,
                clockOutLat: lat,
                clockOutLng: lng,
                hoursWorked: hoursWorked,
                status: status,
            },
        });
        return res.json(updated);
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.post("/Api/HRMS/Attendance/Photo", auth_1.requireAuth, (0, auth_1.checkRole)([2]), upload_1.upload.single("file"), async (req, res, next) => {
    try {
        const uploaded = req.file;
        if (!uploaded?.filename)
            return res.status(400).json({ error: "file is required" });
        const relPath = `/uploads/${uploaded.filename}`;
        const absUrl = `${req.protocol}://${req.get("host")}${relPath}`;
        return res.status(201).json({ url: absUrl, path: relPath });
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Overtime ----------
exports.hrmsRouter.get("/Api/HRMS/Overtime/me", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureHrmsRequestTablesExist)();
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const rows = (await db_1.prisma.$queryRawUnsafe(`SELECT id, "workerId", "workDate", hours, reason, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Overtime_Request" WHERE "workerId"=$1 ORDER BY id DESC LIMIT 1000`, userKey));
        return res.json(rows ?? []);
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.post("/Api/HRMS/Overtime/Request", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureHrmsRequestTablesExist)();
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const rawDate = (req.body?.workDate ?? req.body?.date ?? "").toString();
        const workDate = rawDate ? new Date(String(rawDate)) : null;
        const hours = Number(req.body?.hours ?? 0);
        const reason = (req.body?.reason ?? "").toString();
        if (!workDate || isNaN(workDate.getTime()))
            return res.status(400).json({ error: "workDate is required" });
        if (!Number.isFinite(hours) || hours <= 0)
            return res.status(400).json({ error: "hours is required" });
        const dStr = workDate.toISOString().slice(0, 10);
        const rows = (await db_1.prisma.$queryRawUnsafe(`INSERT INTO "Tbl_HRMS_Overtime_Request"("workerId", "workDate", hours, reason) VALUES ($1, CAST($2 AS DATE), $3, $4) RETURNING id, "workerId", "workDate", hours, reason, status, "createdOn"`, userKey, dStr, hours, reason));
        return res.json((rows ?? [])[0] ?? null);
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.get("/Api/HRMS/Overtime", auth_1.requireAuth, (0, auth_1.checkRole)([1, 3, 4]), async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureHrmsRequestTablesExist)();
        const roleId = Number(req.user?.roleId ?? 0);
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: roleId === 1 ? {} : scopeWhere,
            select: { Worker_Id: true, Name: true },
            take: 5000,
        });
        const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
        if (roleId !== 1 && !workerIds.length)
            return res.json([]);
        const limit = Math.min(500, Math.max(1, Number((Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit) ?? 200)));
        const rows = (await db_1.prisma.$queryRawUnsafe(roleId === 1
            ? `SELECT id, "workerId", "workDate", hours, reason, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Overtime_Request" ORDER BY id DESC LIMIT $1`
            : `SELECT id, "workerId", "workDate", hours, reason, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Overtime_Request" WHERE "workerId" IN (${workerIds
                .map((_, i) => `$${i + 2}`)
                .join(",")}) ORDER BY id DESC LIMIT $1`, limit, ...(roleId === 1 ? [] : workerIds)));
        const nameById = new Map();
        for (const w of scopedWorkers ?? []) {
            const id = (w.Worker_Id ?? "").toString();
            if (id)
                nameById.set(id, w.Name ?? null);
        }
        const ids = Array.from(new Set((rows ?? []).map((r) => Number(r?.id ?? 0)).filter((x) => Number.isFinite(x) && x > 0)));
        let attByClaim = new Map();
        if (ids.length) {
            const attRows = (await db_1.prisma.$queryRawUnsafe(`SELECT id, "claimId", "filePath", "originalName", "mimeType", "fileSize", "createdOn" FROM "Tbl_HRMS_Expense_Attachment" WHERE "claimId" IN (${ids
                .map((_, i) => `$${i + 1}`)
                .join(",")}) ORDER BY id DESC`, ...ids));
            attByClaim = new Map();
            for (const a of attRows ?? []) {
                const claimId = Number(a?.claimId ?? 0);
                if (!attByClaim.has(claimId))
                    attByClaim.set(claimId, []);
                attByClaim.get(claimId).push({
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
        return res.json((rows ?? []).map((r) => ({
            ...r,
            workerName: nameById.get((r.workerId ?? "").toString()) ?? null,
            attachments: attByClaim.get(Number(r?.id ?? 0)) ?? [],
        })));
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.post("/Api/HRMS/Overtime/Decision", auth_1.requireAuth, (0, auth_1.checkRole)([1, 3, 4]), subscription_1.requireActivePlanForWrite, async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureHrmsRequestTablesExist)();
        const id = Number(req.body?.id ?? 0);
        const status = (req.body?.status ?? "").toString();
        if (!Number.isFinite(id) || id <= 0)
            return res.status(400).json({ error: "id is required" });
        if (status !== "Approved" && status !== "Rejected")
            return res.status(400).json({ error: "Invalid status" });
        const row = (await db_1.prisma.$queryRawUnsafe(`SELECT id, "workerId" FROM "Tbl_HRMS_Overtime_Request" WHERE id=$1 LIMIT 1`, id));
        const workerId = (row?.[0]?.workerId ?? "").toString();
        if (!workerId)
            return res.status(404).json({ error: "Not found" });
        const roleId = Number(req.user?.roleId ?? 0);
        if (roleId !== 1) {
            const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
            const scopedWorker = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
            if (!scopedWorker)
                return res.status(403).json({ error: "Forbidden" });
        }
        const decisionBy = (req.user?.userKey ?? "").toString().trim() || "approver";
        await db_1.prisma.$executeRawUnsafe(`UPDATE "Tbl_HRMS_Overtime_Request" SET status=$1, "decisionBy"=$2, "decisionOn"=NOW() WHERE id=$3`, status, decisionBy, id);
        return res.json({ ok: true });
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Expense claims ----------
exports.hrmsRouter.post("/Api/HRMS/Expenses/Claim", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureHrmsRequestTablesExist)();
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const rawDate = (req.body?.claimDate ?? req.body?.date ?? "").toString();
        const claimDate = rawDate ? new Date(String(rawDate)) : null;
        const amount = Number(req.body?.amount ?? 0);
        const category = (req.body?.category ?? "").toString();
        const description = (req.body?.description ?? "").toString();
        if (!claimDate || isNaN(claimDate.getTime()))
            return res.status(400).json({ error: "claimDate is required" });
        if (!Number.isFinite(amount) || amount <= 0)
            return res.status(400).json({ error: "amount is required" });
        const dStr = claimDate.toISOString().slice(0, 10);
        const rows = (await db_1.prisma.$queryRawUnsafe(`INSERT INTO "Tbl_HRMS_Expense_Claim"("workerId", "claimDate", amount, category, description) VALUES ($1, CAST($2 AS DATE), $3, $4, $5) RETURNING id, "workerId", "claimDate", amount, category, description, status, "createdOn"`, userKey, dStr, amount, category, description));
        return res.json((rows ?? [])[0] ?? null);
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.post("/Api/HRMS/Expenses/:id/Attachments", auth_1.requireAuth, (0, auth_1.checkRole)([2]), upload_1.upload.array("files", 5), async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureHrmsRequestTablesExist)();
        const id = Number(req.params?.id ?? 0);
        if (!Number.isFinite(id) || id <= 0)
            return res.status(400).json({ error: "Invalid claim id" });
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const claim = (await db_1.prisma.$queryRawUnsafe(`SELECT id, "workerId" FROM "Tbl_HRMS_Expense_Claim" WHERE id=$1 LIMIT 1`, id));
        const claimWorkerId = (claim?.[0]?.workerId ?? "").toString();
        if (!claimWorkerId)
            return res.status(404).json({ error: "Claim not found" });
        if (claimWorkerId !== userKey)
            return res.status(403).json({ error: "Forbidden" });
        const files = (req.files ?? []);
        if (!files.length)
            return res.status(400).json({ error: "No files uploaded" });
        const inserted = [];
        for (const f of files) {
            if (!f?.filename)
                continue;
            const filePath = `/uploads/${f.filename}`;
            const rows = (await db_1.prisma.$queryRawUnsafe(`INSERT INTO "Tbl_HRMS_Expense_Attachment"("claimId", "filePath", "originalName", "mimeType", "fileSize") VALUES ($1, $2, $3, $4, $5) RETURNING id, "claimId", "filePath", "originalName", "mimeType", "fileSize", "createdOn"`, id, filePath, (f.originalname ?? "").toString(), (f.mimetype ?? "").toString(), Number(f.size ?? 0)));
            if (rows?.[0])
                inserted.push(rows[0]);
        }
        return res.json({ ok: true, attachments: inserted });
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.get("/Api/HRMS/Expenses/me", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureHrmsRequestTablesExist)();
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const rows = (await db_1.prisma.$queryRawUnsafe(`SELECT id, "workerId", "claimDate", amount, category, description, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Expense_Claim" WHERE "workerId"=$1 ORDER BY id DESC LIMIT 1000`, userKey));
        const ids = Array.from(new Set((rows ?? []).map((r) => Number(r?.id ?? 0)).filter((x) => Number.isFinite(x) && x > 0)));
        let attByClaim = new Map();
        if (ids.length) {
            const attRows = (await db_1.prisma.$queryRawUnsafe(`SELECT id, "claimId", "filePath", "originalName", "mimeType", "fileSize", "createdOn" FROM "Tbl_HRMS_Expense_Attachment" WHERE "claimId" IN (${ids
                .map((_, i) => `$${i + 1}`)
                .join(",")}) ORDER BY id DESC`, ...ids));
            attByClaim = new Map();
            for (const a of attRows ?? []) {
                const claimId = Number(a?.claimId ?? 0);
                if (!attByClaim.has(claimId))
                    attByClaim.set(claimId, []);
                attByClaim.get(claimId).push({
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
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.get("/Api/HRMS/Expenses", auth_1.requireAuth, (0, auth_1.checkRole)([1, 3, 4]), async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureHrmsRequestTablesExist)();
        const roleId = Number(req.user?.roleId ?? 0);
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: roleId === 1 ? {} : scopeWhere,
            select: { Worker_Id: true, Name: true },
            take: 5000,
        });
        const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
        if (roleId !== 1 && !workerIds.length)
            return res.json([]);
        const limit = Math.min(500, Math.max(1, Number((Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit) ?? 200)));
        const rows = (await db_1.prisma.$queryRawUnsafe(roleId === 1
            ? `SELECT id, "workerId", "claimDate", amount, category, description, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Expense_Claim" ORDER BY id DESC LIMIT $1`
            : `SELECT id, "workerId", "claimDate", amount, category, description, status, "createdOn", "decisionBy", "decisionOn" FROM "Tbl_HRMS_Expense_Claim" WHERE "workerId" IN (${workerIds
                .map((_, i) => `$${i + 2}`)
                .join(",")}) ORDER BY id DESC LIMIT $1`, limit, ...(roleId === 1 ? [] : workerIds)));
        const nameById = new Map();
        for (const w of scopedWorkers ?? []) {
            const id = (w.Worker_Id ?? "").toString();
            if (id)
                nameById.set(id, w.Name ?? null);
        }
        return res.json((rows ?? []).map((r) => ({
            ...r,
            workerName: nameById.get((r.workerId ?? "").toString()) ?? null,
        })));
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.post("/Api/HRMS/Expenses/Decision", auth_1.requireAuth, (0, auth_1.checkRole)([1, 3, 4]), subscription_1.requireActivePlanForWrite, async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureHrmsRequestTablesExist)();
        const id = Number(req.body?.id ?? 0);
        const status = (req.body?.status ?? "").toString();
        if (!Number.isFinite(id) || id <= 0)
            return res.status(400).json({ error: "id is required" });
        if (status !== "Approved" && status !== "Rejected")
            return res.status(400).json({ error: "Invalid status" });
        const row = (await db_1.prisma.$queryRawUnsafe(`SELECT id, "workerId" FROM "Tbl_HRMS_Expense_Claim" WHERE id=$1 LIMIT 1`, id));
        const workerId = (row?.[0]?.workerId ?? "").toString();
        if (!workerId)
            return res.status(404).json({ error: "Not found" });
        const roleId = Number(req.user?.roleId ?? 0);
        if (roleId !== 1) {
            const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
            const scopedWorker = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
            if (!scopedWorker)
                return res.status(403).json({ error: "Forbidden" });
        }
        const decisionBy = (req.user?.userKey ?? "").toString().trim() || "approver";
        await db_1.prisma.$executeRawUnsafe(`UPDATE "Tbl_HRMS_Expense_Claim" SET status=$1, "decisionBy"=$2, "decisionOn"=NOW() WHERE id=$3`, status, decisionBy, id);
        return res.json({ ok: true });
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Leave ----------
exports.hrmsRouter.get("/Api/HRMS/Leave", auth_1.requireAuth, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (roleId === 2) {
            const userKey = (req.user?.userKey ?? "").toString().trim();
            const rows = await db_1.prisma.tbl_Leave.findMany({
                where: { workerId: userKey },
                orderBy: [{ id: "desc" }],
                take: 500,
            });
            return res.json(rows ?? []);
        }
        if (![1, 3, 4].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true },
            take: 5000,
        });
        const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
        if (!workerIds.length)
            return res.json([]);
        const rows = await db_1.prisma.tbl_Leave.findMany({
            where: { workerId: { in: workerIds } },
            orderBy: [{ id: "desc" }],
            take: 1000,
        });
        return res.json(rows ?? []);
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.post("/Api/HRMS/Leave/Apply", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
    try {
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const leaveType = (req.body?.leaveType ?? "").toString().trim();
        const startDateRaw = req.body?.startDate;
        const endDateRaw = req.body?.endDate;
        const startDate = startDateRaw ? new Date(String(startDateRaw)) : null;
        const endDate = endDateRaw ? new Date(String(endDateRaw)) : null;
        if (!leaveType || !startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: "leaveType, startDate, endDate are required" });
        }
        const created = await db_1.prisma.tbl_Leave.create({
            data: {
                workerId: userKey,
                leaveType,
                startDate,
                endDate,
                status: "Pending",
            },
        });
        return res.status(201).json(created);
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.post("/Api/HRMS/Leave/Decision", auth_1.requireAuth, subscription_1.requireActivePlanForWrite, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (![1, 3, 4].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const id = Number(req.body?.id ?? 0);
        const decision = (req.body?.status ?? "").toString().trim();
        if (!Number.isFinite(id) || id <= 0)
            return res.status(400).json({ error: "id is required" });
        if (decision !== "Approved" && decision !== "Rejected")
            return res.status(400).json({ error: "Invalid status" });
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true },
            take: 5000,
        });
        const workerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));
        const row = await db_1.prisma.tbl_Leave.findFirst({ where: { id } });
        if (!row)
            return res.status(404).json({ error: "Not found" });
        if (roleId !== 1 && !workerIds.has((row.workerId ?? "").toString()))
            return res.status(403).json({ error: "Forbidden" });
        const updated = await db_1.prisma.tbl_Leave.update({ where: { id }, data: { status: decision } });
        try {
            (0, socketService_1.getIO)().to("authorities").emit("new_trigger", {
                id: updated.id,
                title: `Leave ${decision}`,
                description: `Leave request ${decision} for worker ${String(updated.workerId ?? "")}`,
                workerId: updated.workerId ?? null,
                companyName: null,
                createdAt: new Date().toISOString(),
            });
        }
        catch {
            // ignore emit errors
        }
        return res.json(updated);
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Payroll ----------
// Worker-scoped read of own payroll history. Workers (roleId === 2) only see
// their own rows.
exports.hrmsRouter.get("/Api/HRMS/Payroll/Mine", auth_1.requireAuth, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (roleId !== 2)
            return res.status(403).json({ error: "Forbidden" });
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const rows = await db_1.prisma.tbl_Payroll.findMany({
            where: { workerId: userKey },
            orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
            take: 200,
        });
        return res.json(rows ?? []);
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.get("/Api/HRMS/Payroll", auth_1.requireAuth, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (![1, 3, 4, 5, 6, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true },
            take: 5000,
        });
        const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
        if (!workerIds.length)
            return res.json([]);
        const rows = await db_1.prisma.tbl_Payroll.findMany({
            where: { workerId: { in: workerIds } },
            orderBy: [{ id: "desc" }],
            take: 1000,
        });
        return res.json(rows ?? []);
    }
    catch (e) {
        return next(e);
    }
});
exports.hrmsRouter.post("/Api/HRMS/Payroll/Upload", auth_1.requireAuth, subscription_1.requireActivePlanForWrite, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (![1, 3, 4].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const workerId = (req.body?.workerId ?? "").toString().trim();
        const month = Number(req.body?.month ?? 0);
        const year = Number(req.body?.year ?? 0);
        const amount = Number(req.body?.amount ?? 0);
        const voucherUrl = (req.body?.voucherUrl ?? "").toString().trim();
        const isPaid = req.body?.isPaid != null ? Boolean(req.body.isPaid) : false;
        if (!workerId || !Number.isFinite(month) || !Number.isFinite(year)) {
            return res.status(400).json({ error: "workerId, month, year are required" });
        }
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorker = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
        if (roleId !== 1 && !scopedWorker)
            return res.status(403).json({ error: "Forbidden" });
        const created = await db_1.prisma.tbl_Payroll.create({
            data: {
                workerId,
                month,
                year,
                amount: Number.isFinite(amount) ? amount : 0,
                voucherUrl: voucherUrl || null,
                isPaid,
            },
        });
        try {
            (0, socketService_1.getIO)().to("authorities").emit("new_trigger", {
                id: created.id,
                title: "Payroll uploaded",
                description: `Payroll uploaded for worker ${workerId} (${month}/${year})`,
                workerId,
                companyName: null,
                createdAt: new Date().toISOString(),
            });
        }
        catch {
            // ignore emit errors
        }
        return res.status(201).json(created);
    }
    catch (e) {
        return next(e);
    }
});
