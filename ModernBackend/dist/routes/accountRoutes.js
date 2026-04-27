"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
const upload_1 = require("../middleware/upload");
exports.accountRouter = (0, express_1.Router)();
/**
 * Load the role-specific profile row so the Account page can populate its
 * editable fields. Returns `null` when the role has no dedicated table.
 */
/**
 * Returns true when every string in `values` is a non-empty trimmed string.
 * Used to compute whether a role-specific profile has enough data filled in
 * to pass the Complete-Profile gate.
 */
function allFilled(values) {
    return values.every((v) => typeof v === "string" && v.trim().length > 0);
}
async function loadRoleProfile(userKey, roleId) {
    if (!userKey || roleId == null)
        return null;
    if (roleId === 2) {
        const row = await db_1.prisma.tbl_Worker_PersonalInfo.findFirst({
            where: { Worker_Id: userKey },
        });
        if (!row)
            return null;
        const fields = {
            name: row.Name ?? "",
            contactNumber: row.Contact_Number ?? "",
            address: row.Address ?? "",
            passportNumber: row.Passport_Number ?? "",
            email: row.Email_Id ?? "",
            photo: row.Photo ?? null,
        };
        return {
            kind: "worker",
            fields,
            complete: allFilled([fields.name, fields.contactNumber, fields.address, fields.passportNumber]),
        };
    }
    if (roleId === 3) {
        const row = await db_1.prisma.tbl_Employer.findFirst({
            where: { User_Id: userKey },
        });
        if (!row)
            return null;
        const fields = {
            companyName: row.Employer_Name ?? "",
            address: row.Employer_Address ?? "",
            companyPhone: row.Employer_CompanyPhone ?? "",
            contactPerson: row.Employer_ContactPerson ?? "",
            contactPersonPhone: row.Employer_ContactPerson_Phone ?? "",
            position: row.Employer_Position ?? "",
            email: row.Employer_EmailID ?? "",
            ssmNumber: row.Employer_SSM_Number ?? "",
        };
        return {
            kind: "employer",
            fields,
            complete: allFilled([
                fields.companyName,
                fields.address,
                fields.contactPerson,
                fields.contactPersonPhone,
            ]),
        };
    }
    if (roleId === 4) {
        const row = await db_1.prisma.tbl_Agent.findFirst({
            where: { User_Id: userKey },
        });
        if (!row)
            return null;
        const fields = {
            agentName: row.Agent_Name ?? "",
            organizationName: row.Agent_Organization_Name ?? "",
            contactNumber: row.Agent_ContactNumber ?? "",
            icPassport: row.Agent_IC_Passport ?? "",
            email: row.Agent_EmailID ?? "",
        };
        return {
            kind: "agency",
            fields,
            complete: allFilled([
                fields.agentName,
                fields.organizationName,
                fields.contactNumber,
                fields.icPassport,
            ]),
        };
    }
    return null;
}
/**
 * GET /Api/Account/Profile
 *
 * Returns a lightweight profile snapshot for the authenticated user along
 * with their current subscription plan (for the subscription badge on the
 * Account page). Batch D adds the subscription field; Batch E will extend
 * the response with editable profile fields.
 */
exports.accountRouter.get("/Api/Account/Profile", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const userKey = (user?.userKey ?? "").toString().trim();
        const roleId = user?.roleId != null ? Number(user.roleId) : null;
        let planType = "Free";
        let planStatus = "Active";
        let planEndDate = null;
        if (userKey && (roleId === 3 || roleId === 4)) {
            await (0, subscription_1.ensureSubscriptionTableExists)();
            const now = new Date();
            const active = await db_1.prisma.tbl_Subscription.findFirst({
                where: {
                    entityId: userKey,
                    status: "Active",
                    endDate: { gte: now },
                },
                orderBy: [{ endDate: "desc" }, { id: "desc" }],
            });
            if (active) {
                planType = active.planType;
                planStatus = active.status;
                planEndDate = active.endDate;
            }
        }
        const profile = await loadRoleProfile(userKey, roleId);
        return res.json({
            userId: userKey || null,
            userName: user?.userName ?? null,
            emailId: user?.emailId ?? null,
            role: user?.appRole ?? null,
            roleId,
            subscription: {
                planType,
                status: planStatus,
                endDate: planEndDate,
            },
            profile,
        });
    }
    catch (e) {
        return next(e);
    }
});
/**
 * PUT /Api/Account/Profile
 *
 * Update the role-specific profile row. Only fields defined for the caller's
 * role are accepted; anything else is silently ignored.
 */
