import { Router } from "express";

import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { ensureSubscriptionTableExists } from "../middleware/subscription";
import { upload } from "../middleware/upload";

export const accountRouter = Router();

/**
 * Load the role-specific profile row so the Account page can populate its
 * editable fields. Returns `null` when the role has no dedicated table.
 */
/**
 * Returns true when every string in `values` is a non-empty trimmed string.
 * Used to compute whether a role-specific profile has enough data filled in
 * to pass the Complete-Profile gate.
 */
function allFilled(values: (string | null | undefined)[]): boolean {
  return values.every((v) => typeof v === "string" && v.trim().length > 0);
}

async function loadRoleProfile(userKey: string, roleId: number | null) {
  if (!userKey || roleId == null) return null;

  if (roleId === 2) {
    const row = await prisma.tbl_Worker_PersonalInfo.findFirst({
      where: { Worker_Id: userKey },
    });
    if (!row) return null;
    const fields = {
      name: row.Name ?? "",
      contactNumber: row.Contact_Number ?? "",
      address: row.Address ?? "",
      passportNumber: row.Passport_Number ?? "",
      email: row.Email_Id ?? "",
      photo: row.Photo ?? null,
    };
    return {
      kind: "worker" as const,
      fields,
      complete: allFilled([fields.name, fields.contactNumber, fields.address, fields.passportNumber]),
    };
  }

  if (roleId === 3) {
    const row = await prisma.tbl_Employer.findFirst({
      where: { User_Id: userKey },
    });
    if (!row) return null;
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
      kind: "employer" as const,
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
    const row = await prisma.tbl_Agent.findFirst({
      where: { User_Id: userKey },
    });
    if (!row) return null;
    const fields = {
      agentName: row.Agent_Name ?? "",
      organizationName: row.Agent_Organization_Name ?? "",
      contactNumber: row.Agent_ContactNumber ?? "",
      icPassport: row.Agent_IC_Passport ?? "",
      email: row.Agent_EmailID ?? "",
    };
    return {
      kind: "agency" as const,
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
accountRouter.get("/Api/Account/Profile", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as {
      userKey?: string;
      roleId?: number;
      appRole?: string;
      emailId?: string;
      userName?: string;
    };

    const userKey = (user?.userKey ?? "").toString().trim();
    const roleId = user?.roleId != null ? Number(user.roleId) : null;

    let planType: string = "Free";
    let planStatus: string = "Active";
    let planEndDate: Date | null = null;

    if (userKey && (roleId === 3 || roleId === 4)) {
      await ensureSubscriptionTableExists();
      const now = new Date();
      const active = await prisma.tbl_Subscription.findFirst({
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
  } catch (e) {
    return next(e);
  }
});

/**
 * PUT /Api/Account/Profile
 *
 * Update the role-specific profile row. Only fields defined for the caller's
 * role are accepted; anything else is silently ignored.
 */
accountRouter.put("/Api/Account/Profile", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { userKey?: string; roleId?: number };
    const userKey = (user?.userKey ?? "").toString().trim();
    const roleId = user?.roleId != null ? Number(user.roleId) : null;
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (!userKey || roleId == null) {
      return res.status(400).json({ error: "Missing user context" });
    }

    const str = (key: string): string | null => {
      const raw = body[key];
      if (raw == null) return null;
      const s = raw.toString().trim();
      return s.length > 0 ? s : "";
    };

    if (roleId === 2) {
      const data: Record<string, string> = {};
      const name = str("name");
      const contactNumber = str("contactNumber");
      const address = str("address");
      if (name !== null) data.Name = name;
      if (contactNumber !== null) data.Contact_Number = contactNumber;
      if (address !== null) data.Address = address;

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided" });
      }

      await prisma.tbl_Worker_PersonalInfo.update({
        where: { Worker_Id: userKey },
        data,
      });
    } else if (roleId === 3) {
      const data: Record<string, string> = {};
      const companyName = str("companyName");
      const address = str("address");
      const companyPhone = str("companyPhone");
      const contactPerson = str("contactPerson");
      const contactPersonPhone = str("contactPersonPhone");
      const position = str("position");
      if (companyName !== null) data.Employer_Name = companyName;
      if (address !== null) data.Employer_Address = address;
      if (companyPhone !== null) data.Employer_CompanyPhone = companyPhone;
      if (contactPerson !== null) data.Employer_ContactPerson = contactPerson;
      if (contactPersonPhone !== null) data.Employer_ContactPerson_Phone = contactPersonPhone;
      if (position !== null) data.Employer_Position = position;

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided" });
      }

      // Employer PK is composite (User_Id + Employer_EmailID); use updateMany to match by User_Id.
      const result = await prisma.tbl_Employer.updateMany({
        where: { User_Id: userKey },
        data,
      });
      if (result.count === 0) {
        return res.status(404).json({ error: "Employer profile not found" });
      }
    } else if (roleId === 4) {
      const data: Record<string, string> = {};
      const agentName = str("agentName");
      const organizationName = str("organizationName");
      const contactNumber = str("contactNumber");
      const icPassport = str("icPassport");
      if (agentName !== null) data.Agent_Name = agentName;
      if (organizationName !== null) data.Agent_Organization_Name = organizationName;
      if (contactNumber !== null) data.Agent_ContactNumber = contactNumber;
      if (icPassport !== null) data.Agent_IC_Passport = icPassport;

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided" });
      }

      const result = await prisma.tbl_Agent.updateMany({
        where: { User_Id: userKey },
        data,
      });
      if (result.count === 0) {
        return res.status(404).json({ error: "Agent profile not found" });
      }
    } else {
      return res.status(403).json({ error: "Profile editing is not available for this role" });
    }

    const profile = await loadRoleProfile(userKey, roleId);
    return res.json({ ok: true, profile });
  } catch (e) {
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
async function handleAccountPhotoUpload(req: any, res: any, next: any) {
  try {
    const user = req.user as { userKey?: string; userId?: number; roleId?: number };
    const userKey = (user?.userKey ?? "").toString().trim();
    const roleId = user?.roleId != null ? Number(user.roleId) : null;
    const userJwtId = user?.userId != null ? Number(user.userId) : null;

    if (!userKey) return res.status(400).json({ error: "Missing user context" });

    const file = req.file as
      | { filename: string; path: string; originalname: string; mimetype: string; size: number }
      | undefined;
    if (!file) return res.status(400).json({ error: "photo file is required" });

    const photoUrl = `/uploads/${file.filename}`;

    // Mirror the photo path on Tbl_User.Profile_Photo so any role can have a
    // profile picture and so the column is populated for non-worker users
    // too (employer/agency/embassy/labour). Best-effort — column may not
    // exist on legacy DBs until migrations run.
    if (userJwtId && Number.isFinite(userJwtId)) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "Tbl_User" SET "Profile_Photo" = $1 WHERE "ID" = $2`,
          photoUrl,
          userJwtId,
        );
      } catch {
        // ignore — Profile_Photo column may not exist yet
      }
    }

    // Workers also keep a base64 copy in Tbl_Worker_PersonalInfo.Photo for
    // backward compatibility with the legacy mobile app, which reads from
    // that column directly.
    if (roleId === 2) {
      const fs = await import("fs");
      try {
        const buf = fs.readFileSync(file.path);
        const base64 = buf.toString("base64");
        const dataUrl = `data:${file.mimetype || "image/jpeg"};base64,${base64}`;
        await prisma.tbl_Worker_PersonalInfo.update({
          where: { Worker_Id: userKey },
          data: {
            Photo: dataUrl,
            PhotoName: file.originalname.slice(0, 50),
          },
        });
        return res.json({ ok: true, photo: dataUrl, photoUrl });
      } catch (e) {
        // Fall through to URL-only response if the worker row update fails.
        console.error("[Account/Photo] worker photo persist failed", e);
      }
    }

    return res.json({ ok: true, photo: photoUrl, photoUrl });
  } catch (e) {
    return next(e);
  }
}

accountRouter.post("/Api/Account/Photo", requireAuth, upload.single("photo"), handleAccountPhotoUpload);
// Alias used by the worker signup wizard and any new client code that
// expects the more specific name. Both endpoints share the same handler.
accountRouter.post("/Api/Account/UploadPhoto", requireAuth, upload.single("photo"), handleAccountPhotoUpload);
