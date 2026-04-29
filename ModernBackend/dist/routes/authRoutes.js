"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const cryptoLegacy_1 = require("../cryptoLegacy");
const workerLookup_1 = require("../services/workerLookup");
const schemaMigrations_1 = require("../db/schemaMigrations");
const emailService_1 = require("../services/emailService");
const OTP_TTL_MINUTES = 15;
const RESEND_WINDOW_HOURS = 1;
const RESEND_MAX_PER_WINDOW = 3;
async function createAndSendOtp(params) {
    await (0, schemaMigrations_1.ensureOtpTableExists)();
    // Invalidate any outstanding OTPs of the same type for this user.
    await db_1.prisma.tbl_UserOtp.updateMany({
        where: { User_Id: params.userId, Otp_Type: params.otpType, Is_Used: false },
        data: { Is_Used: true },
    });
    const code = (0, emailService_1.generate6DigitOtp)();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);
    const created = await db_1.prisma.tbl_UserOtp.create({
        data: {
            User_Id: params.userId,
            Otp_Code: code,
            Otp_Type: params.otpType,
            Created_At: now,
            Expires_At: expiresAt,
            Is_Used: false,
        },
    });
    const sendResult = await (0, emailService_1.sendOtpEmail)(params.emailId, code, "email_verification");
    return { otpId: created.Id, expiresAt, fallback: sendResult.fallback };
}
// ---------- Role mapping helpers (auth-local) ----------
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
// ---------- Router ----------
exports.authRouter = (0, express_1.Router)();
exports.authRouter.get("/Api/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = user?.roleId != null ? Number(user.roleId) : null;
        const jwtUserId = user?.userId != null ? Number(user.userId) : 0;
        let workerId = null;
        let passportNo = null;
        if (roleId === 2) {
            workerId = (user?.userKey ?? "").toString().trim() || null;
            if (!workerId && Number.isFinite(jwtUserId) && jwtUserId > 0) {
                workerId = await (0, workerLookup_1.findWorkerIdByJwtUserId)(jwtUserId);
            }
            if (Number.isFinite(jwtUserId) && jwtUserId > 0) {
                passportNo = await (0, workerLookup_1.findWorkerPassportByJwtUserId)(jwtUserId);
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
exports.authRouter.post("/signup", async (req, res) => {
    const userId = (req.body.userId ?? req.body.userName ?? req.body.username ?? "").toString().trim();
    const emailId = (req.body.emailId ?? req.body.email ?? "").toString().trim();
    const password = (req.body.password ?? "").toString();
    const role = (req.body.role ?? "worker").toString().toLowerCase();
    const passportNo = (req.body.passportNo ?? req.body.PassportNo ?? "").toString().trim();
    const signupEmployerId = (req.body.employerId ?? req.body.Employer_Id ?? "").toString().trim();
    const workerName = (req.body.name ?? req.body.fullName ?? req.body.workerName ?? "").toString().trim();
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
    // Pre-create checks: anything before tbl_User.create() may legitimately
    // return 4xx/5xx because no row has been written yet.
    let created;
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
        created = await db_1.prisma.tbl_User.create({
            data: {
                User_Id: userId,
                Email_Id: emailId,
                Login_Pwd: loginPwd,
                User_Status: 1,
                User_Role: userRole,
                Created_On: new Date(),
                Is_Verified: false,
            },
        });
    }
    catch (e) {
        console.error("[signup] failed before user creation", e);
        return res.status(500).json({ error: "Signup failed" });
    }
    // From this point the user row exists in the DB. Any failure in role-
    // specific profile creation, OTP creation, or email sending must NOT
    // turn the response into an error — log it and still return 201 so the
    // client can drive the user to the verify-email page (or resend OTP).
    try {
        if (userRole === 2) {
            try {
                // Verify employer exists if one was selected.
                let resolvedEmployerId = null;
                if (signupEmployerId) {
                    const emp = await db_1.prisma.tbl_Employer.findFirst({
                        where: { User_Id: signupEmployerId },
                        select: { User_Id: true },
                    });
                    resolvedEmployerId = emp?.User_Id ?? null;
                }
                await db_1.prisma.tbl_Worker_PersonalInfo.create({
                    data: {
                        Worker_Id: userId,
                        Name: workerName || null,
                        Passport_Number: passportNo,
                        Email_Id: emailId,
                        Created_On: new Date(),
                        Employer_Id: resolvedEmployerId,
                    },
                });
                // Record the worker↔employer link so the worker shows up under that
                // employer across the system the moment registration completes.
                if (resolvedEmployerId) {
                    try {
                        await (0, schemaMigrations_1.ensureRelationshipTablesExist)();
                        await db_1.prisma.tbl_Worker_EmployerLink.create({
                            data: {
                                workerId: userId,
                                employerId: resolvedEmployerId,
                                status: "Active",
                                createdBy: userId,
                            },
                        });
                    }
                    catch {
                        // Non-fatal: denormalised Employer_Id on the worker record already
                        // makes the worker visible; the link table is an audit trail.
                    }
                }
            }
            catch (workerErr) {
                console.error("[signup] failed to create worker profile", workerErr);
            }
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
        // Kick off email OTP verification — user cannot log in until they verify.
        let otpInfo = null;
        try {
            const result = await createAndSendOtp({
                userId: created.User_Id,
                emailId: created.Email_Id,
                otpType: "email_verification",
            });
            otpInfo = { expiresAt: result.expiresAt, fallback: result.fallback };
        }
        catch (otpErr) {
            console.error("[signup] failed to send OTP", otpErr);
            // Do not fail signup just because email could not be sent — the user can
            // still request a resend from the verify page.
        }
        return res.status(201).json({
            message: "Account created",
            userId: created.User_Id,
            emailId: created.Email_Id,
            role: mapAppRole(created.User_Role),
            otpExpiresAt: otpInfo?.expiresAt ?? null,
            smtpFallback: otpInfo?.fallback ?? null,
        });
    }
    catch (postErr) {
        // The user row exists — never report failure to the client. Log and
        // return 201 so the client can route into verify-email and let the
        // user request a fresh OTP if needed.
        console.error("[signup] post-create error (ignored)", postErr);
        return res.status(201).json({
            message: "Account created",
            userId: created.User_Id,
            emailId: created.Email_Id,
            role: mapAppRole(created.User_Role),
            otpExpiresAt: null,
            smtpFallback: null,
        });
    }
});
// Alias: /Api/Auth/Register matches the Batch C spec.
exports.authRouter.post("/Api/Auth/Register", async (req, res, next) => {
    req.url = "/signup";
    return req.app._router.handle(req, res, next);
});
exports.authRouter.post("/auth/login", async (req, res) => {
    const userName = (req.body.userName ?? req.body.username ?? "").toString().trim();
    const password = (req.body.password ?? "").toString();
    if (!userName || !password) {
        return res.status(400).json({ error: "userName and password are required" });
    }
    // Reuse the same logic as /Api/token by calling it internally.
    // Keep behavior aligned for now.
    req.body = { username: userName, password };
    return req.app._router.handle({ ...req, url: "/Api/token", originalUrl: "/Api/token", method: "POST" }, res);
});
// OAuth-like token endpoint to match existing frontend call
// Accepts application/x-www-form-urlencoded with username/password
exports.authRouter.post("/Api/token", async (req, res) => {
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
        // Email verification gate — added in Batch C.
        if (user.Is_Verified === false) {
            return res.status(403).json({
                error: "Email not verified",
                userId: user.User_Id,
                emailId: user.Email_Id,
            });
        }
        const stored = (user.Login_Pwd ?? "").toString();
        const plainOk = stored === password;
        const salt = (user.User_Id ?? "").toString();
        const legacyOk = stored === (0, cryptoLegacy_1.encryptLegacyPassword)(password, salt);
        if (!plainOk && !legacyOk) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const loginPayload = await issueLoginTokenForUser(user, userName);
        return res.json(loginPayload);
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Login failed" });
    }
});
// ---------- Shared token issuance ----------
async function lookupEmbassyCountryCode(userIdStr) {
    const candidates = [
        { sql: `SELECT "Nationality" as value FROM "Tbl_Embassy" WHERE "User_Id" = $1 LIMIT 1`, param: userIdStr, key: "value" },
        { sql: `SELECT "Country_Code" as value FROM "Tbl_Embassy" WHERE "User_Id" = $1 LIMIT 1`, param: userIdStr, key: "value" },
        { sql: `SELECT "CountryCode" as value FROM "Tbl_Embassy" WHERE "User_Id" = $1 LIMIT 1`, param: userIdStr, key: "value" },
        { sql: `SELECT "Nationality" as value FROM "Tbl_User" WHERE "User_Id" = $1 LIMIT 1`, param: userIdStr, key: "value" },
        { sql: `SELECT "Country_Code" as value FROM "Tbl_User" WHERE "User_Id" = $1 LIMIT 1`, param: userIdStr, key: "value" },
        { sql: `SELECT "CountryCode" as value FROM "Tbl_User" WHERE "User_Id" = $1 LIMIT 1`, param: userIdStr, key: "value" },
    ];
    for (const c of candidates) {
        try {
            const rows = (await db_1.prisma.$queryRawUnsafe(c.sql, c.param));
            const row = Array.isArray(rows) ? rows[0] : null;
            const raw = row?.[c.key];
            const n = raw != null ? Number(raw) : NaN;
            if (Number.isFinite(n) && n > 0)
                return n;
        }
        catch {
            // ignore and try next
        }
    }
    return undefined;
}
async function issueLoginTokenForUser(user, fallbackUserName) {
    const userRoleId = user.User_Role != null ? Number(user.User_Role) : null;
    let countryCode = undefined;
    if (userRoleId === 6) {
        countryCode = await lookupEmbassyCountryCode((user.User_Id ?? "").toString().trim());
    }
    const claims = {
        userId: Number(user.ID),
        userKey: user.User_Id?.toString() ?? undefined,
        roleId: userRoleId != null ? userRoleId : undefined,
        appRole: mapAppRole(user.User_Role),
        countryCode,
        emailId: user.Email_Id?.toString(),
        userName: user.User_Name?.toString() ?? user.User_Id?.toString() ?? fallbackUserName,
    };
    const access_token = (0, auth_1.signToken)(claims);
    return {
        access_token,
        token_type: "bearer",
        expires_in: 86400,
        userName: claims.userName,
    };
}
// ---------- Email verification ----------
exports.authRouter.post("/Api/Auth/VerifyEmail", async (req, res) => {
    const userId = (req.body?.userId ?? "").toString().trim();
    const otp = (req.body?.otp ?? "").toString().trim();
    if (!userId || !otp) {
        return res.status(400).json({ error: "userId and otp are required" });
    }
    try {
        await (0, schemaMigrations_1.ensureOtpTableExists)();
        const now = new Date();
        const record = await db_1.prisma.tbl_UserOtp.findFirst({
            where: {
                User_Id: userId,
                Otp_Type: "email_verification",
                Otp_Code: otp,
                Is_Used: false,
                Expires_At: { gte: now },
            },
            orderBy: [{ Id: "desc" }],
        });
        if (!record) {
            return res.status(400).json({ error: "Invalid or expired code" });
        }
        const user = await db_1.prisma.tbl_User.findFirst({ where: { User_Id: userId } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        await db_1.prisma.tbl_UserOtp.update({
            where: { Id: record.Id },
            data: { Is_Used: true },
        });
        await db_1.prisma.tbl_User.updateMany({
            where: { User_Id: userId },
            data: { Is_Verified: true },
        });
        const loginPayload = await issueLoginTokenForUser(user, userId);
        return res.json(loginPayload);
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Verification failed" });
    }
});
// Alias: /Api/Auth/Login — thin wrapper that forwards to /Api/token.
exports.authRouter.post("/Api/Auth/Login", async (req, res, next) => {
    req.url = "/Api/token";
    return req.app._router.handle(req, res, next);
});
// ---------- Resend OTP ----------
exports.authRouter.post("/Api/Auth/ResendOtp", async (req, res) => {
    const userId = (req.body?.userId ?? "").toString().trim();
    if (!userId)
        return res.status(400).json({ error: "userId is required" });
    try {
        await (0, schemaMigrations_1.ensureOtpTableExists)();
        const user = await db_1.prisma.tbl_User.findFirst({
            where: { User_Id: userId },
            select: { User_Id: true, Email_Id: true, Is_Verified: true },
        });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        if (user.Is_Verified === true) {
            return res.status(400).json({ error: "Email already verified" });
        }
        // Rate limit: at most RESEND_MAX_PER_WINDOW sends per user per RESEND_WINDOW_HOURS.
        const windowStart = new Date(Date.now() - RESEND_WINDOW_HOURS * 60 * 60 * 1000);
        const recentCount = await db_1.prisma.tbl_UserOtp.count({
            where: {
                User_Id: userId,
                Otp_Type: "email_verification",
                Created_At: { gte: windowStart },
            },
        });
        if (recentCount >= RESEND_MAX_PER_WINDOW) {
            return res.status(429).json({
                error: `Too many resend attempts. Try again in ${RESEND_WINDOW_HOURS} hour(s).`,
            });
        }
        const result = await createAndSendOtp({
            userId: user.User_Id,
            emailId: user.Email_Id,
            otpType: "email_verification",
        });
        return res.json({
            ok: true,
            userId: user.User_Id,
            otpExpiresAt: result.expiresAt,
            smtpFallback: result.fallback,
            remainingSends: Math.max(0, RESEND_MAX_PER_WINDOW - recentCount - 1),
        });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Resend failed" });
    }
});