exports.accountRouter.put("/Api/Account/Profile", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const userKey = (user?.userKey ?? "").toString().trim();
        const roleId = user?.roleId != null ? Number(user.roleId) : null;
        const body = (req.body ?? {});
        if (!userKey || roleId == null) {
            return res.status(400).json({ error: "Missing user context" });
        }
        const str = (key) => {
            const raw = body[key];
            if (raw == null)
                return null;
            const s = raw.toString().trim();
            return s.length > 0 ? s : "";
        };
        if (roleId === 2) {
            const data = {};
            const name = str("name");
            const contactNumber = str("contactNumber");
            const address = str("address");
            if (name !== null)
                data.Name = name;
            if (contactNumber !== null)
                data.Contact_Number = contactNumber;
            if (address !== null)
                data.Address = address;
            if (Object.keys(data).length === 0) {
                return res.status(400).json({ error: "No updatable fields provided" });
            }
            await db_1.prisma.tbl_Worker_PersonalInfo.update({
                where: { Worker_Id: userKey },
                data,
            });
        }
        else if (roleId === 3) {
            const data = {};
            const companyName = str("companyName");
            const address = str("address");
            const companyPhone = str("companyPhone");
            const contactPerson = str("contactPerson");
            const contactPersonPhone = str("contactPersonPhone");
            const position = str("position");
            if (companyName !== null)
                data.Employer_Name = companyName;
            if (address !== null)
                data.Employer_Address = address;
            if (companyPhone !== null)
                data.Employer_CompanyPhone = companyPhone;
            if (contactPerson !== null)
                data.Employer_ContactPerson = contactPerson;
            if (contactPersonPhone !== null)
                data.Employer_ContactPerson_Phone = contactPersonPhone;
            if (position !== null)
                data.Employer_Position = position;
            if (Object.keys(data).length === 0) {
                return res.status(400).json({ error: "No updatable fields provided" });
            }
            // Employer PK is composite (User_Id + Employer_EmailID); use updateMany to match by User_Id.
            const result = await db_1.prisma.tbl_Employer.updateMany({
                where: { User_Id: userKey },
                data,
            });
            if (result.count === 0) {
                return res.status(404).json({ error: "Employer profile not found" });
            }
        }
        else if (roleId === 4) {
            const data = {};
            const agentName = str("agentName");
            const organizationName = str("organizationName");
            const contactNumber = str("contactNumber");
            const icPassport = str("icPassport");
            if (agentName !== null)
                data.Agent_Name = agentName;
            if (organizationName !== null)
                data.Agent_Organization_Name = organizationName;
            if (contactNumber !== null)
                data.Agent_ContactNumber = contactNumber;
            if (icPassport !== null)
                data.Agent_IC_Passport = icPassport;
            if (Object.keys(data).length === 0) {
                return res.status(400).json({ error: "No updatable fields provided" });
            }
            const result = await db_1.prisma.tbl_Agent.updateMany({
                where: { User_Id: userKey },
                data,
            });
            if (result.count === 0) {
                return res.status(404).json({ error: "Agent profile not found" });
            }
        }
        else {
            return res.status(403).json({ error: "Profile editing is not available for this role" });
        }
        const profile = await loadRoleProfile(userKey, roleId);
        return res.json({ ok: true, profile });
    }
    catch (e) {
        return next(e);
    }
});
/**
 * POST /Api/Account/Photo
 *
 * Upload a profile photo. For workers the image is stored as base64 inside
 * `Tbl_Worker_PersonalInfo.Photo` (which is how the legacy mobile app reads
 * it). Other roles are rejected until a dedicated photo column is added.
 */
exports.accountRouter.post("/Api/Account/Photo", auth_1.requireAuth, upload_1.upload.single("photo"), async (req, res, next) => {
    try {
        const user = req.user;
        const userKey = (user?.userKey ?? "").toString().trim();
        const roleId = user?.roleId != null ? Number(user.roleId) : null;
        if (!userKey)
            return res.status(400).json({ error: "Missing user context" });
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: "photo file is required" });
        if (roleId !== 2) {
            return res
                .status(403)
                .json({ error: "Photo uploads are currently supported for worker accounts only" });
        }
        const fs = await import("fs");
        const buf = fs.readFileSync(file.path);
        const base64 = buf.toString("base64");
        const dataUrl = `data:${file.mimetype || "image/jpeg"};base64,${base64}`;
        await db_1.prisma.tbl_Worker_PersonalInfo.update({
            where: { Worker_Id: userKey },
            data: {
                Photo: dataUrl,
                PhotoName: file.originalname.slice(0, 50),
            },
        });
        // Clean up the temporary file — base64 is now in the DB.
        try {
            fs.unlinkSync(file.path);
        }
        catch {
            // ignore
        }
        return res.json({ ok: true, photo: dataUrl });
    }
    catch (e) {
        return next(e);
    }
});
