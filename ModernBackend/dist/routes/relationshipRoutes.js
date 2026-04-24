"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.relationshipRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const schemaMigrations_1 = require("../db/schemaMigrations");
exports.relationshipRouter = (0, express_1.Router)();
// ---------- Public: employer list for signup dropdown ----------
//
// Returns a minimal list of employer accounts (userId + company name) so an
// unauthenticated worker signup form can render a dropdown. No auth required.
exports.relationshipRouter.get("/Api/Employers/Public", async (req, res, next) => {
    try {
        const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
        const q = (rawQ ?? "").toString().trim();
        const where = {};
        if (q) {
            where.OR = [
                { Employer_Name: { contains: q } },
                { User_Id: { contains: q } },
                { Employer_EmailID: { contains: q } },
            ];
        }
        const rows = await db_1.prisma.tbl_Employer.findMany({
            where,
            select: {
                User_Id: true,
                Employer_Name: true,
                Employer_EmailID: true,
            },
            orderBy: [{ Employer_Name: "asc" }],
            take: 200,
        });
        return res.json((rows ?? []).map((r) => ({
            id: (r.User_Id ?? "").toString(),
            companyName: (r.Employer_Name ?? "").toString(),
            email: (r.Employer_EmailID ?? "").toString(),
        })));
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Agency: search employers ----------
exports.relationshipRouter.get("/Api/Employers/Search", auth_1.requireAuth, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (![1, 4, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
        const q = (rawQ ?? "").toString().trim();
        if (!q)
            return res.json([]);
        const rows = await db_1.prisma.tbl_Employer.findMany({
            where: {
                OR: [
                    { Employer_Name: { contains: q } },
                    { User_Id: { contains: q } },
                    { Employer_EmailID: { contains: q } },
                    { Employer_ContactPerson: { contains: q } },
                ],
            },
            select: {
                User_Id: true,
                Employer_Name: true,
                Employer_EmailID: true,
                Employer_ContactPerson: true,
            },
            orderBy: [{ Employer_Name: "asc" }],
            take: 50,
        });
        return res.json((rows ?? []).map((r) => ({
            id: (r.User_Id ?? "").toString(),
            companyName: (r.Employer_Name ?? "").toString(),
            email: (r.Employer_EmailID ?? "").toString(),
            contactPerson: (r.Employer_ContactPerson ?? "").toString(),
        })));
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Agency: link employer ----------
exports.relationshipRouter.post("/Api/Agency/LinkEmployer", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = Number(user?.roleId ?? 0);
        if (roleId !== 4)
            return res.status(403).json({ error: "Only agencies can link employers" });
        const agencyId = (user?.userKey ?? "").toString().trim();
        if (!agencyId)
            return res.status(400).json({ error: "Missing agency id" });
        const employerId = (req.body?.employerId ?? "").toString().trim();
        if (!employerId)
            return res.status(400).json({ error: "employerId is required" });
        // Verify employer exists.
        const employer = await db_1.prisma.tbl_Employer.findFirst({
            where: { User_Id: employerId },
            select: { User_Id: true, Employer_Name: true },
        });
        if (!employer)
            return res.status(404).json({ error: "Employer not found" });
        await (0, schemaMigrations_1.ensureRelationshipTablesExist)();
        // Idempotent: do nothing if already linked.
        const existing = await db_1.prisma.tbl_Agency_Employer_Link.findFirst({
            where: { agencyId, employerId },
            select: { id: true },
        });
        if (existing) {
            return res.status(200).json({ ok: true, id: existing.id, alreadyLinked: true });
        }
        const created = await db_1.prisma.tbl_Agency_Employer_Link.create({
            data: {
                agencyId,
                employerId,
                createdBy: agencyId,
            },
        });
        return res.status(201).json({ ok: true, id: created.id, alreadyLinked: false });
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Agency: list linked employers ----------
exports.relationshipRouter.get("/Api/Agency/Employers", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = Number(user?.roleId ?? 0);
        if (![1, 4, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const agencyId = (user?.userKey ?? "").toString().trim();
        if (roleId === 4 && !agencyId)
            return res.json([]);
        const links = await db_1.prisma.tbl_Agency_Employer_Link.findMany({
            where: roleId === 4 ? { agencyId } : undefined,
            select: { id: true, agencyId: true, employerId: true, linkedAt: true },
            orderBy: [{ linkedAt: "desc" }],
            take: 1000,
        });
        const employerIds = Array.from(new Set((links ?? []).map((l) => l.employerId).filter(Boolean)));
        const employers = employerIds.length
            ? await db_1.prisma.tbl_Employer.findMany({
                where: { User_Id: { in: employerIds } },
                select: { User_Id: true, Employer_Name: true, Employer_EmailID: true },
                take: 5000,
            })
            : [];
        const employerById = new Map((employers ?? []).map((e) => [
            (e.User_Id ?? "").toString(),
            { companyName: (e.Employer_Name ?? "").toString(), email: (e.Employer_EmailID ?? "").toString() },
        ]));
        return res.json((links ?? []).map((l) => ({
            id: l.id,
            agencyId: l.agencyId,
            employerId: l.employerId,
            linkedAt: l.linkedAt,
            employer: employerById.get((l.employerId ?? "").toString()) ?? null,
        })));
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Employer: search workers (for linking) ----------
exports.relationshipRouter.get("/Api/Workers/Search", auth_1.requireAuth, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (![1, 3, 4, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
        const q = (rawQ ?? "").toString().trim();
        if (!q)
            return res.json([]);
        const rows = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: {
                OR: [
                    { Name: { contains: q } },
                    { Worker_Id: { contains: q } },
                    { Email_Id: { contains: q } },
                    { Passport_Number: { contains: q } },
                ],
            },
            select: {
                Worker_Id: true,
                Name: true,
                Passport_Number: true,
                Email_Id: true,
                Employer_Id: true,
            },
            orderBy: [{ Created_On: "desc" }],
            take: 50,
        });
        return res.json((rows ?? []).map((r) => ({
            id: (r.Worker_Id ?? "").toString(),
            name: (r.Name ?? "").toString(),
            passport: (r.Passport_Number ?? "").toString(),
            email: (r.Email_Id ?? "").toString(),
            currentEmployerId: (r.Employer_Id ?? "").toString() || null,
        })));
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Employer: link worker ----------
exports.relationshipRouter.post("/Api/Employer/LinkWorker", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = Number(user?.roleId ?? 0);
        if (roleId !== 3)
            return res.status(403).json({ error: "Only employers can link workers" });
        const employerId = (user?.userKey ?? "").toString().trim();
        if (!employerId)
            return res.status(400).json({ error: "Missing employer id" });
        const workerId = (req.body?.workerId ?? "").toString().trim();
        if (!workerId)
            return res.status(400).json({ error: "workerId is required" });
        const worker = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({
            where: { Worker_Id: workerId },
            select: { Worker_Id: true, Name: true, Employer_Id: true },
        });
        if (!worker)
            return res.status(404).json({ error: "Worker not found" });
        await (0, schemaMigrations_1.ensureRelationshipTablesExist)();
        // Close any existing Active link for this worker.
        await db_1.prisma.tbl_Worker_EmployerLink.updateMany({
            where: { workerId, status: "Active" },
            data: { status: "Ended", endDate: new Date() },
        });
        const created = await db_1.prisma.tbl_Worker_EmployerLink.create({
            data: {
                workerId,
                employerId,
                status: "Active",
                createdBy: employerId,
            },
        });
        // Also update the denormalised pointer on the worker record so all
        // existing scope queries (Employer_Id-based) see the worker immediately.
        await db_1.prisma.tbl_Worker_PersonalInfo.updateMany({
            where: { Worker_Id: workerId },
            data: { Employer_Id: employerId },
        });
        return res.status(201).json({ ok: true, id: created.id });
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Employer: list linked workers (link history) ----------
exports.relationshipRouter.get("/Api/Employer/Links", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = Number(user?.roleId ?? 0);
        if (![1, 3, 4, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const employerId = (user?.userKey ?? "").toString().trim();
        if (roleId === 3 && !employerId)
            return res.json([]);
        const links = await db_1.prisma.tbl_Worker_EmployerLink.findMany({
            where: roleId === 3 ? { employerId } : undefined,
            orderBy: [{ startDate: "desc" }],
            take: 1000,
        });
        return res.json(links ?? []);
    }
    catch (e) {
        return next(e);
    }
});
