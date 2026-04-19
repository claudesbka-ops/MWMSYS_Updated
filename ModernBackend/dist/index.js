"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const openai_1 = __importDefault(require("openai"));
const stripe_1 = __importDefault(require("stripe"));
const db_1 = require("./db");
const cryptoLegacy_1 = require("./cryptoLegacy");
const auth_1 = require("./auth");
const queryGuard_1 = require("./services/queryGuard");
async function ensureAttestationTableExists() {
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_Attestation', 'U') IS NULL BEGIN " +
            "CREATE TABLE dbo.Tbl_Attestation (" +
            "AttestationId INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "Worker_Id VARCHAR(100) NOT NULL," +
            "Passport_Number VARCHAR(20) NULL," +
            "DocumentType VARCHAR(50) NULL," +
            "DocumentPath VARCHAR(500) NULL," +
            "Status VARCHAR(20) NOT NULL DEFAULT('Submitted')," +
            "AdminRemarks VARCHAR(500) NULL," +
            "Created_On DATETIME NULL DEFAULT(GETDATE())," +
            "Updated_On DATETIME NULL" +
            ");" +
            "END");
    }
    catch {
        // ignore
    }
}
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Stripe webhooks need the raw body; capture it via verify for signature verification.
app.use(express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express_1.default.urlencoded({ extended: true }));
const stripeSecretKey = (process.env.STRIPE_SECRET_KEY ?? "").toString().trim();
const stripe = stripeSecretKey ? new stripe_1.default(stripeSecretKey, { apiVersion: "2023-10-16" }) : null;
const uploadsDir = path_1.default.join(process.cwd(), "uploads");
fs_1.default.mkdirSync(uploadsDir, { recursive: true });
app.get("/stripe/return", (req, res) => {
    const raw = Array.isArray(req.query?.redirect) ? req.query.redirect[0] : req.query?.redirect;
    const redirect = (raw ?? "").toString().trim();
    if (!redirect) {
        return res.status(400).send("Missing redirect");
    }
    if (/^(javascript|data):/i.test(redirect)) {
        return res.status(400).send("Invalid redirect");
    }
    return res.redirect(302, redirect);
});
app.post("/Api/subscription/checkout", auth_1.requireAuth, async (req, res, next) => {
    try {
        if (!stripe)
            return res.status(500).json({ error: "Stripe is not configured" });
        const user = req.user;
        const roleId = user?.roleId != null ? Number(user.roleId) : null;
        if (roleId !== 3 && roleId !== 4) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const entityId = (user?.userKey ?? "").toString().trim();
        if (!entityId)
            return res.status(400).json({ error: "Missing entity id" });
        const planType = (req.body?.planType ?? "").toString().trim();
        if (!planType)
            return res.status(400).json({ error: "planType is required" });
        const planKey = planType.toLowerCase();
        if (planKey === "free")
            return res.status(400).json({ error: "Free plan does not require checkout" });
        const priceIdEnvKey = planKey === "pro" ? "STRIPE_PRICE_PRO" : planKey === "enterprise" ? "STRIPE_PRICE_ENTERPRISE" : "";
        const priceId = priceIdEnvKey ? process.env[priceIdEnvKey] : null;
        if (!priceId || typeof priceId !== "string" || !priceId.trim()) {
            return res.status(500).json({ error: "Stripe price is not configured" });
        }
        const origin = (req.header("origin") ?? "").toString().trim();
        const bodySuccess = (req.body?.successUrl ?? "").toString().trim();
        const bodyCancel = (req.body?.cancelUrl ?? "").toString().trim();
        const envSuccess = (process.env.STRIPE_SUCCESS_URL ?? "").toString().trim();
        const envCancel = (process.env.STRIPE_CANCEL_URL ?? "").toString().trim();
        const isAbsoluteUrl = (u) => /^[a-z][a-z0-9+.-]*:\/\//i.test(u) && !/^(javascript|data):/i.test(u);
        const successUrl = bodySuccess && isAbsoluteUrl(bodySuccess) ? bodySuccess : envSuccess ? envSuccess : origin ? `${origin}/pricing?checkout=success` : "";
        const cancelUrl = bodyCancel && isAbsoluteUrl(bodyCancel) ? bodyCancel : envCancel ? envCancel : origin ? `${origin}/pricing?checkout=cancel` : "";
        if (!successUrl || !cancelUrl) {
            return res.status(500).json({ error: "Missing success/cancel URL (set STRIPE_SUCCESS_URL/STRIPE_CANCEL_URL or pass successUrl/cancelUrl)" });
        }
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{ price: priceId.trim(), quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: entityId,
            customer_email: user?.emailId ? String(user.emailId) : undefined,
            metadata: {
                entityId,
                planType,
                roleId: roleId != null ? String(roleId) : "",
            },
        });
        return res.status(201).json({ ok: true, url: session.url, id: session.id });
    }
    catch (e) {
        return next(e);
    }
});
app.post("/webhooks/stripe", async (req, res) => {
    try {
        if (!stripe)
            return res.status(500).send("Stripe not configured");
        const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").toString().trim();
        if (!webhookSecret)
            return res.status(500).send("Missing webhook secret");
        const sig = req.header("stripe-signature");
        if (!sig)
            return res.status(400).send("Missing stripe-signature");
        const payload = req.rawBody;
        if (!payload)
            return res.status(400).send("Missing raw body");
        const event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
        if (event.type === "checkout.session.completed") {
            const s = event.data.object;
            const entityId = (s.metadata?.entityId ?? s.client_reference_id ?? "").toString().trim();
            const planType = (s.metadata?.planType ?? "").toString().trim();
            if (entityId && planType) {
                const now = new Date();
                const end = new Date(now);
                end.setDate(end.getDate() + 30);
                // deactivate previous active subscriptions for the entity
                await db_1.prisma.tbl_Subscription.updateMany({
                    where: { entityId, status: "Active" },
                    data: { status: "Expired" },
                });
                await db_1.prisma.tbl_Subscription.create({
                    data: {
                        entityId,
                        planType,
                        status: "Active",
                        startDate: now,
                        endDate: end,
                    },
                });
            }
        }
        return res.json({ received: true });
    }
    catch (err) {
        return res.status(400).send(err?.message ?? "Webhook Error");
    }
});
app.use("/uploads", express_1.default.static(uploadsDir));
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:8081",
    },
});
io.on("connection", (socket) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token)
            return;
        const raw = typeof token === "string" ? token : "";
        const bearer = raw.toLowerCase().startsWith("bearer ") ? raw.slice("bearer ".length).trim() : raw;
        const secret = process.env.JWT_SECRET;
        if (!secret || !bearer)
            return;
        const decoded = jsonwebtoken_1.default.verify(bearer, secret);
        const roleId = decoded?.roleId != null ? Number(decoded.roleId) : null;
        const isAuthority = roleId === 1 || roleId === 4 || roleId === 5 || roleId === 6 || roleId === 7;
        if (isAuthority) {
            socket.join("authorities");
            console.log("ALERTS: User joined authority room");
        }
        if (roleId === 5) {
            socket.join("embassy_source");
        }
        if (roleId === 6) {
            socket.join("embassy_destination");
        }
    }
    catch {
        // ignore invalid tokens
    }
});
app.get("/Api/Workers/:workerId", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = Number(user?.roleId ?? 0);
        const workerId = (req.params?.workerId ?? "").toString().trim();
        if (!workerId)
            return res.status(400).json({ error: "workerId is required" });
        if (![1, 2, 3, 4, 5, 6, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        if (roleId === 2) {
            const myId = (user?.userKey ?? "").toString().trim();
            if (!myId || myId !== workerId)
                return res.status(403).json({ error: "Forbidden" });
        }
        else if (roleId !== 1) {
            const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(user);
            const scopedWorker = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
            if (!scopedWorker)
                return res.status(403).json({ error: "Forbidden" });
        }
        const personal = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({ where: { Worker_Id: workerId } });
        if (!personal)
            return res.status(404).json({ error: "Not found" });
        const permit = await db_1.prisma.tbl_Worker_PermitInsurance.findFirst({ where: { Worker_Id: workerId } });
        const employer = await db_1.prisma.tbl_Worker_EmployerInfo.findFirst({ where: { Worker_Id: workerId } });
        return res.json({ personal, permit, employer });
    }
    catch (e) {
        return next(e);
    }
});
app.put("/Api/Workers/:workerId", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = Number(user?.roleId ?? 0);
        const workerId = (req.params?.workerId ?? "").toString().trim();
        if (!workerId)
            return res.status(400).json({ error: "workerId is required" });
        // only admin/employer/agency/worker can update
        if (![1, 2, 3, 4].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        if (roleId === 2) {
            const myId = (user?.userKey ?? "").toString().trim();
            if (!myId || myId !== workerId)
                return res.status(403).json({ error: "Forbidden" });
        }
        else if (roleId !== 1) {
            const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(user);
            const scopedWorker = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
            if (!scopedWorker)
                return res.status(403).json({ error: "Forbidden" });
        }
        const name = req.body?.Name ?? req.body?.name;
        const email = req.body?.Email_Id ?? req.body?.emailId ?? req.body?.email;
        const contact = req.body?.Contact_Number ?? req.body?.contactNumber;
        const contactCountryCode = req.body?.Contact_Number_Country_Code ?? req.body?.contactCountryCode;
        const address = req.body?.Address ?? req.body?.address;
        const district = req.body?.District ?? req.body?.district;
        const stateRaw = req.body?.State ?? req.body?.state;
        const cityRaw = req.body?.City ?? req.body?.city;
        const nationalityRaw = req.body?.Nationality ?? req.body?.nationality;
        const gender = req.body?.Gender ?? req.body?.gender;
        const dateOfBirthRaw = req.body?.Date_Of_Birth ?? req.body?.dateOfBirth;
        const maritalStatusRaw = req.body?.Marital_Status ?? req.body?.maritalStatus;
        const highestEducation = req.body?.Highest_Education ?? req.body?.highestEducation;
        const motherName = req.body?.Mother_Name ?? req.body?.motherName;
        const fatherName = req.body?.Father_Name ?? req.body?.fatherName;
        const passportNumber = req.body?.Passport_Number ?? req.body?.passportNumber;
        const passportIssueRaw = req.body?.Passport_Issue_Date ?? req.body?.passportIssueDate;
        const passportExpireRaw = req.body?.Passport_Expire_Date ?? req.body?.passportExpireDate;
        const permitIssueRaw = req.body?.Permit_Issue_Date ?? req.body?.permitIssueDate;
        const permitExpireRaw = req.body?.Permit_Expire_Date ?? req.body?.permitExpireDate ?? req.body?.visaExpireDate;
        const permitIssuePlace = req.body?.Permit_Issue_Place ?? req.body?.permitIssuePlace;
        const insurancePolicyNumber = req.body?.Insurance_Policy_Number ?? req.body?.insurancePolicyNumber;
        const soscoNumber = req.body?.SOSCO_Number ?? req.body?.soscoNumber;
        const nationality = nationalityRaw != null && nationalityRaw !== "" ? Number(nationalityRaw) : undefined;
        const state = stateRaw != null && stateRaw !== "" ? Number(stateRaw) : undefined;
        const city = cityRaw != null && cityRaw !== "" ? Number(cityRaw) : undefined;
        const maritalStatus = maritalStatusRaw != null && maritalStatusRaw !== "" ? Number(maritalStatusRaw) : undefined;
        const dateOfBirth = dateOfBirthRaw ? new Date(String(dateOfBirthRaw)) : undefined;
        const passportIssue = passportIssueRaw ? new Date(String(passportIssueRaw)) : undefined;
        const passportExpire = passportExpireRaw ? new Date(String(passportExpireRaw)) : undefined;
        const permitIssue = permitIssueRaw ? new Date(String(permitIssueRaw)) : undefined;
        const permitExpire = permitExpireRaw ? new Date(String(permitExpireRaw)) : undefined;
        const updated = await db_1.prisma.tbl_Worker_PersonalInfo.update({
            where: { Worker_Id: workerId },
            data: {
                ...(name != null ? { Name: String(name) } : {}),
                ...(email != null ? { Email_Id: String(email) } : {}),
                ...(contact != null ? { Contact_Number: String(contact) } : {}),
                ...(contactCountryCode != null ? { Contact_Number_Country_Code: String(contactCountryCode) } : {}),
                ...(address != null ? { Address: String(address) } : {}),
                ...(district != null ? { District: String(district) } : {}),
                ...(gender != null ? { Gender: String(gender) } : {}),
                ...(highestEducation != null ? { Highest_Education: String(highestEducation) } : {}),
                ...(motherName != null ? { Mother_Name: String(motherName) } : {}),
                ...(fatherName != null ? { Father_Name: String(fatherName) } : {}),
                ...(passportNumber != null ? { Passport_Number: String(passportNumber) } : {}),
                ...(nationality != null && Number.isFinite(nationality) ? { Nationality: nationality } : {}),
                ...(state != null && Number.isFinite(state) ? { State: state } : {}),
                ...(city != null && Number.isFinite(city) ? { City: city } : {}),
                ...(maritalStatus != null && Number.isFinite(maritalStatus) ? { Marital_Status: maritalStatus } : {}),
                ...(dateOfBirth && !isNaN(dateOfBirth.getTime()) ? { Date_Of_Birth: dateOfBirth } : {}),
                ...(passportIssue && !isNaN(passportIssue.getTime()) ? { Passport_Issue_Date: passportIssue } : {}),
                ...(passportExpire && !isNaN(passportExpire.getTime()) ? { Passport_Expire_Date: passportExpire } : {}),
            },
        });
        if (permitIssue != null ||
            permitExpire != null ||
            permitIssuePlace != null ||
            insurancePolicyNumber != null ||
            soscoNumber != null) {
            await db_1.prisma.tbl_Worker_PermitInsurance.upsert({
                where: { Worker_Id: workerId },
                create: {
                    Worker_Id: workerId,
                    ...(permitIssue && !isNaN(permitIssue.getTime()) ? { Permit_Issue_Date: permitIssue } : {}),
                    ...(permitExpire && !isNaN(permitExpire.getTime()) ? { Permit_Expire_Date: permitExpire } : {}),
                    ...(permitIssuePlace != null ? { Permit_Issue_Place: String(permitIssuePlace) } : {}),
                    ...(insurancePolicyNumber != null ? { Insurance_Policy_Number: String(insurancePolicyNumber) } : {}),
                    ...(soscoNumber != null ? { SOSCO_Number: String(soscoNumber) } : {}),
                    Created_On: new Date(),
                },
                update: {
                    ...(permitIssue && !isNaN(permitIssue.getTime()) ? { Permit_Issue_Date: permitIssue } : {}),
                    ...(permitExpire && !isNaN(permitExpire.getTime()) ? { Permit_Expire_Date: permitExpire } : {}),
                    ...(permitIssuePlace != null ? { Permit_Issue_Place: String(permitIssuePlace) } : {}),
                    ...(insurancePolicyNumber != null ? { Insurance_Policy_Number: String(insurancePolicyNumber) } : {}),
                    ...(soscoNumber != null ? { SOSCO_Number: String(soscoNumber) } : {}),
                    Created_On: new Date(),
                },
            });
        }
        if (roleId !== 2) {
            const userRow = await db_1.prisma.tbl_User.findFirst({ where: { User_Id: workerId } });
            if (userRow) {
                await db_1.prisma.tbl_User.update({
                    where: { User_Id_Email_Id: { User_Id: userRow.User_Id, Email_Id: userRow.Email_Id } },
                    data: {
                        ...(email != null ? { Email_Id: String(email) } : {}),
                        ...(name != null ? { User_Name: String(name) } : {}),
                    },
                });
            }
        }
        const permit = await db_1.prisma.tbl_Worker_PermitInsurance.findFirst({ where: { Worker_Id: workerId } });
        return res.json({ ok: true, personal: updated, permit });
    }
    catch (e) {
        return next(e);
    }
});
app.post("/Api/Workers/Create", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = Number(user?.roleId ?? 0);
        if (![1, 3, 4, 5, 6, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const workerId = (req.body?.workerId ?? req.body?.Worker_Id ?? req.body?.userId ?? "").toString().trim();
        const passportNo = (req.body?.passportNo ?? req.body?.Passport_Number ?? req.body?.passportNumber ?? "").toString().trim();
        const emailId = (req.body?.emailId ?? req.body?.Email_Id ?? req.body?.email ?? "").toString().trim();
        const password = (req.body?.password ?? "").toString();
        const fullName = (req.body?.name ?? req.body?.fullName ?? "").toString().trim();
        const employerIdRaw = (req.body?.employerId ?? req.body?.Employer_Id ?? "").toString().trim();
        const employerId = roleId === 3 ? (user?.userKey ?? "").toString().trim() : employerIdRaw;
        if (roleId === 4 && !employerId) {
            return res.status(400).json({ error: "employerId is required" });
        }
        if (!workerId || !passportNo || !password) {
            return res.status(400).json({ error: "workerId, passportNo and password are required" });
        }
        const existingUser = await db_1.prisma.tbl_User.findFirst({
            where: {
                OR: [{ User_Id: workerId }, ...(emailId ? [{ Email_Id: emailId }] : [])],
            },
        });
        if (existingUser)
            return res.status(409).json({ error: "Worker user already exists" });
        const existingPassport = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({
            where: { Passport_Number: passportNo },
        });
        if (existingPassport)
            return res.status(409).json({ error: "Passport already exists" });
        const loginPwd = (0, cryptoLegacy_1.encryptLegacyPassword)(password, workerId);
        await db_1.prisma.tbl_User.create({
            data: {
                User_Id: workerId,
                Email_Id: emailId || `${workerId}@mwmsys.local`,
                Login_Pwd: loginPwd,
                User_Status: 1,
                User_Role: 2,
                User_Name: fullName || workerId,
                Created_On: new Date(),
            },
        });
        await db_1.prisma.tbl_Worker_PersonalInfo.create({
            data: {
                Worker_Id: workerId,
                Name: fullName || null,
                Passport_Number: passportNo,
                Email_Id: emailId || null,
                Created_On: new Date(),
                Employer_Id: employerId || null,
            },
        });
        return res.status(201).json({ ok: true, workerId });
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/dashboard/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = user?.roleId != null ? Number(user.roleId) : 0;
        // Worker
        if (roleId === 2) {
            const workerId = ((user?.userKey ?? "").toString().trim() || null) ?? null;
            if (!workerId)
                return res.status(400).json({ error: "Worker not found" });
            const myIncidents = await db_1.prisma.tbl_ProbSol.count({ where: { worker_ID: workerId } });
            const openIncidents = await db_1.prisma.tbl_ProbSol.count({ where: { worker_ID: workerId, OR: [{ IsResolved: false }, { IsResolved: null }] } });
            const myLeaves = await db_1.prisma.tbl_Leave.count({ where: { workerId } });
            const pendingLeaves = await db_1.prisma.tbl_Leave.count({ where: { workerId, status: "Pending" } });
            const openAttendance = await db_1.prisma.tbl_Attendance.count({ where: { workerId, checkOut: null } });
            return res.json({
                roleId,
                appRole: user?.appRole,
                cards: {
                    myIncidents,
                    openIncidents,
                    myLeaves,
                    pendingLeaves,
                    openAttendance,
                },
            });
        }
        // Employer/Agency/Admin/Authorities: compute based on scoped workers
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true },
            take: 5000,
        });
        const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
        const totalWorkers = workerIds.length;
        const incidents = workerIds.length
            ? await db_1.prisma.tbl_ProbSol.count({ where: { worker_ID: { in: workerIds } } })
            : 0;
        const openIncidents = workerIds.length
            ? await db_1.prisma.tbl_ProbSol.count({ where: { worker_ID: { in: workerIds }, OR: [{ IsResolved: false }, { IsResolved: null }] } })
            : 0;
        const leaves = workerIds.length ? await db_1.prisma.tbl_Leave.count({ where: { workerId: { in: workerIds } } }) : 0;
        const pendingLeaves = workerIds.length
            ? await db_1.prisma.tbl_Leave.count({ where: { workerId: { in: workerIds }, status: "Pending" } })
            : 0;
        const openAttendance = workerIds.length ? await db_1.prisma.tbl_Attendance.count({ where: { workerId: { in: workerIds }, checkOut: null } }) : 0;
        return res.json({
            roleId,
            appRole: user?.appRole,
            cards: {
                totalWorkers,
                incidents,
                openIncidents,
                leaves,
                pendingLeaves,
                openAttendance,
            },
        });
    }
    catch (e) {
        return next(e);
    }
});
app.post("/Api/Incidents", auth_1.requireAuth, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (![1, 3, 4, 5, 6, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        if (roleId === 3 || roleId === 4) {
            const entityId = (req.user?.userKey ?? "").toString().trim();
            if (!entityId)
                return res.status(400).json({ error: "Missing entity id" });
            const ok = await hasActivePlan(entityId);
            if (!ok)
                return res.status(402).json({ error: "Subscription required" });
        }
        const workerId = (req.body?.workerId ?? req.body?.Worker_Id ?? req.body?.WorkerId ?? "").toString().trim();
        const typeRaw = (req.body?.type ?? req.body?.Type ?? "Issue").toString().trim();
        const type = typeRaw.toLowerCase().includes("panic") ? "Panic" : "Issue";
        const title = (req.body?.title ?? req.body?.Title ?? (type === "Panic" ? "Panic Alert" : "Issue")).toString();
        const description = (req.body?.description ?? req.body?.Description ?? "").toString();
        if (!workerId)
            return res.status(400).json({ error: "workerId is required" });
        if (roleId !== 1) {
            const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
            const scopedWorker = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
            if (!scopedWorker)
                return res.status(403).json({ error: "Forbidden" });
        }
        const workerMeta = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({ where: { Worker_Id: workerId } });
        const employerMeta = await db_1.prisma.tbl_Worker_EmployerInfo.findFirst({ where: { Worker_Id: workerId } });
        const created = await db_1.prisma.tbl_ProbSol.create({
            data: {
                Prob_ID: workerMeta?.Passport_Number?.toString() ?? workerId,
                Type: type,
                Title: title,
                Description: description || title,
                ProbStatus: "New",
                Updated_On: new Date(),
                worker_ID: workerId,
                Current_Location: workerMeta?.Current_Location ?? undefined,
                Company_Name: employerMeta?.Employer_Name ?? workerMeta?.Company_Name ?? undefined,
                IsResolved: false,
            },
        });
        try {
            io.to("authorities").emit("new_trigger", {
                id: created.ID,
                title,
                description: description || title,
                workerId,
                companyName: employerMeta?.Employer_Name ?? null,
                createdAt: new Date().toISOString(),
            });
        }
        catch {
            // ignore emit errors
        }
        return res.status(201).json({ ok: true, id: created.ID });
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = user?.roleId != null ? Number(user.roleId) : null;
        const jwtUserId = user?.userId != null ? Number(user.userId) : 0;
        let workerId = null;
        let passportNo = null;
        if (roleId === 2) {
            workerId = (user?.userKey ?? "").toString().trim() || null;
            if (!workerId && Number.isFinite(jwtUserId) && jwtUserId > 0) {
                workerId = await findWorkerIdByJwtUserId(jwtUserId);
            }
            if (Number.isFinite(jwtUserId) && jwtUserId > 0) {
                passportNo = await findWorkerPassportByJwtUserId(jwtUserId);
            }
        }
        return res.json({
            claims: user,
            roleId,
            appRole: user?.appRole,
            userId: user?.userId,
            userKey: user?.userKey,
            workerId,
            passportNo,
        });
    }
    catch (e) {
        return next(e);
    }
});
async function hasActivePlan(entityId) {
    const now = new Date();
    const active = await db_1.prisma.tbl_Subscription.findFirst({
        where: {
            entityId,
            status: "Active",
            endDate: { gte: now },
        },
        orderBy: [{ endDate: "desc" }, { id: "desc" }],
    });
    const plan = (active?.planType ?? "").toString().trim().toLowerCase();
    return !!active && plan !== "free";
}
function requireActivePlanForWrite(req, res, next) {
    const user = req.user;
    const roleId = user?.roleId != null ? Number(user.roleId) : null;
    if (roleId !== 3 && roleId !== 4)
        return next();
    const entityId = (user?.userKey ?? "").toString().trim();
    if (!entityId)
        return res.status(400).json({ error: "Missing entity id" });
    hasActivePlan(entityId)
        .then((ok) => {
        if (!ok)
            return res.status(402).json({ error: "Subscription required" });
        return next();
    })
        .catch(() => res.status(500).json({ error: "Unable to verify subscription" }));
}
app.get("/Api/Employer/IncidentCounts", auth_1.requireAuth, (0, auth_1.checkRole)([1, 4, 5, 6, 7]), async (_req, res, next) => {
    try {
        const groups = await db_1.prisma.tbl_ProbSol.groupBy({
            by: ["Company_Name"],
            where: {
                AND: [
                    { Company_Name: { not: null } },
                    { Company_Name: { not: "" } },
                    {
                        OR: [{ IsResolved: false }, { IsResolved: null }],
                    },
                ],
            },
            _count: {
                _all: true,
            },
        });
        groups.sort((a, b) => Number(b?._count?._all ?? 0) - Number(a?._count?._all ?? 0));
        const map = {};
        for (const g of groups ?? []) {
            const k = g?.Company_Name != null ? String(g.Company_Name) : "";
            const v = g?._count?._all != null ? Number(g._count._all) : 0;
            if (k)
                map[k] = Number.isFinite(v) ? v : 0;
        }
        return res.json(map);
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/Employer/Incidents", auth_1.requireAuth, (0, auth_1.checkRole)([1, 4, 5, 6, 7]), async (req, res, next) => {
    const raw = Array.isArray(req.query.companyName) ? req.query.companyName[0] : req.query.companyName;
    const companyName = (raw ?? "").toString().trim();
    if (!companyName)
        return res.json([]);
    try {
        const rows = await db_1.prisma.tbl_ProbSol.findMany({
            where: {
                Company_Name: companyName,
            },
            select: {
                ID: true,
                Type: true,
                Title: true,
                Description: true,
                Updated_On: true,
                ProbStatus: true,
                IsResolved: true,
                worker_ID: true,
                Prob_ID: true,
                Current_Location: true,
                Company_Name: true,
                Lat: true,
                Lng: true,
            },
            orderBy: [{ Updated_On: "desc" }, { ID: "desc" }],
            take: 200,
        });
        return res.json(rows ?? []);
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/Attestation/List", auth_1.requireAuth, (0, auth_1.checkRole)([1, 4, 5, 6, 7]), async (_req, res, next) => {
    try {
        await ensureAttestationTableExists();
        const rows = (await db_1.prisma.$queryRawUnsafe("SELECT TOP (500) AttestationId, Worker_Id, Passport_Number, DocumentType, DocumentPath, Status, AdminRemarks, Created_On, Updated_On FROM Tbl_Attestation ORDER BY AttestationId DESC"));
        return res.json(rows ?? []);
    }
    catch (e) {
        return next(e);
    }
});
app.post("/Api/Attestation/Approve", auth_1.requireAuth, (0, auth_1.checkRole)([1, 4, 5, 6, 7]), async (req, res, next) => {
    const id = Number(req.body?.id ?? 0);
    const remarks = (req.body?.remarks ?? "").toString();
    if (!Number.isFinite(id) || id <= 0)
        return res.status(400).json({ error: "id is required" });
    try {
        await ensureAttestationTableExists();
        await db_1.prisma.$executeRawUnsafe("UPDATE Tbl_Attestation SET Status = 'Approved', AdminRemarks = @p1, Updated_On = GETDATE() WHERE AttestationId = @p2", remarks, id);
        return res.json({ ok: true });
    }
    catch (e) {
        return next(e);
    }
});
app.post("/Api/Attestation/Reject", auth_1.requireAuth, (0, auth_1.checkRole)([1, 4, 5, 6, 7]), async (req, res, next) => {
    const id = Number(req.body?.id ?? 0);
    const remarks = (req.body?.remarks ?? "").toString();
    if (!Number.isFinite(id) || id <= 0)
        return res.status(400).json({ error: "id is required" });
    try {
        await ensureAttestationTableExists();
        await db_1.prisma.$executeRawUnsafe("UPDATE Tbl_Attestation SET Status = 'Rejected', AdminRemarks = @p1, Updated_On = GETDATE() WHERE AttestationId = @p2", remarks, id);
        return res.json({ ok: true });
    }
    catch (e) {
        return next(e);
    }
});
function safeUnlinkUpload(uploadPath) {
    try {
        const p = (uploadPath ?? "").toString();
        if (!p.startsWith("/uploads/"))
            return;
        const filename = path_1.default.basename(p);
        if (!filename)
            return;
        const full = path_1.default.join(uploadsDir, filename);
        if (fs_1.default.existsSync(full)) {
            fs_1.default.unlinkSync(full);
        }
    }
    catch {
        // ignore
    }
}
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadsDir),
        filename: (_req, file, cb) => {
            const safeOriginal = (file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
            const ext = path_1.default.extname(safeOriginal);
            const base = path_1.default.basename(safeOriginal, ext);
            cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}_${base}${ext}`);
        },
    }),
    limits: {
        fileSize: 15 * 1024 * 1024,
    },
});
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
app.get("/Api/subscription/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = user?.roleId != null ? Number(user.roleId) : null;
        if (roleId !== 3 && roleId !== 4) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const entityId = (user?.userKey ?? "").toString().trim();
        if (!entityId) {
            return res.status(400).json({ error: "Missing entity id" });
        }
        const now = new Date();
        const active = await db_1.prisma.tbl_Subscription.findFirst({
            where: {
                entityId,
                status: "Active",
                endDate: { gte: now },
            },
            orderBy: [{ endDate: "desc" }, { id: "desc" }],
        });
        if (!active) {
            return res.json({ planType: "Free", status: "Active", endDate: null });
        }
        return res.json({ planType: active.planType, status: active.status, endDate: active.endDate });
    }
    catch (e) {
        return next(e);
    }
});
app.post("/Api/subscription/purchase", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = user?.roleId != null ? Number(user.roleId) : null;
        if (roleId !== 3 && roleId !== 4) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const entityId = (user?.userKey ?? "").toString().trim();
        if (!entityId) {
            return res.status(400).json({ error: "Missing entity id" });
        }
        const planType = (req.body?.planType ?? "").toString().trim();
        if (!planType) {
            return res.status(400).json({ error: "planType is required" });
        }
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + 30);
        const created = await db_1.prisma.tbl_Subscription.create({
            data: {
                entityId,
                planType,
                status: "Active",
                startDate: now,
                endDate: end,
            },
        });
        return res.status(201).json({ ok: true, id: created.id, planType: created.planType, endDate: created.endDate });
    }
    catch (e) {
        return next(e);
    }
});
function mapAppRole(userRole) {
    const r = userRole == null ? null : Number(userRole);
    if (r === 1)
        return "admin";
    if (r === 2)
        return "worker";
    if (r === 3)
        return "employer";
    if (r === 4)
        return "agency";
    if (r === 5)
        return "embassy_source";
    if (r === 6)
        return "embassy_destination";
    if (r === 7)
        return "labour";
    return "worker";
}
function roleNameToRoleId(role) {
    const r = (role ?? "").toString().toLowerCase();
    if (r === "admin")
        return 1;
    if (r === "worker")
        return 2;
    if (r === "employer")
        return 3;
    if (r === "agency" || r === "agent")
        return 4;
    if (r === "embassy_source")
        return 5;
    if (r === "embassy_destination")
        return 6;
    if (r === "labour" || r === "labor")
        return 7;
    return 2;
}
app.post("/signup", async (req, res) => {
    const userId = (req.body.userId ?? req.body.userName ?? req.body.username ?? "").toString().trim();
    const emailId = (req.body.emailId ?? req.body.email ?? "").toString().trim();
    const password = (req.body.password ?? "").toString();
    const role = (req.body.role ?? "worker").toString().toLowerCase();
    const passportNo = (req.body.passportNo ?? req.body.PassportNo ?? "").toString().trim();
    const employerName = (req.body.employerName ?? req.body.companyName ?? "").toString().trim();
    const employerAddress = (req.body.address ?? "").toString().trim();
    const companyPhone = (req.body.companyPhone ?? req.body.company_phone ?? req.body.phoneNo ?? "").toString().trim();
    const contactPersonName = (req.body.contactPersonName ?? req.body.contactPerson ?? "").toString().trim();
    const contactPersonPosition = (req.body.contactPersonPosition ?? req.body.position ?? "").toString().trim();
    const contactPersonIc = (req.body.contactPersonIc ?? req.body.contactPersonIcNo ?? "").toString().trim();
    const contactPersonEmail = (req.body.contactPersonEmail ?? emailId ?? "").toString().trim();
    const contactPersonPhone = (req.body.contactPersonPhone ?? req.body.hpNumber ?? req.body.contactNo ?? "").toString().trim();
    const ssmNumber = (req.body.ssmNumber ?? req.body.ssmRocRobNo ?? userId ?? "").toString().trim();
    const sectorRaw = req.body.sector;
    const sector = sectorRaw != null && sectorRaw !== "" ? Number(sectorRaw) : null;
    if (!userId || !emailId || !password) {
        return res.status(400).json({ error: "userId, emailId and password are required" });
    }
    const userRole = roleNameToRoleId(role);
    if (userRole === 2 && !passportNo) {
        return res.status(400).json({ error: "passportNo is required for worker signup" });
    }
    try {
        const existing = await db_1.prisma.tbl_User.findFirst({
            where: {
                OR: [{ User_Id: userId }, { Email_Id: emailId }],
            },
        });
        if (existing) {
            return res.status(409).json({ error: "User already exists" });
        }
        const loginPwd = (0, cryptoLegacy_1.encryptLegacyPassword)(password, userId);
        const created = await db_1.prisma.tbl_User.create({
            data: {
                User_Id: userId,
                Email_Id: emailId,
                Login_Pwd: loginPwd,
                User_Status: 1,
                User_Role: userRole,
                Created_On: new Date(),
            },
        });
        if (userRole === 2) {
            await db_1.prisma.tbl_Worker_PersonalInfo.create({
                data: {
                    Worker_Id: userId,
                    Passport_Number: passportNo,
                    Email_Id: emailId,
                    Created_On: new Date(),
                },
            });
        }
        if (userRole === 3) {
            try {
                await db_1.prisma.tbl_Employer.create({
                    data: {
                        User_Id: userId,
                        Employer_EmailID: emailId,
                        Employer_Name: employerName || userId,
                        Employer_Address: employerAddress || "-",
                        Employer_CompanyPhone: companyPhone || null,
                        Employer_OfficeNumber: companyPhone || null,
                        Employer_SSM_Number: ssmNumber || null,
                        Employer_SSM_ROC_ROB_Number: ssmNumber || null,
                        Employer_Sector: sector != null && Number.isFinite(sector) ? sector : null,
                        Employer_ContactPerson: contactPersonName || "-",
                        Employer_ContactPerson_IC: contactPersonIc || null,
                        Employer_ContactPerson_Email: contactPersonEmail || null,
                        Employer_ContactPerson_Phone: contactPersonPhone || null,
                        Employer_Position: contactPersonPosition || "-",
                        Employer_PIC_MobileNumber: contactPersonPhone || companyPhone || "-",
                        Created_On: new Date(),
                    },
                });
            }
            catch {
                // ignore employer profile insert errors
            }
        }
        if (userRole === 4) {
            try {
                await db_1.prisma.tbl_Agent.create({
                    data: {
                        User_Id: userId,
                        Agent_EmailID: emailId,
                        Agent_Name: (req.body.fullName ?? contactPersonName ?? userId).toString().trim() || userId,
                        Agent_Organization_Name: (req.body.organization ?? employerName ?? "-").toString().trim() || "-",
                        Agent_IC_Passport: (req.body.icOrPassport ?? contactPersonIc ?? userId).toString().trim() || userId,
                        Agent_Department: Number(req.body.departmentId ?? 1),
                        Agent_Country: Number(req.body.countryId ?? 1),
                        Agent_ContactNumber: contactPersonPhone || (req.body.contactNo ?? "-").toString().trim() || "-",
                        Created_On: new Date(),
                    },
                });
            }
            catch {
                // ignore agent profile insert errors
            }
        }
        return res.status(201).json({
            id: created.ID,
            userId: created.User_Id,
            emailId: created.Email_Id,
            role: mapAppRole(created.User_Role),
        });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Signup failed" });
    }
});
app.post("/auth/login", async (req, res) => {
    const userName = (req.body.userName ?? req.body.username ?? "").toString().trim();
    const password = (req.body.password ?? "").toString();
    if (!userName || !password) {
        return res.status(400).json({ error: "userName and password are required" });
    }
    // Reuse the same logic as /Api/token by calling it internally.
    // Keep behavior aligned for now.
    req.body = { username: userName, password };
    return app._router.handle({ ...req, url: "/Api/token", originalUrl: "/Api/token", method: "POST" }, res);
});
// OAuth-like token endpoint to match existing frontend call
// Accepts application/x-www-form-urlencoded with username/password
app.post("/Api/token", async (req, res) => {
    const userName = (req.body.username ?? req.body.userName ?? "").toString().trim();
    const password = (req.body.password ?? "").toString();
    const passportNo = (req.body.passportNo ?? req.body.PassportNo ?? "").toString().trim();
    if (!userName || !password) {
        return res.status(400).json({ error: "username and password are required" });
    }
    try {
        const user = await db_1.prisma.tbl_User.findFirst({
            where: {
                OR: [{ Email_Id: userName }, { User_Id: userName }],
            },
        });
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const userRoleId = user.User_Role != null ? Number(user.User_Role) : null;
        if (userRoleId === 2 && !passportNo) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        if (userRoleId === 2 && passportNo) {
            const worker = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({
                where: {
                    Worker_Id: user.User_Id,
                    Passport_Number: passportNo,
                },
            });
            if (!worker) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
        }
        if (user.User_Status != null && Number(user.User_Status) !== 1) {
            return res.status(403).json({ error: "Inactive user" });
        }
        const stored = (user.Login_Pwd ?? "").toString();
        const plainOk = stored === password;
        const salt = (user.User_Id ?? "").toString();
        const legacyOk = stored === (0, cryptoLegacy_1.encryptLegacyPassword)(password, salt);
        if (!plainOk && !legacyOk) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        let countryCode = undefined;
        if (userRoleId === 6) {
            const embassyUserId = (user.User_Id ?? "").toString().trim();
            const candidates = [
                { sql: "SELECT TOP 1 Nationality as value FROM Tbl_Embassy WHERE User_Id = @p1", param: embassyUserId, key: "value" },
                { sql: "SELECT TOP 1 Country_Code as value FROM Tbl_Embassy WHERE User_Id = @p1", param: embassyUserId, key: "value" },
                { sql: "SELECT TOP 1 CountryCode as value FROM Tbl_Embassy WHERE User_Id = @p1", param: embassyUserId, key: "value" },
                { sql: "SELECT TOP 1 Nationality as value FROM Tbl_User WHERE User_Id = @p1", param: embassyUserId, key: "value" },
                { sql: "SELECT TOP 1 Country_Code as value FROM Tbl_User WHERE User_Id = @p1", param: embassyUserId, key: "value" },
                { sql: "SELECT TOP 1 CountryCode as value FROM Tbl_User WHERE User_Id = @p1", param: embassyUserId, key: "value" },
            ];
            for (const c of candidates) {
                try {
                    const rows = (await db_1.prisma.$queryRawUnsafe(c.sql, c.param));
                    const row = Array.isArray(rows) ? rows[0] : null;
                    const raw = row?.[c.key];
                    const n = raw != null ? Number(raw) : NaN;
                    if (Number.isFinite(n) && n > 0) {
                        countryCode = n;
                        break;
                    }
                }
                catch {
                    // ignore and try next
                }
            }
        }
        const claims = {
            userId: Number(user.ID),
            userKey: user.User_Id?.toString() ?? undefined,
            roleId: userRoleId != null ? userRoleId : undefined,
            appRole: mapAppRole(user.User_Role),
            countryCode,
            emailId: user.Email_Id?.toString(),
            userName: user.User_Name?.toString() ?? user.User_Id?.toString() ?? userName,
        };
        const access_token = (0, auth_1.signToken)(claims);
        return res.json({
            access_token,
            token_type: "bearer",
            expires_in: 86400,
            userName: claims.userName,
        });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Login failed" });
    }
});
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
async function findWorkerPassportByJwtUserId(jwtUserId) {
    if (!Number.isFinite(jwtUserId) || jwtUserId <= 0)
        return null;
    const user = await db_1.prisma.tbl_User.findFirst({
        where: { ID: jwtUserId },
    });
    const workerId = user?.User_Id?.toString();
    if (!workerId)
        return null;
    const worker = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({
        where: { Worker_Id: workerId },
    });
    const passport = worker?.Passport_Number?.toString()?.trim();
    return passport ? passport : null;
}
async function findWorkerIdByJwtUserId(jwtUserId) {
    if (!Number.isFinite(jwtUserId) || jwtUserId <= 0)
        return null;
    const user = await db_1.prisma.tbl_User.findFirst({
        where: { ID: jwtUserId },
    });
    const workerId = user?.User_Id?.toString()?.trim();
    return workerId ? workerId : null;
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
                ProbStatus: "New",
                Updated_On: new Date(),
                worker_ID: workerMeta?.workerId ?? workerIdFromJwt ?? undefined,
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
        io.to("authorities").emit("new_trigger", data);
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
// New route name requested
app.post("/panic", auth_1.requireAuth, upload.single("file"), handlePanic);
// Backward-compatible route for existing frontend
app.post("/Api/Panic", auth_1.requireAuth, upload.single("file"), handlePanic);
app.get("/Api/Worker/Documents", auth_1.requireAuth, async (req, res, next) => {
    try {
        const jwtUserId = Number(req.user?.userId ?? 0);
        const workerId = await findWorkerIdByJwtUserId(jwtUserId);
        if (!workerId)
            return res.status(400).json({ error: "Worker not found" });
        const row = await db_1.prisma.tbl_Worker_Attachments.findFirst({
            where: { Worker_Id: workerId },
        });
        const docs = [
            { type: "passport", name: "Passport Copy", path: row?.Passport_Copy ?? null, filename: row?.Passport_Copy_Filename ?? null },
            { type: "permit", name: "Work Permit", path: row?.Permit_Copy ?? null, filename: row?.Permit_Copy_Filename ?? null },
            { type: "insurance", name: "Insurance Policy", path: row?.Insurance_Policy ?? null, filename: row?.Insurance_Policy_Filename ?? null },
            { type: "contract", name: "Employment Contract", path: row?.Employment_Contract ?? null, filename: row?.Employment_Contract_Filename ?? null },
            { type: "demand_letter", name: "Demand Letter", path: row?.Demand_Letter ?? null, filename: row?.Demand_Letter_Filename ?? null },
        ].map((d) => {
            const p = d.path != null ? String(d.path) : "";
            const isUrl = p.startsWith("http://") || p.startsWith("https://") || p.startsWith("/uploads/");
            const url = p ? (isUrl ? (p.startsWith("/uploads/") ? `${req.protocol}://${req.get("host")}${p}` : p) : "") : "";
            return { ...d, url, hasFile: !!url };
        });
        return res.json({ workerId, documents: docs });
    }
    catch (e) {
        return next(e);
    }
});
app.post("/Api/Worker/Documents", auth_1.requireAuth, upload.single("file"), async (req, res, next) => {
    const docType = (req.body?.docType ?? req.body?.DocType ?? "").toString().trim().toLowerCase();
    const uploaded = req.file;
    if (!uploaded?.filename) {
        return res.status(400).json({ error: "file is required" });
    }
    try {
        const jwtUserId = Number(req.user?.userId ?? 0);
        const workerId = await findWorkerIdByJwtUserId(jwtUserId);
        if (!workerId)
            return res.status(400).json({ error: "Worker not found" });
        const uploadPath = `/uploads/${uploaded.filename}`;
        const fileName = (uploaded.originalname ?? uploaded.filename).toString();
        const allowed = new Set(["passport", "permit", "insurance", "contract", "demand_letter"]);
        const t = allowed.has(docType) ? docType : "passport";
        const existing = await db_1.prisma.tbl_Worker_Attachments.findFirst({ where: { Worker_Id: workerId } });
        const data = { Worker_Id: workerId };
        if (t === "passport") {
            safeUnlinkUpload(existing?.Passport_Copy);
            data.Passport_Copy = uploadPath;
            data.Passport_Copy_Filename = fileName;
        }
        else if (t === "permit") {
            safeUnlinkUpload(existing?.Permit_Copy);
            data.Permit_Copy = uploadPath;
            data.Permit_Copy_Filename = fileName;
        }
        else if (t === "insurance") {
            safeUnlinkUpload(existing?.Insurance_Policy);
            data.Insurance_Policy = uploadPath;
            data.Insurance_Policy_Filename = fileName;
        }
        else if (t === "contract") {
            safeUnlinkUpload(existing?.Employment_Contract);
            data.Employment_Contract = uploadPath;
            data.Employment_Contract_Filename = fileName;
        }
        else if (t === "demand_letter") {
            safeUnlinkUpload(existing?.Demand_Letter);
            data.Demand_Letter = uploadPath;
            data.Demand_Letter_Filename = fileName;
        }
        await db_1.prisma.tbl_Worker_Attachments.upsert({
            where: { Worker_Id: workerId },
            create: data,
            update: data,
        });
        return res.json({ ok: true, docType: t, url: `${req.protocol}://${req.get("host")}${uploadPath}` });
    }
    catch (e) {
        return next(e);
    }
});
app.delete("/Api/Worker/Documents", auth_1.requireAuth, async (req, res, next) => {
    const raw = Array.isArray(req.query.docType) ? req.query.docType[0] : req.query.docType;
    const docType = (raw ?? "").toString().trim().toLowerCase();
    try {
        const jwtUserId = Number(req.user?.userId ?? 0);
        const workerId = await findWorkerIdByJwtUserId(jwtUserId);
        if (!workerId)
            return res.status(400).json({ error: "Worker not found" });
        const allowed = new Set(["passport", "permit", "insurance", "contract", "demand_letter"]);
        const t = allowed.has(docType) ? docType : "";
        if (!t)
            return res.status(400).json({ error: "docType is required" });
        const existing = await db_1.prisma.tbl_Worker_Attachments.findFirst({ where: { Worker_Id: workerId } });
        if (!existing)
            return res.json({ ok: true });
        const data = {};
        if (t === "passport") {
            safeUnlinkUpload(existing?.Passport_Copy);
            data.Passport_Copy = null;
            data.Passport_Copy_Filename = null;
        }
        else if (t === "permit") {
            safeUnlinkUpload(existing?.Permit_Copy);
            data.Permit_Copy = null;
            data.Permit_Copy_Filename = null;
        }
        else if (t === "insurance") {
            safeUnlinkUpload(existing?.Insurance_Policy);
            data.Insurance_Policy = null;
            data.Insurance_Policy_Filename = null;
        }
        else if (t === "contract") {
            safeUnlinkUpload(existing?.Employment_Contract);
            data.Employment_Contract = null;
            data.Employment_Contract_Filename = null;
        }
        else if (t === "demand_letter") {
            safeUnlinkUpload(existing?.Demand_Letter);
            data.Demand_Letter = null;
            data.Demand_Letter_Filename = null;
        }
        await db_1.prisma.tbl_Worker_Attachments.update({
            where: { Worker_Id: workerId },
            data,
        });
        return res.json({ ok: true });
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/Worker/Problems", auth_1.requireAuth, async (req, res, next) => {
    try {
        const jwtUserId = Number(req.user?.userId ?? 0);
        const workerId = await findWorkerIdByJwtUserId(jwtUserId);
        const passport = await findWorkerPassportByJwtUserId(jwtUserId);
        if (!workerId && !passport)
            return res.json([]);
        const rows = await db_1.prisma.tbl_ProbSol.findMany({
            where: {
                OR: [
                    ...(workerId ? [{ worker_ID: workerId }] : []),
                    ...(passport ? [{ Prob_ID: passport }] : []),
                ],
            },
            select: {
                ID: true,
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
        return res.json(rows ?? []);
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/Panic/Latest", auth_1.requireAuth, (0, auth_1.checkRole)([1, 4, 5, 6, 7]), async (req, res, next) => {
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
const requireAuthority = (0, auth_1.checkRole)([1, 4, 5, 6, 7]);
const requireReportsAccess = (0, auth_1.checkRole)([1, 3, 4, 5, 6, 7]);
app.post("/Api/Panic/Forward", auth_1.requireAuth, requireAuthority, async (req, res, next) => {
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
        const payload = {
            id: row.ID,
            title: row?.Title ?? "Panic Alert",
            description: row?.Description ?? "",
            workerId: row?.worker_ID ?? null,
            companyName: row?.Company_Name ?? null,
            currentLocation: row?.Current_Location ?? null,
            createdOn: row?.Updated_On ?? null,
        };
        io.to(target).emit("panic_forwarded", payload);
        return res.json({ ok: true });
    }
    catch (e) {
        return next(e);
    }
});
app.post("/Api/Problems/Resolve", auth_1.requireAuth, requireAuthority, async (req, res, next) => {
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
function monthKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}
function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function startOfWeekMonday(d) {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = (day + 6) % 7;
    copy.setDate(copy.getDate() - diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
}
app.get("/api/admin/stats", auth_1.requireAuth, requireAuthority, async (_req, res, next) => {
    try {
        const now = new Date();
        const activeAlerts = await db_1.prisma.tbl_ProbSol.count({
            where: {
                OR: [{ IsResolved: false }, { IsResolved: null }],
            },
        });
        const activePanicAlerts = await db_1.prisma.tbl_ProbSol.count({
            where: {
                Type: "Panic",
                OR: [{ IsResolved: false }, { IsResolved: null }],
            },
        });
        const activeIssues = await db_1.prisma.tbl_ProbSol.count({
            where: {
                NOT: { Type: "Panic" },
                OR: [{ IsResolved: false }, { IsResolved: null }],
            },
        });
        const totalUsersRows = (await db_1.prisma.$queryRawUnsafe("SELECT COUNT(1) as cnt FROM Tbl_User"));
        const totalUsers = totalUsersRows?.[0]?.cnt != null ? Number(totalUsersRows[0].cnt) : 0;
        const months = [];
        const endMonth = startOfMonth(now);
        for (let i = 11; i >= 0; i--) {
            const d = new Date(endMonth.getFullYear(), endMonth.getMonth() - i, 1);
            months.push({
                key: monthKey(d),
                month: d.toLocaleString("en-US", { month: "short" }),
            });
        }
        const start12Months = new Date(endMonth.getFullYear(), endMonth.getMonth() - 11, 1);
        const monthRows = await db_1.prisma.tbl_ProbSol.findMany({
            where: {
                Updated_On: {
                    gte: start12Months,
                },
            },
            select: {
                Updated_On: true,
            },
            take: 200000,
        });
        const monthCounts = new Map();
        for (const r of monthRows ?? []) {
            const dt = r?.Updated_On ? new Date(r.Updated_On) : null;
            if (!dt || !Number.isFinite(dt.getTime()))
                continue;
            const k = monthKey(dt);
            monthCounts.set(k, (monthCounts.get(k) ?? 0) + 1);
        }
        const alertTrends = months.map((m) => ({
            key: m.key,
            month: m.month,
            alerts: monthCounts.get(m.key) ?? 0,
        }));
        const workersByCountryRows = (await db_1.prisma.$queryRawUnsafe("SELECT ISNULL(c.Country_Name, 'Unknown') as name, COUNT(1) as value FROM Tbl_User u INNER JOIN Tbl_Worker_PersonalInfo wpi ON wpi.Worker_Id = u.User_Id LEFT JOIN Tbl_Country c ON c.ID = wpi.Nationality GROUP BY c.Country_Name ORDER BY value DESC"));
        const workersByCountry = (workersByCountryRows ?? []).map((r) => ({
            name: r?.name != null ? String(r.name) : "Unknown",
            value: r?.value != null ? Number(r.value) : 0,
        }));
        const totalWorkers = workersByCountry.reduce((sum, x) => sum + (Number.isFinite(x.value) ? x.value : 0), 0);
        const weekStart = startOfWeekMonday(now);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekRows = await db_1.prisma.tbl_ProbSol.findMany({
            where: {
                Updated_On: {
                    gte: weekStart,
                    lt: weekEnd,
                },
            },
            select: {
                Type: true,
                Updated_On: true,
            },
            take: 200000,
        });
        const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const weeklyMap = new Map();
        for (const d of dayLabels)
            weeklyMap.set(d, { panic: 0, issue: 0 });
        for (const r of weekRows ?? []) {
            const dt = r?.Updated_On ? new Date(r.Updated_On) : null;
            if (!dt || !Number.isFinite(dt.getTime()))
                continue;
            const idx = (dt.getDay() + 6) % 7;
            const label = dayLabels[idx] ?? "Mon";
            const entry = weeklyMap.get(label);
            if (!entry)
                continue;
            const t = r?.Type != null ? String(r.Type) : "";
            if (t.toLowerCase() === "panic")
                entry.panic += 1;
            else
                entry.issue += 1;
        }
        const weeklyOverview = dayLabels.map((d) => ({ day: d, ...weeklyMap.get(d) }));
        const recentProblems = await db_1.prisma.tbl_ProbSol.findMany({
            select: {
                ID: true,
                Type: true,
                Title: true,
                Updated_On: true,
                worker_ID: true,
                Current_Location: true,
                Company_Name: true,
                Lat: true,
                Lng: true,
                IsResolved: true,
            },
            orderBy: [{ Updated_On: "desc" }, { ID: "desc" }],
            take: 5,
        });
        const recentUsers = (await db_1.prisma.$queryRawUnsafe("SELECT TOP (5) ID, User_Id, User_Name, Created_On FROM Tbl_User ORDER BY Created_On DESC, ID DESC"));
        const activity = [];
        for (const p of recentProblems ?? []) {
            const id = p?.ID != null ? Number(p.ID) : 0;
            const createdAt = p?.Updated_On ? new Date(p.Updated_On) : null;
            const typeRaw = p?.Type != null ? String(p.Type) : "";
            const isPanic = typeRaw.toLowerCase() === "panic";
            activity.push({
                id: `probsol-${id}`,
                eventType: isPanic ? "panic" : "issue",
                action: isPanic ? "Panic Alert triggered" : "Issue reported",
                user: p?.worker_ID != null ? String(p.worker_ID) : "Worker",
                title: p?.Title != null ? String(p.Title) : null,
                createdAt: createdAt && Number.isFinite(createdAt.getTime()) ? createdAt.toISOString() : null,
            });
        }
        for (const u of recentUsers ?? []) {
            const id = u?.ID != null ? Number(u.ID) : 0;
            const createdAt = u?.Created_On ? new Date(u.Created_On) : null;
            activity.push({
                id: `user-${id}`,
                eventType: "registration",
                action: "New user registered",
                user: (u?.User_Name ?? u?.User_Id ?? "User").toString(),
                title: null,
                createdAt: createdAt && Number.isFinite(createdAt.getTime()) ? createdAt.toISOString() : null,
            });
        }
        activity.sort((a, b) => {
            const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bt - at;
        });
        const recentActivity = activity.slice(0, 5);
        return res.json({
            generatedAt: new Date().toISOString(),
            activeAlerts,
            activePanicAlerts,
            activeIssues,
            totalUsers,
            alertTrends,
            workersByCountry,
            totalWorkers,
            weeklyOverview,
            recentActivity,
        });
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/Employers/List", auth_1.requireAuth, requireAuthority, async (_req, res, next) => {
    try {
        const rows = (await db_1.prisma.$queryRawUnsafe("SELECT TOP (500) User_Id, Employer_Name, Employer_Address, Employer_ContactPerson, Employer_Position, Employer_EmailID, Employer_OfficeNumber, Employer_PIC_MobileNumber, Created_On FROM Tbl_Employer ORDER BY Created_On DESC"));
        return res.json(rows ?? []);
    }
    catch (e) {
        return next(e);
    }
});
app.get("/api/search/global", auth_1.requireAuth, requireAuthority, async (req, res, next) => {
    const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
    const q = (rawQ ?? "").toString().trim();
    if (!q)
        return res.json({ workers: [], employers: [] });
    try {
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const workers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: {
                ...scopeWhere,
                OR: [{ Worker_Id: { contains: q } }, { Name: { contains: q } }, { Passport_Number: { contains: q } }],
            },
            select: { Worker_Id: true, Name: true, Passport_Number: true, Created_On: true },
            orderBy: [{ Created_On: "desc" }],
            take: 50,
        });
        const employers = await db_1.prisma.tbl_Employer.findMany({
            where: {
                OR: [
                    { Employer_Name: { contains: q } },
                    { Employer_ContactPerson: { contains: q } },
                    { Employer_EmailID: { contains: q } },
                    { User_Id: { contains: q } },
                ],
            },
            select: { User_Id: true, Employer_Name: true, Employer_ContactPerson: true, Employer_EmailID: true, Created_On: true },
            orderBy: [{ Created_On: "desc" }],
            take: 50,
        });
        return res.json({ workers: workers ?? [], employers: employers ?? [] });
    }
    catch (e) {
        return next(e);
    }
});
app.get("/api/reports/entry", auth_1.requireAuth, requireReportsAccess, async (req, res, next) => {
    const rawFrom = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const rawTo = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const from = rawFrom ? new Date(String(rawFrom)) : null;
    const to = rawTo ? new Date(String(rawTo)) : null;
    try {
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const rows = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: {
                ...scopeWhere,
                ...(from && Number.isFinite(from.getTime())
                    ? {
                        Created_On: {
                            gte: from,
                            ...(to && Number.isFinite(to.getTime()) ? { lt: to } : {}),
                        },
                    }
                    : to && Number.isFinite(to.getTime())
                        ? {
                            Created_On: {
                                lt: to,
                            },
                        }
                        : {}),
            },
            select: {
                Worker_Id: true,
                Name: true,
                Passport_Number: true,
                Created_On: true,
            },
            orderBy: [{ Created_On: "desc" }],
            take: 2000,
        });
        const workerIds = Array.from(new Set((rows ?? []).map((r) => (r.Worker_Id ?? "").toString()).filter(Boolean)));
        const employers = workerIds.length
            ? await db_1.prisma.tbl_Worker_EmployerInfo.findMany({
                where: { Worker_Id: { in: workerIds } },
                select: { Worker_Id: true, Employer_Name: true },
                take: 5000,
            })
            : [];
        const employerMap = new Map((employers ?? []).map((e) => [String(e.Worker_Id), (e.Employer_Name ?? "").toString()]));
        return res.json((rows ?? []).map((r) => ({
            ...r,
            Current_Location: null,
            Company_Name: employerMap.get(String(r.Worker_Id)) ?? null,
        })));
    }
    catch (e) {
        return next(e);
    }
});
app.get("/api/reports/visa-expire", auth_1.requireAuth, requireReportsAccess, async (req, res, next) => {
    const rawDays = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
    const days = Math.min(3650, Math.max(1, Number(rawDays ?? 90)));
    try {
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + days);
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true, Name: true, Passport_Number: true, Created_On: true },
            take: 5000,
        });
        const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
        const permits = workerIds.length
            ? await db_1.prisma.tbl_Worker_PermitInsurance.findMany({
                where: { Worker_Id: { in: workerIds }, OR: [{ Permit_Expire_Date: null }, { Permit_Expire_Date: { gte: now, lt: end } }] },
                select: { Worker_Id: true, Permit_Expire_Date: true },
                take: 5000,
            })
            : [];
        const employers = workerIds.length
            ? await db_1.prisma.tbl_Worker_EmployerInfo.findMany({
                where: { Worker_Id: { in: workerIds } },
                select: { Worker_Id: true, Employer_Name: true },
                take: 5000,
            })
            : [];
        const employerMap = new Map((employers ?? []).map((e) => [String(e.Worker_Id), (e.Employer_Name ?? "").toString()]));
        const metaByWorkerId = new Map((scopedWorkers ?? []).map((w) => [
            String(w.Worker_Id),
            {
                Worker_Id: w.Worker_Id,
                Name: w.Name,
                Passport_Number: w.Passport_Number,
                Created_On: w.Created_On,
            },
        ]));
        const rows = (permits ?? []).map((p) => {
            const m = metaByWorkerId.get(String(p.Worker_Id));
            return {
                Worker_Id: p.Worker_Id,
                Name: m?.Name ?? null,
                Passport_Number: m?.Passport_Number ?? null,
                Permit_Expire_Date: p.Permit_Expire_Date,
                Created_On: m?.Created_On ?? null,
                Company_Name: employerMap.get(String(p.Worker_Id)) ?? null,
                StatusLabel: p.Permit_Expire_Date == null ? "Missing Data" : "OK",
            };
        });
        return res.json({ windowDays: days, rows: rows ?? [] });
    }
    catch (e) {
        return next(e);
    }
});
app.get("/api/reports/insurance-expire", auth_1.requireAuth, requireReportsAccess, async (req, res, next) => {
    const rawDays = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
    const days = Math.min(3650, Math.max(1, Number(rawDays ?? 90)));
    try {
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + days);
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true, Name: true, Passport_Number: true, Created_On: true },
            take: 5000,
        });
        const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
        const employer = workerIds.length
            ? await db_1.prisma.tbl_Worker_EmployerInfo.findMany({
                where: {
                    Worker_Id: { in: workerIds },
                    OR: [{ Contract_Expiry_Date: null }, { Contract_Expiry_Date: { gte: now, lt: end } }],
                },
                select: { Worker_Id: true, Employer_Name: true, Contract_Expiry_Date: true },
                take: 5000,
            })
            : [];
        const metaByWorkerId = new Map((scopedWorkers ?? []).map((w) => [
            String(w.Worker_Id),
            {
                Worker_Id: w.Worker_Id,
                Name: w.Name,
                Passport_Number: w.Passport_Number,
                Created_On: w.Created_On,
            },
        ]));
        const rows = (employer ?? []).map((e) => {
            const m = metaByWorkerId.get(String(e.Worker_Id));
            return {
                Worker_Id: e.Worker_Id,
                Name: m?.Name ?? null,
                Passport_Number: m?.Passport_Number ?? null,
                Contract_Expiry_Date: e.Contract_Expiry_Date,
                Created_On: m?.Created_On ?? null,
                Company_Name: e.Employer_Name ?? null,
                StatusLabel: e.Contract_Expiry_Date == null ? "Missing Data" : "OK",
            };
        });
        return res.json({ windowDays: days, rows: rows ?? [] });
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/Panic/Active", auth_1.requireAuth, requireAuthority, async (_req, res, next) => {
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
                OR: [{ IsResolved: false }, { IsResolved: null }],
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
app.get("/Api/Panic/History", auth_1.requireAuth, requireAuthority, async (_req, res, next) => {
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
app.get("/Api/Incidents", auth_1.requireAuth, requireAuthority, async (_req, res, next) => {
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
                NOT: { Type: "Panic" },
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
app.get("/Api/Incidents/:id", auth_1.requireAuth, requireAuthority, async (req, res, next) => {
    const id = Number(req.params?.id ?? 0);
    if (!Number.isFinite(id) || id <= 0)
        return res.status(400).json({ error: "Invalid id" });
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        const row = await db_1.prisma.tbl_ProbSol.findFirst({ where: { ID: id } });
        if (!row)
            return res.status(404).json({ error: "Not found" });
        if (roleId !== 1) {
            const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
            const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
                where: scopeWhere,
                select: { Worker_Id: true },
                take: 5000,
            });
            const allowed = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));
            const workerId = row?.worker_ID != null ? String(row.worker_ID) : "";
            if (!workerId || !allowed.has(workerId))
                return res.status(403).json({ error: "Forbidden" });
        }
        return res.json(row);
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/Alerts/Recent", auth_1.requireAuth, requireAuthority, async (req, res, next) => {
    try {
        const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
        const limit = Math.min(200, Math.max(1, Number(rawLimit ?? 50)));
        const roleId = Number(req.user?.roleId ?? 0);
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true },
            take: 5000,
        });
        const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));
        if (roleId !== 1 && !allowedWorkerIds.size) {
            return res.json({ rows: [] });
        }
        const incidents = await db_1.prisma.tbl_ProbSol.findMany({
            where: {
                ...(roleId !== 1 && allowedWorkerIds.size ? { worker_ID: { in: Array.from(allowedWorkerIds) } } : {}),
            },
            select: {
                ID: true,
                Type: true,
                Title: true,
                Description: true,
                Updated_On: true,
                worker_ID: true,
                Company_Name: true,
            },
            orderBy: [{ Updated_On: "desc" }, { ID: "desc" }],
            take: limit,
        });
        const leave = await db_1.prisma.tbl_Leave.findMany({
            where: {
                status: { in: ["Approved", "Rejected"] },
                ...(roleId !== 1 && allowedWorkerIds.size ? { workerId: { in: Array.from(allowedWorkerIds) } } : {}),
            },
            select: { id: true, workerId: true, leaveType: true, status: true, startDate: true, endDate: true },
            orderBy: [{ id: "desc" }],
            take: Math.min(100, limit),
        });
        const payroll = await db_1.prisma.tbl_Payroll.findMany({
            where: {
                ...(roleId !== 1 && allowedWorkerIds.size ? { workerId: { in: Array.from(allowedWorkerIds) } } : {}),
            },
            select: { id: true, workerId: true, month: true, year: true, amount: true, isPaid: true },
            orderBy: [{ id: "desc" }],
            take: Math.min(100, limit),
        });
        const rows = [
            ...(incidents ?? []).map((x) => ({
                id: x.ID,
                kind: x.Type === "Panic" ? "panic_forwarded" : "new_trigger",
                title: (x.Title ?? x.Type ?? "Alert").toString(),
                description: (x.Description ?? "").toString(),
                workerId: x.worker_ID != null ? String(x.worker_ID) : null,
                companyName: x.Company_Name != null ? String(x.Company_Name) : null,
                createdAt: x.Updated_On ? new Date(x.Updated_On).toISOString() : null,
            })),
            ...(leave ?? []).map((x) => ({
                id: x.id,
                kind: "new_trigger",
                title: `Leave ${String(x.status ?? "")}`,
                description: `Leave ${String(x.status ?? "").toLowerCase()} (${String(x.leaveType ?? "")}) for worker ${String(x.workerId ?? "")}`,
                workerId: x.workerId ?? null,
                companyName: null,
                createdAt: x.endDate ? new Date(x.endDate).toISOString() : null,
            })),
            ...(payroll ?? []).map((x) => ({
                id: x.id,
                kind: "new_trigger",
                title: "Payroll uploaded",
                description: `Payroll uploaded for worker ${String(x.workerId ?? "")} (${String(x.month ?? "")}/${String(x.year ?? "")})`,
                workerId: x.workerId ?? null,
                companyName: null,
                createdAt: null,
            })),
        ];
        rows.sort((a, b) => {
            const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bt - at;
        });
        return res.json({ rows: rows.slice(0, limit) });
    }
    catch (e) {
        return next(e);
    }
});
app.delete("/Api/Incidents/:id", auth_1.requireAuth, (0, auth_1.checkRole)([1]), async (req, res, next) => {
    const id = Number(req.params?.id ?? 0);
    if (!Number.isFinite(id) || id <= 0)
        return res.status(400).json({ error: "Invalid id" });
    try {
        await db_1.prisma.tbl_ProbSol.delete({ where: { ID: id } });
        return res.json({ ok: true });
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/HRMS/Attendance", auth_1.requireAuth, async (req, res, next) => {
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
        const rows = await db_1.prisma.tbl_Attendance.findMany({
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
app.get("/Api/HRMS/Attendance/me", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
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
app.post("/Api/HRMS/Attendance/ClockIn", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
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
app.post("/Api/HRMS/Attendance/ClockOut", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
    try {
        const userKey = (req.user?.userKey ?? "").toString().trim();
        if (!userKey)
            return res.status(400).json({ error: "Missing worker id" });
        const open = await db_1.prisma.tbl_Attendance.findFirst({
            where: { workerId: userKey, checkOut: null },
            orderBy: [{ id: "desc" }],
        });
        if (!open)
            return res.status(409).json({ error: "No open attendance record" });
        const updated = await db_1.prisma.tbl_Attendance.update({
            where: { id: open.id },
            data: { checkOut: new Date() },
        });
        return res.json(updated);
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/HRMS/Leave", auth_1.requireAuth, async (req, res, next) => {
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
app.post("/Api/HRMS/Leave/Apply", auth_1.requireAuth, (0, auth_1.checkRole)([2]), async (req, res, next) => {
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
app.post("/Api/HRMS/Leave/Decision", auth_1.requireAuth, requireActivePlanForWrite, async (req, res, next) => {
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
            io.to("authorities").emit("new_trigger", {
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
app.get("/Api/HRMS/Payroll", auth_1.requireAuth, async (req, res, next) => {
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
app.post("/Api/HRMS/Payroll/Upload", auth_1.requireAuth, requireActivePlanForWrite, async (req, res, next) => {
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
            io.to("authorities").emit("new_trigger", {
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
app.get("/Api/HRMS/Contracts/Expiring", auth_1.requireAuth, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        if (![1, 3, 4, 5, 6, 7].includes(roleId))
            return res.status(403).json({ error: "Forbidden" });
        const rawDays = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
        const days = Math.min(3650, Math.max(1, Number(rawDays ?? 90)));
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + days);
        const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
        const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where: scopeWhere,
            select: { Worker_Id: true },
            take: 5000,
        });
        const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
        if (!workerIds.length)
            return res.json({ windowDays: days, rows: [] });
        const rows = await db_1.prisma.tbl_Worker_EmployerInfo.findMany({
            where: {
                Worker_Id: { in: workerIds },
                Contract_Expiry_Date: {
                    gte: now,
                    lt: end,
                },
            },
            select: {
                Worker_Id: true,
                Employer_Name: true,
                Contract_Expiry_Date: true,
                Contract_issue_Date: true,
            },
            orderBy: [{ Contract_Expiry_Date: "asc" }],
            take: 1000,
        });
        return res.json({ windowDays: days, rows: rows ?? [] });
    }
    catch (e) {
        return next(e);
    }
});
app.get("/Api/Workers/List", auth_1.requireAuth, requireReportsAccess, async (_req, res, next) => {
    try {
        const where = await (0, queryGuard_1.buildWorkerScopeWhere)(_req.user);
        const rows = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
            where,
            select: {
                Worker_Id: true,
                Passport_Number: true,
                Email_Id: true,
                Created_On: true,
                Nationality: true,
            },
            orderBy: [{ Created_On: "desc" }],
            take: 500,
        });
        const natIds = Array.from(new Set((rows ?? []).map((r) => r.Nationality).filter((x) => x != null)));
        const countries = natIds.length
            ? await db_1.prisma.tbl_Country.findMany({
                where: { ID: { in: natIds } },
                select: { ID: true, Country_Name: true },
            })
            : [];
        const countryById = new Map();
        for (const c of countries ?? []) {
            countryById.set(c.ID, c.Country_Name);
        }
        return res.json((rows ?? []).map((r) => ({
            Worker_Id: r.Worker_Id,
            Passport_Number: r.Passport_Number,
            Email_Id: r.Email_Id,
            Created_On: r.Created_On,
            Current_Location: null,
            Company_Name: null,
            Country_Name: r.Nationality != null ? countryById.get(r.Nationality) ?? null : null,
        })));
    }
    catch (e) {
        return next(e);
    }
});
app.post("/Api/Panic/Resolve", auth_1.requireAuth, requireAuthority, async (req, res, next) => {
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
// AddProblem -> POST /panic-like but authenticated and uses UserId from token
app.post("/Api/AddProblem", auth_1.requireAuth, async (req, res) => {
    const user = req.user;
    const title = (req.body.Title ?? req.body.title ?? "").toString();
    const description = (req.body.Description ?? req.body.description ?? "").toString();
    const latitude = (req.body.Latitude ?? req.body.latitude ?? req.body.lattitude ?? "").toString();
    const longitude = (req.body.Longitude ?? req.body.longitude ?? "").toString();
    try {
        const rows = (await db_1.prisma.$queryRawUnsafe("DECLARE @Result BIGINT; EXEC [dbo].[ProblemAndActivity_InsertOrUpdate] @ProblemAndActivityId = @p1, @Title = @p2, @Description = @p3, @latitude = @p4, @longitude = @p5, @MemberInfoId = @p6, @UserId = @p7, @Result = @Result OUTPUT; SELECT @Result as Result;", 0, title, description, latitude, longitude, 0, Number(user.userId)));
        const result = Array.isArray(rows) ? rows[0]?.Result : null;
        if (result && Number(result) > 0) {
            return res.status(200).json(Number(result));
        }
        return res.status(500).json({ error: "Unable to save data" });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Unable to save data" });
    }
});
app.get("/Api/ProblemList", auth_1.requireAuth, requireAuthority, async (req, res, next) => {
    try {
        const roleId = Number(req.user?.roleId ?? 0);
        const rawStatus = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
        const rawType = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
        const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
        const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
        const status = (rawStatus ?? "").toString().trim().toLowerCase();
        const type = (rawType ?? "").toString().trim().toLowerCase();
        const q = (rawQ ?? "").toString().trim();
        const limit = Math.min(1000, Math.max(1, Number(rawLimit ?? 200)));
        const wherePrisma = {};
        if (roleId !== 1) {
            const scopeWhere = await (0, queryGuard_1.buildWorkerScopeWhere)(req.user);
            const scopedWorkers = await db_1.prisma.tbl_Worker_PersonalInfo.findMany({
                where: scopeWhere,
                select: { Worker_Id: true },
                take: 5000,
            });
            const allowedWorkerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
            if (!allowedWorkerIds.length) {
                return res.json({ problemList: [] });
            }
            wherePrisma.worker_ID = { in: allowedWorkerIds };
        }
        if (status === "active") {
            wherePrisma.OR = [{ IsResolved: false }, { IsResolved: null }];
        }
        else if (status === "resolved") {
            wherePrisma.IsResolved = true;
        }
        if (type === "panic") {
            wherePrisma.Type = "Panic";
        }
        else if (type === "issue") {
            wherePrisma.NOT = { Type: "Panic" };
        }
        if (q) {
            wherePrisma.AND = [
                ...(wherePrisma.AND ?? []),
                {
                    OR: [
                        { Title: { contains: q } },
                        { Description: { contains: q } },
                        { worker_ID: { contains: q } },
                        { Prob_ID: { contains: q } },
                        { Company_Name: { contains: q } },
                    ],
                },
            ];
        }
        const rows = await db_1.prisma.tbl_ProbSol.findMany({
            where: wherePrisma,
            select: {
                ID: true,
                Title: true,
                Description: true,
                Prob_ID: true,
                Company_Name: true,
                Updated_On: true,
                Type: true,
                IsResolved: true,
                ProbStatus: true,
                Current_Location: true,
                Lat: true,
                Lng: true,
                worker_ID: true,
            },
            orderBy: [{ Updated_On: "desc" }, { ID: "desc" }],
            take: limit,
        });
        const gbDate = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
        const gbTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        return res.json({
            problemList: (rows ?? []).map((r) => {
                const dt = r.Updated_On ? new Date(r.Updated_On) : null;
                const date = dt && Number.isFinite(dt.getTime()) ? gbDate.format(dt) : null;
                const time = dt && Number.isFinite(dt.getTime()) ? gbTime.format(dt) : null;
                return {
                    ProblemAndActionId: r.ID,
                    Title: r.Title ?? null,
                    Description: r.Description ?? null,
                    PassportNumber: r.Prob_ID ?? null,
                    EmployerName: r.Company_Name ?? null,
                    CreatedOn: r.Updated_On ?? null,
                    Date: date,
                    Time: time,
                    Type: r.Type,
                    IsResolved: r.IsResolved ?? null,
                    Status: r.ProbStatus ?? null,
                    Current_Location: r.Current_Location ?? null,
                    Lat: r.Lat ?? null,
                    Lng: r.Lng ?? null,
                    worker_ID: r.worker_ID ?? null,
                };
            }),
        });
    }
    catch (e) {
        return next(e);
    }
});
app.post("/Api/Chat/Sessions", auth_1.requireAuth, async (req, res, next) => {
    const workerId = Number(req.body?.WorkerId ?? req.body?.workerId ?? 0);
    if (!Number.isFinite(workerId) || workerId <= 0) {
        return res.status(400).json({ error: "WorkerId is required" });
    }
    try {
        const rows = (await db_1.prisma.$queryRawUnsafe("INSERT INTO [dbo].[ChatSessions]([WorkerId]) OUTPUT INSERTED.[ChatSessionId] as ChatSessionId VALUES(@p1);", workerId));
        const id = Array.isArray(rows) ? rows[0]?.ChatSessionId : null;
        if (!id)
            return res.status(500).json({ error: "Unable to create chat session" });
        return res.json({ ChatSessionId: Number(id) });
    }
    catch (e) {
        const msg = (e?.message ?? "").toString();
        if (/invalid object name|chatsessions/i.test(msg)) {
            return res.status(501).json({ error: "Chat tables not installed" });
        }
        return next(e);
    }
});
app.post("/Api/Chat/Messages", auth_1.requireAuth, async (req, res, next) => {
    const chatSessionId = Number(req.body?.ChatSessionId ?? req.body?.chatSessionId ?? 0);
    const senderType = (req.body?.SenderType ?? req.body?.senderType ?? "User").toString();
    const message = (req.body?.Message ?? req.body?.message ?? "").toString();
    if (!Number.isFinite(chatSessionId) || chatSessionId <= 0) {
        return res.status(400).json({ error: "ChatSessionId is required" });
    }
    if (!message.trim()) {
        return res.status(400).json({ error: "Message is required" });
    }
    try {
        const rows = (await db_1.prisma.$queryRawUnsafe("INSERT INTO [dbo].[ChatMessages]([ChatSessionId],[SenderType],[Message]) OUTPUT INSERTED.[ChatMessageId] as ChatMessageId, INSERTED.[CreatedOn] as CreatedOn VALUES(@p1,@p2,@p3);", chatSessionId, senderType, message));
        const row = Array.isArray(rows) ? rows[0] : null;
        return res.json({ ChatMessageId: row?.ChatMessageId != null ? Number(row.ChatMessageId) : null, CreatedOn: row?.CreatedOn ?? null });
    }
    catch (e) {
        const msg = (e?.message ?? "").toString();
        if (/invalid object name|chatmessages/i.test(msg)) {
            return res.status(501).json({ error: "Chat tables not installed" });
        }
        return next(e);
    }
});
app.get("/Api/Chat/Messages", auth_1.requireAuth, async (req, res, next) => {
    const raw = Array.isArray(req.query.ChatSessionId) ? req.query.ChatSessionId[0] : req.query.ChatSessionId;
    const chatSessionId = raw != null ? Number(raw) : 0;
    if (!Number.isFinite(chatSessionId) || chatSessionId <= 0) {
        return res.status(400).json({ error: "ChatSessionId is required" });
    }
    try {
        const rows = (await db_1.prisma.$queryRawUnsafe("SELECT [ChatMessageId],[ChatSessionId],[SenderType],[Message],[CreatedOn] FROM [dbo].[ChatMessages] WHERE [ChatSessionId] = @p1 ORDER BY [CreatedOn] ASC;", chatSessionId));
        return res.json(rows ?? []);
    }
    catch (e) {
        const msg = (e?.message ?? "").toString();
        if (/invalid object name|chatmessages/i.test(msg)) {
            return res.status(501).json({ error: "Chat tables not installed" });
        }
        return next(e);
    }
});
app.post("/Api/Chat/SupportRequests", auth_1.requireAuth, async (req, res, next) => {
    const chatSessionId = Number(req.body?.ChatSessionId ?? req.body?.chatSessionId ?? 0);
    const workerId = Number(req.body?.WorkerId ?? req.body?.workerId ?? 0);
    const reason = (req.body?.Reason ?? req.body?.reason ?? "").toString();
    if (!Number.isFinite(chatSessionId) || chatSessionId <= 0) {
        return res.status(400).json({ error: "ChatSessionId is required" });
    }
    if (!Number.isFinite(workerId) || workerId <= 0) {
        return res.status(400).json({ error: "WorkerId is required" });
    }
    try {
        const rows = (await db_1.prisma.$queryRawUnsafe("INSERT INTO [dbo].[SupportRequests]([ChatSessionId],[WorkerId],[Reason]) OUTPUT INSERTED.[SupportRequestId] as SupportRequestId VALUES(@p1,@p2,@p3);", chatSessionId, workerId, reason));
        const id = Array.isArray(rows) ? rows[0]?.SupportRequestId : null;
        return res.json({ SupportRequestId: id != null ? Number(id) : null });
    }
    catch (e) {
        const msg = (e?.message ?? "").toString();
        if (/invalid object name|supportrequests/i.test(msg)) {
            return res.status(501).json({ error: "Chat tables not installed" });
        }
        return next(e);
    }
});
app.get("/Api/Chat/DbStatus", auth_1.requireAuth, async (_req, res, next) => {
    try {
        const sessions = (await db_1.prisma.$queryRawUnsafe("SELECT TOP (1) [ChatSessionId] FROM [dbo].[ChatSessions] ORDER BY [ChatSessionId] DESC;"));
        const messages = (await db_1.prisma.$queryRawUnsafe("SELECT TOP (1) [ChatMessageId] FROM [dbo].[ChatMessages] ORDER BY [ChatMessageId] DESC;"));
        return res.json({ ok: true, chatSessionsVisible: Array.isArray(sessions), chatMessagesVisible: Array.isArray(messages) });
    }
    catch (e) {
        const msg = (e?.message ?? "").toString();
        if (/invalid object name/i.test(msg)) {
            return res.status(200).json({ ok: false, error: "Chat tables not installed" });
        }
        return next(e);
    }
});
app.post("/Api/Chat/AIReply", auth_1.requireAuth, async (req, res, next) => {
    const chatSessionId = Number(req.body?.ChatSessionId ?? req.body?.chatSessionId ?? 0);
    const workerId = Number(req.body?.WorkerId ?? req.body?.workerId ?? 0);
    const userText = (req.body?.Message ?? req.body?.message ?? "").toString();
    if (!Number.isFinite(chatSessionId) || chatSessionId <= 0) {
        return res.status(400).json({ error: "ChatSessionId is required" });
    }
    if (!Number.isFinite(workerId) || workerId <= 0) {
        return res.status(400).json({ error: "WorkerId is required" });
    }
    if (!userText.trim()) {
        return res.status(400).json({ error: "Message is required" });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";
    try {
        await db_1.prisma.$queryRawUnsafe("INSERT INTO [dbo].[ChatMessages]([ChatSessionId],[SenderType],[Message]) VALUES(@p1,@p2,@p3);", chatSessionId, "User", userText);
        const systemPrompt = "You are a Supportive Safety Liaison for International Workers using the MWMSYS app. " +
            "You must only answer questions related to: personal safety, emergency steps, worker rights, workplace issues, immigration/permit general guidance, and how to use this app (panic button, reporting, evidence upload). " +
            "If the user asks for anything off-topic (coding, entertainment, politics, hacking, medical diagnosis, illegal activity, unrelated personal advice), politely refuse and redirect to safety/app topics. " +
            "Use Markdown for clarity with short sections and bullet points. Keep responses concise. " +
            "If the user indicates immediate danger, instruct them to trigger the Panic Button and contact local emergency services immediately.";
        const client = new openai_1.default({ apiKey });
        const completion = await client.chat.completions.create({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userText },
            ],
            temperature: 0.4,
            max_tokens: 350,
        });
        const aiText = completion.choices?.[0]?.message?.content?.toString?.() ?? "";
        await db_1.prisma.$queryRawUnsafe("INSERT INTO [dbo].[ChatMessages]([ChatSessionId],[SenderType],[Message]) VALUES(@p1,@p2,@p3);", chatSessionId, "AI", aiText);
        return res.json({ ok: true, reply: aiText });
    }
    catch (e) {
        const msg = (e?.message ?? "").toString();
        if (/invalid object name|chatmessages|chatsessions/i.test(msg)) {
            return res.status(501).json({ error: "Chat tables not installed" });
        }
        return next(e);
    }
});
app.use((err, _req, res, _next) => {
    const errStr = (err?.message ?? "").toString();
    if (/prisma|econnrefused|failed to connect|timeout|sql|database/i.test(errStr) || err?.code === "P1001" || err?.code === "P1002") {
        console.error("Database Connection Error", err);
        return res.status(503).json({ error: "Database Connection Error", code: "DB_CONNECTION_ERROR" });
    }
    const message = err?.message?.toString?.() ??
        err?.meta?.cause?.toString?.() ??
        err?.meta?.message?.toString?.() ??
        "Internal Server Error";
    const detail = err?.code != null ? `${message} (code=${String(err.code)})` : message;
    console.error("Unhandled error", err);
    return res.status(500).json({ error: detail });
});
const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
    console.log(`ModernBackend listening on http://localhost:${port}`);
});
