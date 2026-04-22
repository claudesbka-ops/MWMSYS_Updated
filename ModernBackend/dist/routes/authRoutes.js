"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const cryptoLegacy_1 = require("../cryptoLegacy");
const workerLookup_1 = require("../services/workerLookup");
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
