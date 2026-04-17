import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import multer from "multer";
import OpenAI from "openai";

import { prisma } from "./db";
import { encryptLegacyPassword } from "./cryptoLegacy";
import { checkRole, requireAuth, signToken } from "./auth";

async function ensureAttestationTableExists(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_Attestation', 'U') IS NULL BEGIN " +
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
        "END"
    );
  } catch {
    // ignore
  }
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:8081",
  },
});

io.on("connection", (socket) => {
  try {
    const token =
      (socket.handshake.auth as any)?.token ??
      (socket.handshake.query as any)?.token ??
      (socket.handshake.headers?.authorization || socket.handshake.headers?.Authorization);

    const raw = typeof token === "string" ? token : "";
    const bearer = raw.toLowerCase().startsWith("bearer ") ? raw.slice("bearer ".length).trim() : raw;
    const secret = process.env.JWT_SECRET;
    if (!secret || !bearer) return;

    const decoded = jwt.verify(bearer, secret) as any;
    const roleId = decoded?.roleId != null ? Number(decoded.roleId) : null;

    const isAuthority = roleId === 1 || roleId === 4 || roleId === 5 || roleId === 6 || roleId === 7;
    if (isAuthority) {
      socket.join("authorities");
      console.log("ALERTS: User joined authority room");
    }
  } catch {
    // ignore invalid tokens
  }
});

