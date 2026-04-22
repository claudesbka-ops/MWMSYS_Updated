"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.panicRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const socketService_1 = require("../services/socketService");
const queryGuard_1 = require("../services/queryGuard");
const workerLookup_1 = require("../services/workerLookup");
// ---------- Panic-only helpers ----------
async function findMemberInfoIdByPassport(passportNo) {
    const candidates = [
        "SELECT TOP 1 MemberInfoId FROM MemberInfo WHERE PassportNo = @p1",
        "SELECT TOP 1 MemberInfoId FROM MemberInfo WHERE PassportNumber = @p1",
        "SELECT TOP 1 MemberInfoId FROM MemberInfo WHERE Passport = @p1",
    ];
    for (const sql of candidates) {
        try {
            const rows = (await db_1.prisma.$queryRawUnsafe(sql, passportNo));
            const row = Array.isArray(rows) ? rows[0] : null;
            const value = row?.MemberInfoId;
            if (value != null)
                return Number(value);
        }
        catch {
            // ignore and try next
        }
    }
    return null;
}
async function findWorkerMetadataByPassport(passportNo) {
    if (!passportNo)
        return null;
    try {
        const row = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({
            where: {
                Passport_Number: passportNo,
            },
            select: {
                Worker_Id: true,
                Photo: true,
            },
        });
        if (!row?.Worker_Id)
            return null;
        return {
            workerId: String(row.Worker_Id),
            currentLocation: null,
            companyName: null,
            passportPhoto: row.Photo != null ? String(row.Photo) : null,
        };
    }
    catch {
        return null;
    }
}
async function handlePanic(req, res) {
    let passportNo = (req.body.PassportNo ?? req.body.passportNo ?? "").toString().trim();
    const title = (req.body.Title ?? req.body.title ?? "Panic Alert").toString();
    const description = (req.body.Description ?? req.body.description ?? "Panic alert triggered").toString();
    const latitude = (req.body.Latitude ?? req.body.latitude ?? req.body.lattitude ?? "").toString();
    const longitude = (req.body.Longitude ?? req.body.longitude ?? "").toString();
    let memberInfoId = Number(req.body.MemberInfoId ?? req.body.memberInfoId ?? 0);
    const jwtUserId = Number(req.user?.userId ?? 0);
    const isAuthed = Number.isFinite(jwtUserId) && jwtUserId > 0;
    const workerIdFromJwt = isAuthed ? await (0, workerLookup_1.findWorkerIdByJwtUserId)(jwtUserId) : null;
    if (!passportNo && !memberInfoId) {
        if (isAuthed) {
            passportNo = (await (0, workerLookup_1.findWorkerPassportByJwtUserId)(jwtUserId)) ?? "";
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
        const uploaded = req.file;
        const uploadPath = uploaded?.filename ? `/uploads/${uploaded.filename}` : null;
        const workerMeta = passportNo ? await findWorkerMetadataByPassport(passportNo) : null;
        const created = await db_1.prisma.tbl_ProbSol.create({
            data: {
                Prob_ID: passportNo || workerIdFromJwt || (memberInfoId ? memberInfoId.toString() : ""),
                Type: "Panic",
                Title: title,
                Description: latitude || longitude
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
                Lat: Number.isFinite(Number(latitude)) ? Number(latitude) : undefined,
                Lng: Number.isFinite(Number(longitude)) ? Number(longitude) : undefined,
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
        (0, socketService_1.getIO)().to("admin").emit("new_trigger", data);
        console.log("New alert emitted", {
            id: created.ID,
            title,
            passportNo,
            memberInfoId,
        });
        return res.status(200).json({ ProblemAndActionId: created.ID });
    }
    catch (e) {
        throw e;
    }
}
// ---------- Router ----------
exports.panicRouter = (0, express_1.Router)();
// New route name requested
exports.panicRouter.post("/panic", auth_1.requireAuth, upload_1.upload.single("file"), handlePanic);
// Backward-compatible route for existing frontend
exports.panicRouter.post("/Api/Panic", auth_1.requireAuth, upload_1.upload.single("file"), handlePanic);
exports.panicRouter.get("/Api/Panic/Latest", auth_1.requireAuth, (0, auth_1.checkRole)([1, 3, 4, 5, 6, 7]), async (req, res, next) => {
    const rawSinceId = Array.isArray(req.query.sinceId) ? req.query.sinceId[0] : req.query.sinceId;
    const sinceId = rawSinceId != null ? Number(rawSinceId) : 0;
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true },
            take: 5000,
        });
        const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));
        if (roleId !== 1 && !allowedWorkerIds.size) {
            return res.json([]);
        }
        const rows = await db_1.prisma.tbl_ProbSol.findMany({
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
    }
    catch (e) {
        return next(e);
    }
});
exports.panicRouter.post("/Api/Panic/Forward", auth_1.requireAuth, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const panicId = Number(req.body?.panicId ?? req.body?.id ?? 0);
        const target = (req.body?.target ?? req.body?.embassy ?? "").toString().trim();
        if (!Number.isFinite(panicId) || panicId <= 0) {
            return res.status(400).json({ error: "panicId is required" });
        }
        if (target !== "embassy_source" && target !== "embassy_destination") {
            return res.status(400).json({ error: "target must be embassy_source or embassy_destination" });
        }
        const row = await db_1.prisma.tbl_ProbSol.findFirst({ where: { ID: panicId, Type: "Panic" } });
        if (!row)
            return res.status(404).json({ error: "Panic not found" });
        if (row?.ProbStatus?.toString() === "Pending") {
            await db_1.prisma.tbl_ProbSol.update({ where: { ID: panicId }, data: { ProbStatus: "Approved", Updated_On: new Date() } });
        }
        const payload = {
            id: row.ID,
            title: row?.Title ?? "Panic Alert",
            description: row?.Description ?? "",
            workerId: row?.worker_ID ?? null,
            companyName: row?.Company_Name ?? null,
            currentLocation: row?.Current_Location ?? null,
            status: "Approved",
            createdOn: row?.Updated_On ?? null,
        };
        const io = (0, socketService_1.getIO)();
        io.to(target).emit("panic_forwarded", payload);
        io.to(target).emit("new_trigger", payload);
        return res.json({ ok: true });
    }
    catch (e) {
        return next(e);
    }
});
exports.panicRouter.get("/Api/Panic/Active", auth_1.requireAuth, auth_1.requireAlertViewer, async (_req, res, next) => {
    try {
        const roleId = Number(_req.user?.roleId ?? 0);
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(_req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true },
            take: 5000,
        });
        const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));
        const rows = await db_1.prisma.tbl_ProbSol.findMany({
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
        const workerIds = Array.from(new Set((rows ?? []).map((r) => (r.worker_ID ?? "").toString()).filter(Boolean)));
        const workerPhotos = workerIds.length
            ? await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
                where: {
                    Worker_Id: { in: workerIds },
                },
                select: {
                    Worker_Id: true,
                    Photo: true,
                },
            })
            : [];
        const photoByWorkerId = new Map();
        for (const w of workerPhotos ?? []) {
            photoByWorkerId.set(w.Worker_Id, w.Photo ?? null);
        }
        return res.json((rows ?? []).map((r) => ({
            ...r,
            passportPhoto: r.worker_ID ? photoByWorkerId.get(r.worker_ID) ?? null : null,
        })));
    }
    catch (e) {
        return next(e);
    }
});
exports.panicRouter.get("/Api/Panic/History", auth_1.requireAuth, auth_1.requireAuthority, async (_req, res, next) => {
    try {
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(_req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true },
            take: 5000,
        });
        const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));
        const rows = await db_1.prisma.tbl_ProbSol.findMany({
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
        const workerIds = Array.from(new Set((rows ?? []).map((r) => (r.worker_ID ?? "").toString()).filter(Boolean)));
        const workerPhotos = workerIds.length
            ? await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
                where: {
                    Worker_Id: { in: workerIds },
                },
                select: {
                    Worker_Id: true,
                    Photo: true,
                },
            })
            : [];
        const photoByWorkerId = new Map();
        for (const w of workerPhotos ?? []) {
            photoByWorkerId.set(w.Worker_Id, w.Photo ?? null);
        }
        return res.json((rows ?? []).map((r) => ({
            ...r,
            passportPhoto: r.worker_ID ? photoByWorkerId.get(r.worker_ID) ?? null : null,
        })));
    }
    catch (e) {
        return next(e);
    }
});
exports.panicRouter.post("/Api/Panic/Resolve", auth_1.requireAuth, auth_1.requireAuthority, async (req, res, next) => {
    const id = Number(req.body?.id ?? 0);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "id is required" });
    }
    try {
        await db_1.prisma.tbl_ProbSol.update({
            where: { ID: id },
            data: {
                ProbStatus: "Resolved",
                Updated_On: new Date(),
                IsResolved: true,
            },
        });
        return res.json({ ok: true });
    }
    catch (e) {
        return next(e);
    }
});
