"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const schemaMigrations_1 = require("../db/schemaMigrations");
const socketService_1 = require("../services/socketService");
const workerScopes_1 = require("../services/workerScopes");
// ---------- Broadcast-local helper ----------
async function resolveEmployerAgencies(employerId) {
    const eid = (employerId ?? "").toString().trim();
    if (!eid)
        return [];
    const workers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
        where: { Employer_Id: eid },
        select: { Worker_Id: true },
        take: 5000,
    });
    const wids = Array.from(new Set((workers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (!wids.length)
        return [];
    const links = await db_1.prisma.tbl_Worker_RecruitAgent.findMany({
        where: { Worker_Id: { in: wids } },
        select: { Malaysian_Reqruitment_Agency: true, Source_Country_Requirtment_Agency: true },
        take: 5000,
    });
    const agencyIds = new Set();
    for (const l of links ?? []) {
        const a = (l.Malaysian_Reqruitment_Agency ?? "").toString().trim();
        const b = (l.Source_Country_Requirtment_Agency ?? "").toString().trim();
        if (a)
            agencyIds.add(a);
        if (b)
            agencyIds.add(b);
    }
    return Array.from(agencyIds);
}
exports.broadcastRouter = (0, express_1.Router)();
exports.broadcastRouter.post("/Api/Broadcast/Send", auth_1.requireAuth, async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureBroadcastTableExists)();
        const ok = await (0, schemaMigrations_1.broadcastTableExists)();
        if (!ok)
            return res.status(501).json({ error: "Broadcast table not installed" });
        const user = req.user;
        const roleId = Number(user?.roleId ?? 0);
        const senderKey = (user?.userKey ?? "").toString().trim() || null;
        const senderName = (user?.userName ?? user?.emailId ?? senderKey ?? "").toString().trim() || null;
        const message = (req.body?.message ?? "").toString();
        if (![1, 3, 4, 5, 6, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        if (!message.trim())
            return res.status(400).json({ error: "message is required" });
        let target = "all";
        if (roleId === 3)
            target = "workers";
        else if (roleId === 4)
            target = "workers_employers";
        else if (roleId === 5 || roleId === 6)
            target = "nationality";
        else if (roleId === 7 || roleId === 1)
            target = "all";
        const rows = (await db_1.prisma.$queryRawUnsafe("INSERT INTO dbo.Tbl_Broadcast_Message(senderRoleId,senderKey,senderName,message,target) OUTPUT INSERTED.id, INSERTED.createdOn VALUES(@P1,@P2,@P3,@P4,@P5);", roleId, senderKey, senderName, message.trim().slice(0, 2000), target));
        const row = Array.isArray(rows) ? rows[0] : null;
        const payload = {
            id: row?.id != null ? Number(row.id) : null,
            senderRoleId: roleId,
            senderKey,
            senderName,
            message: message.trim().slice(0, 2000),
            target,
            createdOn: row?.createdOn ? new Date(row.createdOn).toISOString() : new Date().toISOString(),
            attachments: [],
        };
        try {
            const io = (0, socketService_1.getIO)();
            if (target === "all") {
                io.to("broadcast_all").emit("broadcast_message", payload);
            }
            else if (target === "workers") {
                if (senderKey)
                    io.to(`employer:${senderKey}`).emit("broadcast_message", payload);
            }
            else if (target === "workers_employers") {
                if (senderKey)
                    io.to(`agency:${senderKey}`).emit("broadcast_message", payload);
                // Also explicitly target employers connected to workers under this agency.
                if (senderKey) {
                    const links = await db_1.prisma.tbl_Worker_RecruitAgent.findMany({
                        where: {
                            OR: [{ Malaysian_Reqruitment_Agency: senderKey }, { Source_Country_Requirtment_Agency: senderKey }],
                        },
                        select: { Worker_Id: true },
                        take: 5000,
                    });
                    const wids = Array.from(new Set((links ?? []).map((x) => (x.Worker_Id ?? "").toString()).filter(Boolean)));
                    if (wids.length) {
                        const infos = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
                            where: { Worker_Id: { in: wids } },
                            select: { Employer_Id: true },
                            take: 5000,
                        });
                        const employerIds = Array.from(new Set((infos ?? []).map((x) => (x.Employer_Id ?? "").toString().trim()).filter(Boolean)));
                        for (const eid of employerIds) {
                            io.to(`employer:${eid}`).emit("broadcast_message", payload);
                        }
                    }
                }
            }
            else if (target === "nationality") {
                const nat = user?.countryCode != null ? Number(user.countryCode) : NaN;
                if (Number.isFinite(nat))
                    io.to(`nationality:${nat}`).emit("broadcast_message", payload);
            }
        }
        catch {
            // ignore emit errors
        }
        return res.json({ ok: true, payload });
    }
    catch (e) {
        return next(e);
    }
});
// Alias route for embassy clients: forwards to the standard /Api/Broadcast/Send
// handler. The existing handler already targets workers by nationality for
// roleId 5/6, so this is just a semantic alias — no duplicated logic.
exports.broadcastRouter.post("/Api/Embassy/Broadcast", auth_1.requireAuth, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (roleId !== 5 && roleId !== 6) {
            return res.status(403).json({ error: "Only embassy accounts may use /Api/Embassy/Broadcast" });
        }
        // Re-enter the broadcast pipeline via the Express router. Simpler: forward
        // in-process by re-invoking the handler.
        req.url = "/Api/Broadcast/Send";
        return req.app._router.handle(req, res, next);
    }
    catch (e) {
        return next(e);
    }
});
exports.broadcastRouter.post("/Api/Broadcast/SendMultipart", auth_1.requireAuth, upload_1.broadcastUpload.array("files", 5), async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureBroadcastTableExists)();
        const ok = await (0, schemaMigrations_1.broadcastTableExists)();
        if (!ok)
            return res.status(501).json({ error: "Broadcast table not installed" });
        const user = req.user;
        const roleId = Number(user?.roleId ?? 0);
        const senderKey = (user?.userKey ?? "").toString().trim() || null;
        const senderName = (user?.userName ?? user?.emailId ?? senderKey ?? "").toString().trim() || null;
        const message = (req.body?.message ?? "").toString();
        if (![1, 3, 4, 5, 6, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const files = (req.files ?? []);
        const hasFiles = Array.isArray(files) && files.length > 0;
        if (!message.trim() && !hasFiles)
            return res.status(400).json({ error: "message or files are required" });
        let target = "all";
        if (roleId === 3)
            target = "workers";
        else if (roleId === 4)
            target = "workers_employers";
        else if (roleId === 5 || roleId === 6)
            target = "nationality";
        else if (roleId === 7 || roleId === 1)
            target = "all";
        const inserted = (await db_1.prisma.$queryRawUnsafe("INSERT INTO dbo.Tbl_Broadcast_Message(senderRoleId,senderKey,senderName,message,target) OUTPUT INSERTED.id, INSERTED.createdOn VALUES(@P1,@P2,@P3,@P4,@P5);", roleId, senderKey, senderName, message.trim().slice(0, 2000), target));
        const row = Array.isArray(inserted) ? inserted[0] : null;
        const messageId = row?.id != null ? Number(row.id) : NaN;
        if (!Number.isFinite(messageId))
            return res.status(500).json({ error: "Unable to send" });
        const attachments = [];
        for (const f of files ?? []) {
            const filename = (f.filename ?? "").toString();
            if (!filename)
                continue;
            const url = `/uploads/${filename}`;
            const mime = (f.mimetype ?? "").toString() || null;
            const originalName = (f.originalname ?? filename).toString() || null;
            const sizeBytes = f.size != null ? Number(f.size) : null;
            const attRows = (await db_1.prisma.$queryRawUnsafe("INSERT INTO dbo.Tbl_Broadcast_Attachment(messageId,url,mime,originalName,sizeBytes) OUTPUT INSERTED.id VALUES(@P1,@P2,@P3,@P4,@P5);", messageId, url, mime, originalName, sizeBytes));
            const att = Array.isArray(attRows) ? attRows[0] : null;
            attachments.push({
                id: att?.id != null ? Number(att.id) : 0,
                url: `${req.protocol}://${req.get("host")}${url}`,
                mime,
                originalName,
                sizeBytes: Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : null,
            });
        }
        const payload = {
            id: messageId,
            senderRoleId: roleId,
            senderKey,
            senderName,
            message: message.trim().slice(0, 2000),
            target,
            createdOn: row?.createdOn ? new Date(row.createdOn).toISOString() : new Date().toISOString(),
            attachments,
        };
        try {
            const io = (0, socketService_1.getIO)();
            if (target === "all") {
                io.to("broadcast_all").emit("broadcast_message", payload);
            }
            else if (target === "workers") {
                if (senderKey)
                    io.to(`employer:${senderKey}`).emit("broadcast_message", payload);
            }
            else if (target === "workers_employers") {
                if (senderKey)
                    io.to(`agency:${senderKey}`).emit("broadcast_message", payload);
                if (senderKey) {
                    const links = await db_1.prisma.tbl_Worker_RecruitAgent.findMany({
                        where: {
                            OR: [{ Malaysian_Reqruitment_Agency: senderKey }, { Source_Country_Requirtment_Agency: senderKey }],
                        },
                        select: { Worker_Id: true },
                        take: 5000,
                    });
                    const wids = Array.from(new Set((links ?? []).map((x) => (x.Worker_Id ?? "").toString()).filter(Boolean)));
                    if (wids.length) {
                        const infos = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
                            where: { Worker_Id: { in: wids } },
                            select: { Employer_Id: true },
                            take: 5000,
                        });
                        const employerIds = Array.from(new Set((infos ?? []).map((x) => (x.Employer_Id ?? "").toString().trim()).filter(Boolean)));
                        for (const eid of employerIds) {
                            io.to(`employer:${eid}`).emit("broadcast_message", payload);
                        }
                    }
                }
            }
            else if (target === "nationality") {
                const nat = user?.countryCode != null ? Number(user.countryCode) : NaN;
                if (Number.isFinite(nat))
                    io.to(`nationality:${nat}`).emit("broadcast_message", payload);
            }
        }
        catch {
            // ignore
        }
        return res.json({ ok: true, payload });
    }
    catch (e) {
        return next(e);
    }
});
exports.broadcastRouter.get("/Api/Broadcast/Feed", auth_1.requireAuth, async (req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureBroadcastTableExists)();
        const ok = await (0, schemaMigrations_1.broadcastTableExists)();
        if (!ok)
            return res.status(501).json({ error: "Broadcast table not installed" });
        const user = req.user;
        const roleId = Number(user?.roleId ?? 0);
        const userKey = (user?.userKey ?? "").toString().trim();
        const countryCode = user?.countryCode != null ? Number(user.countryCode) : NaN;
        const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
        const limit = Math.min(200, Math.max(10, Number(limitRaw ?? 60)));
        const fetchLimit = Math.min(600, Math.max(60, limit * 6));
        const targets = new Set();
        // Everyone can see system-wide announcements.
        targets.add("all");
        if (roleId === 2 && userKey) {
            targets.add("workers");
            targets.add("workers_employers");
            targets.add("nationality");
        }
        if (roleId === 3) {
            targets.add("workers_employers");
            targets.add("all");
        }
        if (roleId === 4) {
            targets.add("workers_employers");
            targets.add("all");
        }
        if (roleId === 5 || roleId === 6) {
            targets.add("nationality");
            targets.add("all");
        }
        if (roleId === 7 || roleId === 1) {
            targets.add("all");
            targets.add("workers");
            targets.add("workers_employers");
            targets.add("nationality");
        }
        const targetList = Array.from(targets);
        const placeholders = targetList.map((_, i) => `@P${i + 1}`).join(",");
        const rows = (await db_1.prisma.$queryRawUnsafe(`SELECT TOP (${fetchLimit}) id, senderRoleId, senderKey, senderName, message, target, createdOn FROM dbo.Tbl_Broadcast_Message WHERE target IN (${placeholders}) ORDER BY createdOn DESC, id DESC`, ...targetList));
        // For nationality-targeted messages, filter to the user's nationality if needed.
        let out = (rows ?? []).map((r) => ({
            id: Number(r.id),
            senderRoleId: Number(r.senderRoleId),
            senderKey: r.senderKey != null ? String(r.senderKey) : null,
            senderName: r.senderName != null ? String(r.senderName) : null,
            message: String(r.message ?? ""),
            target: String(r.target ?? ""),
            createdOn: r.createdOn ? new Date(r.createdOn).toISOString() : null,
            attachments: [],
        }));
        if (roleId === 2) {
            const scopes = userKey ? await (0, workerScopes_1.resolveWorkerScopes)(userKey) : { employerId: null, nationality: null, agencyIds: [] };
            const employerId = scopes.employerId;
            const agencySet = new Set(scopes.agencyIds);
            out = out.filter((m) => {
                if (m.target === "all")
                    return true;
                if (m.target === "workers") {
                    return employerId != null && String(m.senderKey ?? "").trim() === employerId;
                }
                if (m.target === "workers_employers") {
                    return agencySet.has(String(m.senderKey ?? "").trim());
                }
                if (m.target === "nationality") {
                    return scopes.nationality != null;
                }
                return false;
            });
        }
        else if (roleId === 3) {
            const myEmployerId = userKey;
            const agencies = myEmployerId ? await resolveEmployerAgencies(myEmployerId) : [];
            const agencySet = new Set(agencies);
            out = out.filter((m) => {
                if (m.target === "all")
                    return true;
                if (m.target === "workers_employers")
                    return agencySet.has(String(m.senderKey ?? "").trim());
                return false;
            });
        }
        else if (roleId === 4) {
            const myAgencyId = userKey;
            out = out.filter((m) => {
                if (m.target === "all")
                    return true;
                if (m.target === "workers_employers")
                    return String(m.senderKey ?? "").trim() === myAgencyId;
                return false;
            });
        }
        else if (roleId === 5 || roleId === 6) {
            if (!Number.isFinite(countryCode)) {
                out = out.filter((x) => x.target !== "nationality");
            }
        }
        out = out.slice(0, limit);
        const ids = Array.from(new Set(out.map((x) => Number(x.id)).filter((x) => Number.isFinite(x) && x > 0)));
        if (ids.length) {
            const attPlaceholders = ids.map((_, i) => `@P${i + 1}`).join(",");
            const attRows = (await db_1.prisma.$queryRawUnsafe(`SELECT id, messageId, url, mime, originalName, sizeBytes FROM dbo.Tbl_Broadcast_Attachment WHERE messageId IN (${attPlaceholders}) ORDER BY id ASC`, ...ids));
            const byMsg = new Map();
            for (const a of attRows ?? []) {
                const mid = Number(a.messageId);
                if (!Number.isFinite(mid))
                    continue;
                const arr = byMsg.get(mid) ?? [];
                arr.push(a);
                byMsg.set(mid, arr);
            }
            out = out.map((m) => {
                const arr = byMsg.get(Number(m.id)) ?? [];
                return {
                    ...m,
                    attachments: arr.map((a) => {
                        const p = (a.url ?? "").toString();
                        const isUploads = p.startsWith("/uploads/");
                        const abs = isUploads ? `${req.protocol}://${req.get("host")}${p}` : p;
                        return {
                            id: Number(a.id),
                            url: abs,
                            mime: a.mime != null ? String(a.mime) : null,
                            originalName: a.originalName != null ? String(a.originalName) : null,
                            sizeBytes: a.sizeBytes != null ? Number(a.sizeBytes) : null,
                        };
                    }),
                };
            });
        }
        return res.json({ rows: out });
    }
    catch (e) {
        return next(e);
    }
});