app.get("/Api/Employer/IncidentCounts", requireAuth, checkRole([1, 4, 5, 6, 7]), async (_req, res, next) => {
  try {
    const groups = await prisma.tbl_ProbSol.groupBy({
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

    groups.sort((a: any, b: any) => Number(b?._count?._all ?? 0) - Number(a?._count?._all ?? 0));

    const map: Record<string, number> = {};
    for (const g of groups ?? []) {
      const k = g?.Company_Name != null ? String(g.Company_Name) : "";
      const v = (g as any)?._count?._all != null ? Number((g as any)._count._all) : 0;
      if (k) map[k] = Number.isFinite(v) ? v : 0;
    }

    return res.json(map);
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Employer/Incidents", requireAuth, checkRole([1, 4, 5, 6, 7]), async (req, res, next) => {
  const raw = Array.isArray(req.query.companyName) ? req.query.companyName[0] : req.query.companyName;
  const companyName = (raw ?? "").toString().trim();
  if (!companyName) return res.json([]);

  try {
    const rows = await prisma.tbl_ProbSol.findMany({
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
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Attestation/List", requireAuth, checkRole([1, 4, 5, 6, 7]), async (_req, res, next) => {
  try {
    await ensureAttestationTableExists();
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT TOP (500) AttestationId, Worker_Id, Passport_Number, DocumentType, DocumentPath, Status, AdminRemarks, Created_On, Updated_On FROM Tbl_Attestation ORDER BY AttestationId DESC",
    )) as any[];
    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Attestation/Approve", requireAuth, checkRole([1, 4, 5, 6, 7]), async (req, res, next) => {
  const id = Number(req.body?.id ?? 0);
  const remarks = (req.body?.remarks ?? "").toString();
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id is required" });

  try {
    await ensureAttestationTableExists();
    await prisma.$executeRawUnsafe(
      "UPDATE Tbl_Attestation SET Status = 'Approved', AdminRemarks = @p1, Updated_On = GETDATE() WHERE AttestationId = @p2",
      remarks,
      id,
    );
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Attestation/Reject", requireAuth, checkRole([1, 4, 5, 6, 7]), async (req, res, next) => {
  const id = Number(req.body?.id ?? 0);
  const remarks = (req.body?.remarks ?? "").toString();
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id is required" });

  try {
    await ensureAttestationTableExists();
    await prisma.$executeRawUnsafe(
      "UPDATE Tbl_Attestation SET Status = 'Rejected', AdminRemarks = @p1, Updated_On = GETDATE() WHERE AttestationId = @p2",
      remarks,
      id,
    );
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

function safeUnlinkUpload(uploadPath: string | null | undefined) {
  try {
    const p = (uploadPath ?? "").toString();
    if (!p.startsWith("/uploads/")) return;
    const filename = path.basename(p);
    if (!filename) return;
    const full = path.join(uploadsDir, filename);
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
    }
  } catch {
    // ignore
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req: express.Request, _file: any, cb: (error: Error | null, destination: string) => void) => cb(null, uploadsDir),
    filename: (_req: express.Request, file: any, cb: (error: Error | null, filename: string) => void) => {
      const safeOriginal = (file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = path.extname(safeOriginal);
      const base = path.basename(safeOriginal, ext);
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

function mapAppRole(
  userRole: number | null | undefined
): "admin" | "worker" | "employer" | "agency" | "embassy_source" | "embassy_destination" | "labour" {
  const r = userRole == null ? null : Number(userRole);
  if (r === 1) return "admin";
  if (r === 2) return "worker";
  if (r === 3) return "employer";
  if (r === 4) return "agency";
  if (r === 5) return "embassy_source";
  if (r === 6) return "embassy_destination";
  if (r === 7) return "labour";
  return "worker";
}

function roleNameToRoleId(role: string): number {
  const r = (role ?? "").toString().toLowerCase();
  if (r === "admin") return 1;
  if (r === "worker") return 2;
  if (r === "employer") return 3;
  if (r === "agency" || r === "agent") return 4;
  if (r === "embassy_source") return 5;
  if (r === "embassy_destination") return 6;
  if (r === "labour" || r === "labor") return 7;
  return 2;
}

app.post("/signup", async (req, res) => {
  const userId = (req.body.userId ?? req.body.userName ?? req.body.username ?? "").toString().trim();
  const emailId = (req.body.emailId ?? req.body.email ?? "").toString().trim();
  const password = (req.body.password ?? "").toString();
  const role = (req.body.role ?? "worker").toString().toLowerCase();
  const passportNo = (req.body.passportNo ?? req.body.PassportNo ?? "").toString().trim();

  if (!userId || !emailId || !password) {
    return res.status(400).json({ error: "userId, emailId and password are required" });
  }

  const userRole = roleNameToRoleId(role);

  if (userRole === 2 && !passportNo) {
    return res.status(400).json({ error: "passportNo is required for worker signup" });
  }

  try {
    const existing = await prisma.tbl_User.findFirst({
      where: {
        OR: [{ User_Id: userId }, { Email_Id: emailId }],
      },
    });

    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const loginPwd = encryptLegacyPassword(password, userId);

    const created = await prisma.tbl_User.create({
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
      await prisma.tbl_Worker_PersonalInfo.create({
        data: {
          Worker_Id: userId,
          Passport_Number: passportNo,
          Email_Id: emailId,
          Created_On: new Date(),
        },
      });
    }

    return res.status(201).json({
      id: created.ID,
      userId: created.User_Id,
      emailId: created.Email_Id,
      role: mapAppRole(created.User_Role),
    });
  } catch (e) {
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
  return (app as any)._router.handle({ ...req, url: "/Api/token", originalUrl: "/Api/token", method: "POST" }, res);
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
    const user = await prisma.tbl_User.findFirst({
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
      const worker = await prisma.tbl_Worker_PersonalInfo.findFirst({
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
    const legacyOk = stored === encryptLegacyPassword(password, salt);

    if (!plainOk && !legacyOk) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const claims = {
      userId: Number(user.ID),
      roleId: userRoleId != null ? userRoleId : undefined,
      appRole: mapAppRole(user.User_Role),
      emailId: user.Email_Id?.toString(),
      userName: user.User_Name?.toString() ?? user.User_Id?.toString() ?? userName,
    };

    const access_token = signToken(claims);

    return res.json({
      access_token,
      token_type: "bearer",
      expires_in: 86400,
      userName: claims.userName,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Login failed" });
  }
});

async function findMemberInfoIdByPassport(passportNo: string): Promise<number | null> {
  const candidates = [
    "SELECT TOP 1 MemberInfoId FROM MemberInfo WHERE PassportNo = @p1",
    "SELECT TOP 1 MemberInfoId FROM MemberInfo WHERE PassportNumber = @p1",
    "SELECT TOP 1 MemberInfoId FROM MemberInfo WHERE Passport = @p1",
  ];

  for (const sql of candidates) {
    try {
      const rows = (await prisma.$queryRawUnsafe(sql, passportNo)) as any[];
      const row = Array.isArray(rows) ? rows[0] : null;
      const value = row?.MemberInfoId;
      if (value != null) return Number(value);
    } catch {
      // ignore and try next
    }
  }

  return null;
}

async function findWorkerMetadataByPassport(passportNo: string): Promise<
  | { workerId: string; currentLocation: string | null; companyName: string | null; passportPhoto: string | null }
  | null
> {
  if (!passportNo) return null;

  try {
    const row = await prisma.tbl_Worker_PersonalInfo.findFirst({
      where: {
        Passport_Number: passportNo,
      },
      select: {
        Worker_Id: true,
        Photo: true,
      },
    });

    if (!row?.Worker_Id) return null;

    return {
      workerId: String(row.Worker_Id),
      currentLocation: null,
      companyName: null,
      passportPhoto: row.Photo != null ? String(row.Photo) : null,
    };
  } catch {
    return null;
  }
}

async function findWorkerPassportByJwtUserId(jwtUserId: number): Promise<string | null> {
  if (!Number.isFinite(jwtUserId) || jwtUserId <= 0) return null;

  const user = await prisma.tbl_User.findFirst({
    where: { ID: jwtUserId },
  });

  const workerId = user?.User_Id?.toString();
  if (!workerId) return null;

  const worker = await prisma.tbl_Worker_PersonalInfo.findFirst({
    where: { Worker_Id: workerId },
  });

  const passport = worker?.Passport_Number?.toString()?.trim();
  return passport ? passport : null;
}

async function findWorkerIdByJwtUserId(jwtUserId: number): Promise<string | null> {
  if (!Number.isFinite(jwtUserId) || jwtUserId <= 0) return null;

  const user = await prisma.tbl_User.findFirst({
    where: { ID: jwtUserId },
  });

  const workerId = user?.User_Id?.toString()?.trim();
  return workerId ? workerId : null;
}

async function handlePanic(req: express.Request, res: express.Response) {
  let passportNo = (req.body.PassportNo ?? req.body.passportNo ?? "").toString().trim();
  const title = (req.body.Title ?? req.body.title ?? "Panic Alert").toString();
  const description = (req.body.Description ?? req.body.description ?? "Panic alert triggered").toString();
  const latitude = (req.body.Latitude ?? req.body.latitude ?? req.body.lattitude ?? "").toString();
  const longitude = (req.body.Longitude ?? req.body.longitude ?? "").toString();

  let memberInfoId = Number(req.body.MemberInfoId ?? req.body.memberInfoId ?? 0);

  const jwtUserId = Number((req as any).user?.userId ?? 0);
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
    const uploaded = (req as any).file as { filename?: string } | undefined;
    const uploadPath = uploaded?.filename ? `/uploads/${uploaded.filename}` : null;

    const workerMeta = passportNo ? await findWorkerMetadataByPassport(passportNo) : null;

    const created = await prisma.tbl_ProbSol.create({
      data: {
        Prob_ID: passportNo || workerIdFromJwt || (memberInfoId ? memberInfoId.toString() : ""),
        Type: "Panic",
        Title: title,
        Description:
          latitude || longitude
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
        Lat: Number.isFinite(Number(latitude)) ? (Number(latitude) as any) : undefined,
        Lng: Number.isFinite(Number(longitude)) ? (Number(longitude) as any) : undefined,
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
  } catch (e) {
    throw e;
  }
}

// New route name requested
app.post("/panic", upload.single("file"), handlePanic);

// Backward-compatible route for existing frontend
app.post("/Api/Panic", requireAuth, upload.single("file"), handlePanic);

app.get("/Api/Worker/Documents", requireAuth, async (req, res, next) => {
  try {
    const jwtUserId = Number((req as any).user?.userId ?? 0);
    const workerId = await findWorkerIdByJwtUserId(jwtUserId);
    if (!workerId) return res.status(400).json({ error: "Worker not found" });

    const row = await prisma.tbl_Worker_Attachments.findFirst({
      where: { Worker_Id: workerId },
    });

    const docs = [
      { type: "passport", name: "Passport Copy", path: (row as any)?.Passport_Copy ?? null, filename: (row as any)?.Passport_Copy_Filename ?? null },
      { type: "permit", name: "Work Permit", path: (row as any)?.Permit_Copy ?? null, filename: (row as any)?.Permit_Copy_Filename ?? null },
      { type: "insurance", name: "Insurance Policy", path: (row as any)?.Insurance_Policy ?? null, filename: (row as any)?.Insurance_Policy_Filename ?? null },
      { type: "contract", name: "Employment Contract", path: (row as any)?.Employment_Contract ?? null, filename: (row as any)?.Employment_Contract_Filename ?? null },
      { type: "demand_letter", name: "Demand Letter", path: (row as any)?.Demand_Letter ?? null, filename: (row as any)?.Demand_Letter_Filename ?? null },
    ].map((d) => {
      const p = d.path != null ? String(d.path) : "";
      const isUrl = p.startsWith("http://") || p.startsWith("https://") || p.startsWith("/uploads/");
      const url = p ? (isUrl ? (p.startsWith("/uploads/") ? `${req.protocol}://${req.get("host")}${p}` : p) : "") : "";
      return { ...d, url, hasFile: !!url };
    });

    return res.json({ workerId, documents: docs });
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Worker/Documents", requireAuth, upload.single("file"), async (req, res, next) => {
  const docType = (req.body?.docType ?? req.body?.DocType ?? "").toString().trim().toLowerCase();
  const uploaded = (req as any).file as { filename?: string; originalname?: string } | undefined;
  if (!uploaded?.filename) {
    return res.status(400).json({ error: "file is required" });
  }

  try {
    const jwtUserId = Number((req as any).user?.userId ?? 0);
    const workerId = await findWorkerIdByJwtUserId(jwtUserId);
    if (!workerId) return res.status(400).json({ error: "Worker not found" });

    const uploadPath = `/uploads/${uploaded.filename}`;
    const fileName = (uploaded.originalname ?? uploaded.filename).toString();

    const allowed = new Set(["passport", "permit", "insurance", "contract", "demand_letter"]);
    const t = allowed.has(docType) ? docType : "passport";

    const existing = await prisma.tbl_Worker_Attachments.findFirst({ where: { Worker_Id: workerId } });
    const data: any = { Worker_Id: workerId };
    if (t === "passport") {
      safeUnlinkUpload((existing as any)?.Passport_Copy);
      data.Passport_Copy = uploadPath;
      data.Passport_Copy_Filename = fileName;
    } else if (t === "permit") {
      safeUnlinkUpload((existing as any)?.Permit_Copy);
      data.Permit_Copy = uploadPath;
      data.Permit_Copy_Filename = fileName;
    } else if (t === "insurance") {
      safeUnlinkUpload((existing as any)?.Insurance_Policy);
      data.Insurance_Policy = uploadPath;
      data.Insurance_Policy_Filename = fileName;
    } else if (t === "contract") {
      safeUnlinkUpload((existing as any)?.Employment_Contract);
      data.Employment_Contract = uploadPath;
      data.Employment_Contract_Filename = fileName;
    } else if (t === "demand_letter") {
      safeUnlinkUpload((existing as any)?.Demand_Letter);
      data.Demand_Letter = uploadPath;
      data.Demand_Letter_Filename = fileName;
    }

    await prisma.tbl_Worker_Attachments.upsert({
      where: { Worker_Id: workerId },
      create: data,
      update: data,
    });

    return res.json({ ok: true, docType: t, url: `${req.protocol}://${req.get("host")}${uploadPath}` });
  } catch (e) {
    return next(e);
  }
});

app.delete("/Api/Worker/Documents", requireAuth, async (req, res, next) => {
  const raw = Array.isArray(req.query.docType) ? req.query.docType[0] : req.query.docType;
  const docType = (raw ?? "").toString().trim().toLowerCase();

  try {
    const jwtUserId = Number((req as any).user?.userId ?? 0);
    const workerId = await findWorkerIdByJwtUserId(jwtUserId);
    if (!workerId) return res.status(400).json({ error: "Worker not found" });

    const allowed = new Set(["passport", "permit", "insurance", "contract", "demand_letter"]);
    const t = allowed.has(docType) ? docType : "";
    if (!t) return res.status(400).json({ error: "docType is required" });

    const existing = await prisma.tbl_Worker_Attachments.findFirst({ where: { Worker_Id: workerId } });
    if (!existing) return res.json({ ok: true });

    const data: any = {};
    if (t === "passport") {
      safeUnlinkUpload((existing as any)?.Passport_Copy);
      data.Passport_Copy = null;
      data.Passport_Copy_Filename = null;
    } else if (t === "permit") {
      safeUnlinkUpload((existing as any)?.Permit_Copy);
      data.Permit_Copy = null;
      data.Permit_Copy_Filename = null;
    } else if (t === "insurance") {
      safeUnlinkUpload((existing as any)?.Insurance_Policy);
      data.Insurance_Policy = null;
      data.Insurance_Policy_Filename = null;
    } else if (t === "contract") {
      safeUnlinkUpload((existing as any)?.Employment_Contract);
      data.Employment_Contract = null;
      data.Employment_Contract_Filename = null;
    } else if (t === "demand_letter") {
      safeUnlinkUpload((existing as any)?.Demand_Letter);
      data.Demand_Letter = null;
      data.Demand_Letter_Filename = null;
    }

    await prisma.tbl_Worker_Attachments.update({
      where: { Worker_Id: workerId },
      data,
    });

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Worker/Problems", requireAuth, async (req, res, next) => {
  try {
    const jwtUserId = Number((req as any).user?.userId ?? 0);
    const workerId = await findWorkerIdByJwtUserId(jwtUserId);
    const passport = await findWorkerPassportByJwtUserId(jwtUserId);

    if (!workerId && !passport) return res.json([]);

    const rows = await prisma.tbl_ProbSol.findMany({
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
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Panic/Latest", async (req, res, next) => {
  const rawSinceId = Array.isArray(req.query.sinceId) ? req.query.sinceId[0] : req.query.sinceId;
  const sinceId = rawSinceId != null ? Number(rawSinceId) : 0;

  try {
    const rows = await prisma.tbl_ProbSol.findMany({
      where: {
        ID: {
          gt: Number.isFinite(sinceId) ? sinceId : 0,
        },
      },
      orderBy: {
        ID: "desc",
      },
    });

    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

const requireAuthority = checkRole([1, 4, 5, 6, 7]);
const requireReportsAccess = checkRole([1, 3, 4, 5, 6, 7]);

app.post("/Api/Problems/Resolve", requireAuth, requireAuthority, async (req, res, next) => {
  const id = Number(req.body?.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "id is required" });
  }

  try {
    await prisma.tbl_ProbSol.update({
      where: { ID: id },
      data: {
        ProbStatus: "Resolved",
        Updated_On: new Date(),
        IsResolved: true,
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

app.get("/api/admin/stats", requireAuth, requireAuthority, async (_req, res, next) => {
  try {
    const now = new Date();

    const activeAlerts = await prisma.tbl_ProbSol.count({
      where: {
        OR: [{ IsResolved: false }, { IsResolved: null }],
      },
    });

    const activePanicAlerts = await prisma.tbl_ProbSol.count({
      where: {
        Type: "Panic",
        OR: [{ IsResolved: false }, { IsResolved: null }],
      },
    });

    const activeIssues = await prisma.tbl_ProbSol.count({
      where: {
        NOT: { Type: "Panic" },
        OR: [{ IsResolved: false }, { IsResolved: null }],
      },
    });

    const totalUsersRows = (await prisma.$queryRawUnsafe("SELECT COUNT(1) as cnt FROM Tbl_User")) as any[];
    const totalUsers = totalUsersRows?.[0]?.cnt != null ? Number(totalUsersRows[0].cnt) : 0;

    const months: { key: string; month: string }[] = [];
    const endMonth = startOfMonth(now);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(endMonth.getFullYear(), endMonth.getMonth() - i, 1);
      months.push({
        key: monthKey(d),
        month: d.toLocaleString("en-US", { month: "short" }),
      });
    }
    const start12Months = new Date(endMonth.getFullYear(), endMonth.getMonth() - 11, 1);

    const monthRows = await prisma.tbl_ProbSol.findMany({
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

    const monthCounts = new Map<string, number>();
    for (const r of monthRows ?? []) {
      const dt = r?.Updated_On ? new Date(r.Updated_On) : null;
      if (!dt || !Number.isFinite(dt.getTime())) continue;
      const k = monthKey(dt);
      monthCounts.set(k, (monthCounts.get(k) ?? 0) + 1);
    }

    const alertTrends = months.map((m) => ({
      key: m.key,
      month: m.month,
      alerts: monthCounts.get(m.key) ?? 0,
    }));

    const workersByCountryRows = (await prisma.$queryRawUnsafe(
      "SELECT ISNULL(c.Country_Name, 'Unknown') as name, COUNT(1) as value FROM Tbl_User u INNER JOIN Tbl_Worker_PersonalInfo wpi ON wpi.Worker_Id = u.User_Id LEFT JOIN Tbl_Country c ON c.ID = wpi.Nationality GROUP BY c.Country_Name ORDER BY value DESC",
    )) as any[];

    const workersByCountry = (workersByCountryRows ?? []).map((r) => ({
      name: r?.name != null ? String(r.name) : "Unknown",
      value: r?.value != null ? Number(r.value) : 0,
    }));

    const totalWorkers = workersByCountry.reduce((sum, x) => sum + (Number.isFinite(x.value) ? x.value : 0), 0);

    const weekStart = startOfWeekMonday(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekRows = await prisma.tbl_ProbSol.findMany({
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
    const weeklyMap = new Map<string, { panic: number; issue: number }>();
    for (const d of dayLabels) weeklyMap.set(d, { panic: 0, issue: 0 });

    for (const r of weekRows ?? []) {
      const dt = r?.Updated_On ? new Date(r.Updated_On) : null;
      if (!dt || !Number.isFinite(dt.getTime())) continue;
      const idx = (dt.getDay() + 6) % 7;
      const label = dayLabels[idx] ?? "Mon";
      const entry = weeklyMap.get(label);
      if (!entry) continue;
      const t = r?.Type != null ? String(r.Type) : "";
      if (t.toLowerCase() === "panic") entry.panic += 1;
      else entry.issue += 1;
    }

    const weeklyOverview = dayLabels.map((d) => ({ day: d, ...weeklyMap.get(d)! }));

    const recentProblems = await prisma.tbl_ProbSol.findMany({
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

    const recentUsers = (await prisma.$queryRawUnsafe(
      "SELECT TOP (5) ID, User_Id, User_Name, Created_On FROM Tbl_User ORDER BY Created_On DESC, ID DESC"
    )) as any[];

    const activity: any[] = [];

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
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Employers/List", requireAuth, requireAuthority, async (_req, res, next) => {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT TOP (500) User_Id, Employer_Name, Employer_Address, Employer_ContactPerson, Employer_Position, Employer_EmailID, Employer_OfficeNumber, Employer_PIC_MobileNumber, Created_On FROM Tbl_Employer ORDER BY Created_On DESC",
    )) as any[];
    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

app.get("/api/search/global", requireAuth, requireAuthority, async (req, res, next) => {
  const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const q = (rawQ ?? "").toString().trim();
  if (!q) return res.json({ workers: [], employers: [] });

  try {
    const like = `%${q}%`;
    const workers = (await prisma.$queryRawUnsafe(
      "SELECT TOP (10) Worker_Id, Name, Passport_Number, Created_On FROM Tbl_Worker_PersonalInfo WHERE (Name LIKE @p1 OR Passport_Number LIKE @p1 OR Worker_Id LIKE @p1) ORDER BY Created_On DESC",
      like,
    )) as any[];

    const employers = (await prisma.$queryRawUnsafe(
      "SELECT TOP (10) User_Id, Employer_Name, Employer_ContactPerson, Employer_EmailID, Created_On FROM Tbl_Employer WHERE (Employer_Name LIKE @p1 OR Employer_ContactPerson LIKE @p1 OR Employer_EmailID LIKE @p1 OR User_Id LIKE @p1) ORDER BY Created_On DESC",
      like,
    )) as any[];

    return res.json({ workers: workers ?? [], employers: employers ?? [] });
  } catch (e) {
    return next(e);
  }
});

app.get("/api/reports/entry", requireAuth, requireReportsAccess, async (req, res, next) => {
  const rawFrom = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
  const rawTo = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;

  const from = rawFrom ? new Date(String(rawFrom)) : null;
  const to = rawTo ? new Date(String(rawTo)) : null;

  try {
    const rows = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: {
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

    return res.json((rows ?? []).map((r) => ({ ...r, Current_Location: null, Company_Name: null })));
  } catch (e) {
    return next(e);
  }
});

app.get("/api/reports/visa-expire", requireAuth, requireReportsAccess, async (req, res, next) => {
  const rawDays = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
  const days = Math.min(3650, Math.max(1, Number(rawDays ?? 90)));

  try {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);

    const rows = (await prisma.$queryRawUnsafe(
      "SELECT TOP (2000) wpi.Worker_Id, wpi.Name, wpi.Passport_Number, pi.Permit_Expire_Date, wpi.Created_On, wpi.Company_Name, CASE WHEN pi.Permit_Expire_Date IS NULL THEN 'Missing Data' ELSE 'OK' END as StatusLabel FROM Tbl_Worker_PersonalInfo wpi LEFT JOIN Tbl_Worker_PermitInsurance pi ON pi.Worker_Id = wpi.Worker_Id WHERE (pi.Permit_Expire_Date IS NULL OR (pi.Permit_Expire_Date >= @p1 AND pi.Permit_Expire_Date < @p2)) ORDER BY CASE WHEN pi.Permit_Expire_Date IS NULL THEN 1 ELSE 0 END, pi.Permit_Expire_Date ASC",
      now,
      end,
    )) as any[];

    return res.json({ windowDays: days, rows: rows ?? [] });
  } catch (e) {
    return next(e);
  }
});

app.get("/api/reports/insurance-expire", requireAuth, requireReportsAccess, async (req, res, next) => {
  const rawDays = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
  const days = Math.min(3650, Math.max(1, Number(rawDays ?? 90)));

  try {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);

    const rows = (await prisma.$queryRawUnsafe(
      "SELECT TOP (2000) wpi.Worker_Id, wpi.Name, wpi.Passport_Number, wei.Contract_Expiry_Date, wpi.Created_On, wei.Employer_Name as Company_Name, CASE WHEN wei.Contract_Expiry_Date IS NULL THEN 'Missing Data' ELSE 'OK' END as StatusLabel " +
        "FROM Tbl_Worker_PersonalInfo wpi " +
        "LEFT JOIN Tbl_Worker_EmployerInfo wei ON wei.Worker_Id = wpi.Worker_Id " +
        "WHERE (wei.Contract_Expiry_Date IS NULL OR (wei.Contract_Expiry_Date >= @p1 AND wei.Contract_Expiry_Date < @p2)) " +
        "ORDER BY CASE WHEN wei.Contract_Expiry_Date IS NULL THEN 1 ELSE 0 END, wei.Contract_Expiry_Date ASC",
      now,
      end,
    )) as any[];

    return res.json({ windowDays: days, rows: rows ?? [] });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Panic/Active", requireAuth, requireAuthority, async (_req, res, next) => {
  try {
    const rows = await prisma.tbl_ProbSol.findMany({
      where: {
        Type: "Panic",
        OR: [{ IsResolved: false }, { IsResolved: null }],
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

    const workerIds = Array.from(
      new Set((rows ?? []).map((r) => (r.worker_ID ?? "").toString()).filter(Boolean))
    );

    const workerPhotos = workerIds.length
      ? await prisma.tbl_Worker_PersonalInfo.findMany({
          where: {
            Worker_Id: { in: workerIds },
          },
          select: {
            Worker_Id: true,
            Photo: true,
          },
        })
      : [];

    const photoByWorkerId = new Map<string, string | null>();
    for (const w of workerPhotos ?? []) {
      photoByWorkerId.set(w.Worker_Id, w.Photo ?? null);
    }

    return res.json(
      (rows ?? []).map((r) => ({
        ...r,
        passportPhoto: r.worker_ID ? photoByWorkerId.get(r.worker_ID) ?? null : null,
      }))
    );
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Panic/History", requireAuth, requireAuthority, async (_req, res, next) => {
  try {
    const rows = await prisma.tbl_ProbSol.findMany({
      where: {
        Type: "Panic",
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

    const workerIds = Array.from(
      new Set((rows ?? []).map((r) => (r.worker_ID ?? "").toString()).filter(Boolean))
    );

    const workerPhotos = workerIds.length
      ? await prisma.tbl_Worker_PersonalInfo.findMany({
          where: {
            Worker_Id: { in: workerIds },
          },
          select: {
            Worker_Id: true,
            Photo: true,
          },
        })
      : [];

    const photoByWorkerId = new Map<string, string | null>();
    for (const w of workerPhotos ?? []) {
      photoByWorkerId.set(w.Worker_Id, w.Photo ?? null);
    }

    return res.json(
      (rows ?? []).map((r) => ({
        ...r,
        passportPhoto: r.worker_ID ? photoByWorkerId.get(r.worker_ID) ?? null : null,
      }))
    );
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Workers/List", requireAuth, requireReportsAccess, async (_req, res, next) => {
  try {
    const rows = await prisma.tbl_Worker_PersonalInfo.findMany({
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

    const natIds = Array.from(new Set((rows ?? []).map((r) => r.Nationality).filter((x): x is number => x != null)));
    const countries = natIds.length
      ? await prisma.tbl_Country.findMany({
          where: { ID: { in: natIds } },
          select: { ID: true, Country_Name: true },
        })
      : [];

    const countryById = new Map<number, string>();
    for (const c of countries ?? []) {
      countryById.set(c.ID, c.Country_Name);
    }

    return res.json(
      (rows ?? []).map((r) => ({
        Worker_Id: r.Worker_Id,
        Passport_Number: r.Passport_Number,
        Email_Id: r.Email_Id,
        Created_On: r.Created_On,
        Current_Location: null,
        Company_Name: null,
        Country_Name: r.Nationality != null ? countryById.get(r.Nationality) ?? null : null,
      }))
    );
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Panic/Resolve", requireAuth, requireAuthority, async (req, res, next) => {
  const id = Number(req.body?.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "id is required" });
  }

  try {
    await prisma.tbl_ProbSol.update({
      where: { ID: id },
      data: {
        ProbStatus: "Resolved",
        Updated_On: new Date(),
        IsResolved: true,
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

// AddProblem -> POST /panic-like but authenticated and uses UserId from token
app.post("/Api/AddProblem", requireAuth, async (req, res) => {
  const user = (req as any).user as { userId: number };
  const title = (req.body.Title ?? req.body.title ?? "").toString();
  const description = (req.body.Description ?? req.body.description ?? "").toString();
  const latitude = (req.body.Latitude ?? req.body.latitude ?? req.body.lattitude ?? "").toString();
  const longitude = (req.body.Longitude ?? req.body.longitude ?? "").toString();

  try {
    const rows = (await prisma.$queryRawUnsafe(
      "DECLARE @Result BIGINT; EXEC [dbo].[ProblemAndActivity_InsertOrUpdate] @ProblemAndActivityId = @p1, @Title = @p2, @Description = @p3, @latitude = @p4, @longitude = @p5, @MemberInfoId = @p6, @UserId = @p7, @Result = @Result OUTPUT; SELECT @Result as Result;",
      0,
      title,
      description,
      latitude,
      longitude,
      0,
      Number(user.userId)
    )) as any[];

    const result = Array.isArray(rows) ? rows[0]?.Result : null;
    if (result && Number(result) > 0) {
      return res.status(200).json(Number(result));
    }

    return res.status(500).json({ error: "Unable to save data" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Unable to save data" });
  }
});

app.get("/Api/ProblemList", requireAuth, requireAuthority, async (req, res, next) => {
  try {
    const rawStatus = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
    const rawType = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
    const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;

    const status = (rawStatus ?? "").toString().trim().toLowerCase();
    const type = (rawType ?? "").toString().trim().toLowerCase();
    const q = (rawQ ?? "").toString().trim();
    const limit = Math.min(1000, Math.max(1, Number(rawLimit ?? 200)));

    const wherePrisma: any = {};

    if (status === "active") {
      wherePrisma.OR = [{ IsResolved: false }, { IsResolved: null }];
    } else if (status === "resolved") {
      wherePrisma.IsResolved = true;
    }

    if (type === "panic") {
      wherePrisma.Type = "Panic";
    } else if (type === "issue") {
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

    const rows = await prisma.tbl_ProbSol.findMany({
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
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Chat/Sessions", requireAuth, async (req, res, next) => {
  const workerId = Number(req.body?.WorkerId ?? req.body?.workerId ?? 0);
  if (!Number.isFinite(workerId) || workerId <= 0) {
    return res.status(400).json({ error: "WorkerId is required" });
  }

  try {
    const rows = (await prisma.$queryRawUnsafe(
      "INSERT INTO [dbo].[ChatSessions]([WorkerId]) OUTPUT INSERTED.[ChatSessionId] as ChatSessionId VALUES(@p1);",
      workerId
    )) as any[];

    const id = Array.isArray(rows) ? rows[0]?.ChatSessionId : null;
    if (!id) return res.status(500).json({ error: "Unable to create chat session" });
    return res.json({ ChatSessionId: Number(id) });
  } catch (e: any) {
    const msg = (e?.message ?? "").toString();
    if (/invalid object name|chatsessions/i.test(msg)) {
      return res.status(501).json({ error: "Chat tables not installed" });
    }
    return next(e);
  }
});

app.post("/Api/Chat/Messages", requireAuth, async (req, res, next) => {
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
    const rows = (await prisma.$queryRawUnsafe(
      "INSERT INTO [dbo].[ChatMessages]([ChatSessionId],[SenderType],[Message]) OUTPUT INSERTED.[ChatMessageId] as ChatMessageId, INSERTED.[CreatedOn] as CreatedOn VALUES(@p1,@p2,@p3);",
      chatSessionId,
      senderType,
      message
    )) as any[];

    const row = Array.isArray(rows) ? rows[0] : null;
    return res.json({ ChatMessageId: row?.ChatMessageId != null ? Number(row.ChatMessageId) : null, CreatedOn: row?.CreatedOn ?? null });
  } catch (e: any) {
    const msg = (e?.message ?? "").toString();
    if (/invalid object name|chatmessages/i.test(msg)) {
      return res.status(501).json({ error: "Chat tables not installed" });
    }
    return next(e);
  }
});

app.get("/Api/Chat/Messages", requireAuth, async (req, res, next) => {
  const raw = Array.isArray(req.query.ChatSessionId) ? req.query.ChatSessionId[0] : req.query.ChatSessionId;
  const chatSessionId = raw != null ? Number(raw) : 0;
  if (!Number.isFinite(chatSessionId) || chatSessionId <= 0) {
    return res.status(400).json({ error: "ChatSessionId is required" });
  }

  try {
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT [ChatMessageId],[ChatSessionId],[SenderType],[Message],[CreatedOn] FROM [dbo].[ChatMessages] WHERE [ChatSessionId] = @p1 ORDER BY [CreatedOn] ASC;",
      chatSessionId
    )) as any[];

    return res.json(rows ?? []);
  } catch (e: any) {
    const msg = (e?.message ?? "").toString();
    if (/invalid object name|chatmessages/i.test(msg)) {
      return res.status(501).json({ error: "Chat tables not installed" });
    }
    return next(e);
  }
});

app.post("/Api/Chat/SupportRequests", requireAuth, async (req, res, next) => {
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
    const rows = (await prisma.$queryRawUnsafe(
      "INSERT INTO [dbo].[SupportRequests]([ChatSessionId],[WorkerId],[Reason]) OUTPUT INSERTED.[SupportRequestId] as SupportRequestId VALUES(@p1,@p2,@p3);",
      chatSessionId,
      workerId,
      reason
    )) as any[];

    const id = Array.isArray(rows) ? rows[0]?.SupportRequestId : null;
    return res.json({ SupportRequestId: id != null ? Number(id) : null });
  } catch (e: any) {
    const msg = (e?.message ?? "").toString();
    if (/invalid object name|supportrequests/i.test(msg)) {
      return res.status(501).json({ error: "Chat tables not installed" });
    }
    return next(e);
  }
});

app.get("/Api/Chat/DbStatus", requireAuth, async (_req, res, next) => {
  try {
    const sessions = (await prisma.$queryRawUnsafe("SELECT TOP (1) [ChatSessionId] FROM [dbo].[ChatSessions] ORDER BY [ChatSessionId] DESC;")) as any[];
    const messages = (await prisma.$queryRawUnsafe("SELECT TOP (1) [ChatMessageId] FROM [dbo].[ChatMessages] ORDER BY [ChatMessageId] DESC;")) as any[];
    return res.json({ ok: true, chatSessionsVisible: Array.isArray(sessions), chatMessagesVisible: Array.isArray(messages) });
  } catch (e: any) {
    const msg = (e?.message ?? "").toString();
    if (/invalid object name/i.test(msg)) {
      return res.status(200).json({ ok: false, error: "Chat tables not installed" });
    }
    return next(e);
  }
});

app.post("/Api/Chat/AIReply", requireAuth, async (req, res, next) => {
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
    await prisma.$queryRawUnsafe(
      "INSERT INTO [dbo].[ChatMessages]([ChatSessionId],[SenderType],[Message]) VALUES(@p1,@p2,@p3);",
      chatSessionId,
      "User",
      userText
    );

    const systemPrompt =
      "You are a Supportive Safety Liaison for International Workers using the MWMSYS app. " +
      "You must only answer questions related to: personal safety, emergency steps, worker rights, workplace issues, immigration/permit general guidance, and how to use this app (panic button, reporting, evidence upload). " +
      "If the user asks for anything off-topic (coding, entertainment, politics, hacking, medical diagnosis, illegal activity, unrelated personal advice), politely refuse and redirect to safety/app topics. " +
      "Use Markdown for clarity with short sections and bullet points. Keep responses concise. " +
      "If the user indicates immediate danger, instruct them to trigger the Panic Button and contact local emergency services immediately.";

    const client = new OpenAI({ apiKey });

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

    await prisma.$queryRawUnsafe(
      "INSERT INTO [dbo].[ChatMessages]([ChatSessionId],[SenderType],[Message]) VALUES(@p1,@p2,@p3);",
      chatSessionId,
      "AI",
      aiText
    );

    return res.json({ ok: true, reply: aiText });
  } catch (e: any) {
    const msg = (e?.message ?? "").toString();
    if (/invalid object name|chatmessages|chatsessions/i.test(msg)) {
      return res.status(501).json({ error: "Chat tables not installed" });
    }
    return next(e);
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const errStr = (err?.message ?? "").toString();
  if (/prisma|econnrefused|failed to connect|timeout|sql|database/i.test(errStr) || err?.code === "P1001" || err?.code === "P1002") {
    console.error("Database Connection Error", err);
    return res.status(503).json({ error: "Database Connection Error", code: "DB_CONNECTION_ERROR" });
  }

  const message =
    err?.message?.toString?.() ??
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
