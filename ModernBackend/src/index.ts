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
import Stripe from "stripe";

import { prisma } from "./db";
import { encryptLegacyPassword } from "./cryptoLegacy";
import { checkRole, requireAuth, signToken } from "./auth";
import { buildWorkerScopeWhere } from "./services/queryGuard";

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

async function ensureChatTablesExist(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.ChatSessions','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.ChatSessions (" +
        "ChatSessionId INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "WorkerId INT NOT NULL," +
        "CreatedOn DATETIME NOT NULL DEFAULT(GETDATE())" +
        ");" +
        "CREATE INDEX IX_ChatSessions_WorkerId ON dbo.ChatSessions(WorkerId);" +
        "END"
    );
  } catch {
    // ignore
  }

  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.ChatMessages','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.ChatMessages (" +
        "ChatMessageId INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "ChatSessionId INT NOT NULL," +
        "SenderType VARCHAR(20) NOT NULL," +
        "Message NVARCHAR(2000) NOT NULL," +
        "CreatedOn DATETIME NOT NULL DEFAULT(GETDATE())" +
        ");" +
        "CREATE INDEX IX_ChatMessages_SessionId ON dbo.ChatMessages(ChatSessionId);" +
        "END"
    );
  } catch {
    // ignore
  }

  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.SupportRequests','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.SupportRequests (" +
        "SupportRequestId INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "ChatSessionId INT NOT NULL," +
        "WorkerId INT NOT NULL," +
        "Reason NVARCHAR(500) NULL," +
        "CreatedOn DATETIME NOT NULL DEFAULT(GETDATE())" +
        ");" +
        "CREATE INDEX IX_SupportRequests_SessionId ON dbo.SupportRequests(ChatSessionId);" +
        "END"
    );
  } catch {
    // ignore
  }
}

async function assertChatSessionOwner(chatSessionId: number, workerId: number): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    "SELECT TOP (1) [ChatSessionId] FROM [dbo].[ChatSessions] WHERE [ChatSessionId]=@p1 AND [WorkerId]=@p2;",
    chatSessionId,
    workerId
  )) as any[];
  return !!rows?.[0]?.ChatSessionId;
}

async function ensureHrmsRequestTablesExist(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_HRMS_Overtime_Request','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.Tbl_HRMS_Overtime_Request (" +
        "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "workerId VARCHAR(100) NOT NULL," +
        "workDate DATE NOT NULL," +
        "hours DECIMAL(10,2) NOT NULL DEFAULT(0)," +
        "reason NVARCHAR(500) NULL," +
        "status VARCHAR(20) NOT NULL DEFAULT('Pending')," +
        "createdOn DATETIME NOT NULL DEFAULT(GETDATE())," +
        "decisionBy VARCHAR(100) NULL," +
        "decisionOn DATETIME NULL" +
        ");" +
        "CREATE INDEX IX_HRMS_OT_workerId ON dbo.Tbl_HRMS_Overtime_Request(workerId);" +
        "CREATE INDEX IX_HRMS_OT_status ON dbo.Tbl_HRMS_Overtime_Request(status);" +
        "END"
    );
  } catch {
    // ignore
  }

  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_HRMS_Expense_Claim','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.Tbl_HRMS_Expense_Claim (" +
        "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "workerId VARCHAR(100) NOT NULL," +
        "claimDate DATE NOT NULL," +
        "amount DECIMAL(18,2) NOT NULL DEFAULT(0)," +
        "category VARCHAR(50) NULL," +
        "description NVARCHAR(500) NULL," +
        "status VARCHAR(20) NOT NULL DEFAULT('Pending')," +
        "createdOn DATETIME NOT NULL DEFAULT(GETDATE())," +
        "decisionBy VARCHAR(100) NULL," +
        "decisionOn DATETIME NULL" +
        ");" +
        "CREATE INDEX IX_HRMS_EXP_workerId ON dbo.Tbl_HRMS_Expense_Claim(workerId);" +
        "CREATE INDEX IX_HRMS_EXP_status ON dbo.Tbl_HRMS_Expense_Claim(status);" +
        "END"
    );
  } catch {
    // ignore
  }

  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_HRMS_Expense_Attachment','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.Tbl_HRMS_Expense_Attachment (" +
        "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "claimId INT NOT NULL," +
        "filePath VARCHAR(500) NOT NULL," +
        "originalName NVARCHAR(255) NULL," +
        "mimeType VARCHAR(120) NULL," +
        "fileSize INT NULL," +
        "createdOn DATETIME NOT NULL DEFAULT(GETDATE())" +
        ");" +
        "CREATE INDEX IX_HRMS_EXP_ATT_claimId ON dbo.Tbl_HRMS_Expense_Attachment(claimId);" +
        "END"
    );
  } catch {
    // ignore
  }
}

async function broadcastTableExists(): Promise<boolean> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT OBJECT_ID('dbo.Tbl_Broadcast_Message','U') AS oid;"
    )) as Array<{ oid: any }>;
    const oid = rows?.[0]?.oid;
    return oid != null;
  } catch {
    return false;
  }
}

async function ensureBroadcastTableExists(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_Broadcast_Message','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.Tbl_Broadcast_Message (" +
        "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "senderRoleId INT NOT NULL," +
        "senderKey VARCHAR(120) NULL," +
        "senderName VARCHAR(120) NULL," +
        "message NVARCHAR(2000) NOT NULL," +
        "target VARCHAR(30) NOT NULL," +
        "createdOn DATETIME NOT NULL DEFAULT(GETDATE())" +
        ");" +
        "END"
    );
  } catch {
    // ignore
  }

  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_Broadcast_Attachment','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.Tbl_Broadcast_Attachment (" +
        "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "messageId INT NOT NULL," +
        "url VARCHAR(500) NOT NULL," +
        "mime VARCHAR(120) NULL," +
        "originalName VARCHAR(260) NULL," +
        "sizeBytes BIGINT NULL," +
        "createdOn DATETIME NOT NULL DEFAULT(GETDATE())" +
        ");" +
        "CREATE INDEX IX_Broadcast_Att_MessageId ON dbo.Tbl_Broadcast_Attachment(messageId);" +
        "END"
    );
  } catch {
    // ignore
  }
}

const broadcastUpload = multer({
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
    fileSize: 50 * 1024 * 1024,
    files: 5,
  },
});

async function resolveWorkerScopes(workerId: string): Promise<{ employerId: string | null; nationality: number | null; agencyIds: string[] }> {
  const wid = (workerId ?? "").toString().trim();
  if (!wid) return { employerId: null, nationality: null, agencyIds: [] };

  const info = await prisma.tbl_Worker_PersonalInfo.findFirst({
    where: { Worker_Id: wid },
    select: { Employer_Id: true, Nationality: true },
  });

  const links = await prisma.tbl_Worker_RecruitAgent.findMany({
    where: { Worker_Id: wid },
    select: { Malaysian_Reqruitment_Agency: true, Source_Country_Requirtment_Agency: true },
    take: 10,
  });

  const agencyIds = new Set<string>();
  for (const l of links ?? []) {
    const a = (l.Malaysian_Reqruitment_Agency ?? "").toString().trim();
    const b = (l.Source_Country_Requirtment_Agency ?? "").toString().trim();
    if (a) agencyIds.add(a);
    if (b) agencyIds.add(b);
  }

  const employerId = (info?.Employer_Id ?? "").toString().trim() || null;
  const nationality = info?.Nationality != null ? Number(info.Nationality) : NaN;

  return {
    employerId,
    nationality: Number.isFinite(nationality) ? nationality : null,
    agencyIds: Array.from(agencyIds),
  };
}

async function resolveEmployerAgencies(employerId: string): Promise<string[]> {
  const eid = (employerId ?? "").toString().trim();
  if (!eid) return [];

  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: { Employer_Id: eid },
    select: { Worker_Id: true },
    take: 5000,
  });
  const wids = Array.from(new Set((workers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
  if (!wids.length) return [];

  const links = await prisma.tbl_Worker_RecruitAgent.findMany({
    where: { Worker_Id: { in: wids } },
    select: { Malaysian_Reqruitment_Agency: true, Source_Country_Requirtment_Agency: true },
    take: 5000,
  });

  const agencyIds = new Set<string>();
  for (const l of links ?? []) {
    const a = (l.Malaysian_Reqruitment_Agency ?? "").toString().trim();
    const b = (l.Source_Country_Requirtment_Agency ?? "").toString().trim();
    if (a) agencyIds.add(a);
    if (b) agencyIds.add(b);
  }
  return Array.from(agencyIds);
}

async function ensureRosterTablesExist(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_Shift_Template','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.Tbl_Shift_Template (" +
        "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "entityId VARCHAR(100) NOT NULL," +
        "name VARCHAR(80) NOT NULL," +
        "startTime VARCHAR(5) NOT NULL," +
        "endTime VARCHAR(5) NOT NULL," +
        "breakMinutes INT NOT NULL DEFAULT(0)," +
        "createdOn DATETIME NOT NULL DEFAULT(GETDATE())" +
        ");" +
        "END"
    );
  } catch {
    // ignore
  }

  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_Roster_Assignment','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.Tbl_Roster_Assignment (" +
        "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "workerId VARCHAR(100) NOT NULL," +
        "entityId VARCHAR(100) NOT NULL," +
        "date DATE NOT NULL," +
        "shiftId INT NOT NULL," +
        "updatedOn DATETIME NOT NULL DEFAULT(GETDATE())" +
        ");" +
        "CREATE UNIQUE INDEX UX_Roster_Worker_Date ON dbo.Tbl_Roster_Assignment(workerId,date);" +
        "END"
    );
  } catch {
    // ignore
  }
}

async function ensureSubscriptionTableExists(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_Subscription','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.Tbl_Subscription (" +
        "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
        "entityId VARCHAR(100) NOT NULL," +
        "planType VARCHAR(20) NOT NULL," +
        "status VARCHAR(20) NOT NULL," +
        "startDate DATETIME NOT NULL," +
        "endDate DATETIME NOT NULL" +
        ");" +
        "END"
    );
  } catch {
    // ignore
  }
}

const app = express();

app.use(cors());
// Stripe webhooks need the raw body; capture it via verify for signature verification.
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

const stripeSecretKey = (process.env.STRIPE_SECRET_KEY ?? "").toString().trim();
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" }) : null;

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

app.get("/stripe/return", (req, res) => {
  const raw = Array.isArray((req.query as any)?.redirect) ? (req.query as any).redirect[0] : (req.query as any)?.redirect;
  const redirect = (raw ?? "").toString().trim();
  if (!redirect) {
    return res.status(400).send("Missing redirect");
  }

  if (/^(javascript|data):/i.test(redirect)) {
    return res.status(400).send("Invalid redirect");
  }

  // Prevent open redirects: allow only configured schemes/hosts.
  // - Allowed schemes default: http, https, exp (Expo).
  // - Allowed hosts can be set via STRIPE_RETURN_ALLOWED_HOSTS (comma-separated).
  const allowedSchemes = new Set(["http", "https", "exp"]);
  const allowedHostsEnv = (process.env.STRIPE_RETURN_ALLOWED_HOSTS ?? "").toString();
  const allowedHosts = new Set(
    allowedHostsEnv
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  try {
    const u = new URL(redirect);
    const scheme = (u.protocol ?? "").replace(":", "").toLowerCase();
    const host = (u.hostname ?? "").toLowerCase();

    if (!allowedSchemes.has(scheme)) {
      return res.status(400).send("Invalid redirect scheme");
    }

    if ((scheme === "http" || scheme === "https") && allowedHosts.size > 0 && !allowedHosts.has(host)) {
      return res.status(400).send("Invalid redirect host");
    }

    return res.redirect(302, redirect);
  } catch {
    return res.status(400).send("Invalid redirect");
  }
});

app.get("/Api/HRMS/Overtime/me", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rows = (await prisma.$queryRawUnsafe(
      "SELECT TOP (1000) id, workerId, workDate, hours, reason, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Overtime_Request WHERE workerId=@P1 ORDER BY id DESC",
      userKey
    )) as any[];

    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Worker/Location", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (roleId !== 2) return res.status(403).json({ error: "Forbidden" });

    const jwtUserId = Number((req as any).user?.userId ?? 0);
    const workerId = await findWorkerIdByJwtUserId(jwtUserId);
    if (!workerId) return res.status(400).json({ error: "Worker not found" });

    const lat = req.body?.lat ?? req.body?.Lat ?? req.body?.latitude ?? req.body?.Latitude;
    const lng = req.body?.lng ?? req.body?.Lng ?? req.body?.longitude ?? req.body?.Longitude;
    const accuracy = req.body?.accuracy ?? req.body?.Accuracy;

    const latNum = Number(lat);
    const lngNum = Number(lng);
    const accNum = accuracy != null ? Number(accuracy) : NaN;

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const updatedOn = new Date();

    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_Worker_Location','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.Tbl_Worker_Location (" +
        "workerId VARCHAR(100) NOT NULL PRIMARY KEY," +
        "lat DECIMAL(10,7) NULL," +
        "lng DECIMAL(10,7) NULL," +
        "accuracy DECIMAL(10,2) NULL," +
        "updatedOn DATETIME NULL" +
        ") END"
    );

    const accVal = Number.isFinite(accNum) ? accNum : null;
    await prisma.$executeRawUnsafe(
      "MERGE dbo.Tbl_Worker_Location AS t " +
        "USING (SELECT ? AS workerId, ? AS lat, ? AS lng, ? AS accuracy, ? AS updatedOn) AS s " +
        "ON (t.workerId = s.workerId) " +
        "WHEN MATCHED THEN UPDATE SET lat=s.lat, lng=s.lng, accuracy=s.accuracy, updatedOn=s.updatedOn " +
        "WHEN NOT MATCHED THEN INSERT (workerId,lat,lng,accuracy,updatedOn) VALUES (s.workerId,s.lat,s.lng,s.accuracy,s.updatedOn);",
      workerId,
      latNum,
      lngNum,
      accVal,
      updatedOn
    );

    const workerInfo = await prisma.tbl_Worker_PersonalInfo.findFirst({
      where: { Worker_Id: workerId },
      select: { Employer_Id: true, Nationality: true, Name: true },
    });

    const agencyLinks = await prisma.tbl_Worker_RecruitAgent.findMany({
      where: { Worker_Id: workerId },
      select: { Malaysian_Reqruitment_Agency: true, Source_Country_Requirtment_Agency: true },
      take: 5,
    });

    const agencyIds = new Set<string>();
    for (const l of agencyLinks ?? []) {
      const a = (l.Malaysian_Reqruitment_Agency ?? "").toString().trim();
      const b = (l.Source_Country_Requirtment_Agency ?? "").toString().trim();
      if (a) agencyIds.add(a);
      if (b) agencyIds.add(b);
    }

    const payload = {
      workerId,
      name: workerInfo?.Name ?? null,
      lat: latNum,
      lng: lngNum,
      accuracy: Number.isFinite(accNum) ? accNum : null,
      updatedAt: updatedOn.toISOString(),
    };

    try {
      io.to("admin").emit("worker_location_update", payload);

      const employerId = (workerInfo?.Employer_Id ?? "").toString().trim();
      if (employerId) io.to(`employer:${employerId}`).emit("worker_location_update", payload);

      for (const id of agencyIds) {
        io.to(`agency:${id}`).emit("worker_location_update", payload);
      }

      const nationality = workerInfo?.Nationality != null ? Number(workerInfo.Nationality) : NaN;
      if (Number.isFinite(nationality)) io.to(`nationality:${nationality}`).emit("worker_location_update", payload);
    } catch {
      // ignore emit errors
    }

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Timesheets", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    await ensureRosterTablesExist();

    const rawFrom = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const rawTo = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const from = rawFrom ? new Date(String(rawFrom)) : null;
    const to = rawTo ? new Date(String(rawTo)) : null;
    if (!from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true, Name: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (roleId !== 1 && !workerIds.length) return res.json({ rows: [], days: [] });

    const nameById = new Map<string, string | null>();
    for (const w of scopedWorkers ?? []) {
      nameById.set((w.Worker_Id ?? "").toString(), w.Name ?? null);
    }

    const rosterRows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT TOP (50000) r.workerId, r.date, s.startTime, s.endTime, s.breakMinutes FROM dbo.Tbl_Roster_Assignment r LEFT JOIN dbo.Tbl_Shift_Template s ON s.id=r.shiftId WHERE r.date >= CAST(? AS DATE) AND r.date <= CAST(? AS DATE)"
        : `SELECT TOP (50000) r.workerId, r.date, s.startTime, s.endTime, s.breakMinutes FROM dbo.Tbl_Roster_Assignment r LEFT JOIN dbo.Tbl_Shift_Template s ON s.id=r.shiftId WHERE r.date >= CAST(? AS DATE) AND r.date <= CAST(? AS DATE) AND r.workerId IN (${workerIds
            .map(() => "?")
            .join(",")})`,
      fromStr,
      toStr,
      ...(roleId === 1 ? [] : workerIds)
    )) as Array<any>;

    const attendanceRows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT TOP (50000) workerId, checkIn, checkOut FROM dbo.Tbl_Attendance WHERE checkIn >= ? AND checkIn <= DATEADD(day,1,?)"
        : `SELECT TOP (50000) workerId, checkIn, checkOut FROM dbo.Tbl_Attendance WHERE checkIn >= ? AND checkIn <= DATEADD(day,1,?) AND workerId IN (${workerIds
            .map(() => "?")
            .join(",")})`,
      fromStr,
      toStr,
      ...(roleId === 1 ? [] : workerIds)
    )) as Array<any>;

    const parseTime = (t: string) => {
      const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(t ?? ""));
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
      return hh * 60 + mm;
    };

    const plannedByWorkerDay = new Map<string, number>();
    for (const r of rosterRows ?? []) {
      const workerId = (r.workerId ?? "").toString();
      const d = r.date ? new Date(r.date) : null;
      if (!workerId || !d || isNaN(d.getTime())) continue;
      const day = d.toISOString().slice(0, 10);
      const startMin = parseTime(r.startTime);
      const endMin = parseTime(r.endTime);
      const breakMin = Number(r.breakMinutes ?? 0);
      const minutes = startMin != null && endMin != null ? Math.max(0, endMin - startMin - (Number.isFinite(breakMin) ? breakMin : 0)) : 0;
      const hours = Math.round((minutes / 60) * 100) / 100;
      plannedByWorkerDay.set(`${workerId}|${day}`, hours);
    }

    const actualByWorkerDay = new Map<string, number>();
    for (const a of attendanceRows ?? []) {
      const workerId = (a.workerId ?? "").toString();
      const cin = a.checkIn ? new Date(a.checkIn) : null;
      const cout = a.checkOut ? new Date(a.checkOut) : null;
      if (!workerId || !cin || isNaN(cin.getTime())) continue;
      const day = cin.toISOString().slice(0, 10);
      if (!cout || isNaN(cout.getTime())) continue;
      const minutes = Math.max(0, (cout.getTime() - cin.getTime()) / 60000);
      const hours = Math.round((minutes / 60) * 100) / 100;
      const key = `${workerId}|${day}`;
      actualByWorkerDay.set(key, Math.round(((actualByWorkerDay.get(key) ?? 0) + hours) * 100) / 100);
    }

    const allKeys = new Set<string>();
    for (const k of plannedByWorkerDay.keys()) allKeys.add(k);
    for (const k of actualByWorkerDay.keys()) allKeys.add(k);

    const dayRows = Array.from(allKeys)
      .map((k) => {
        const [workerId, day] = k.split("|");
        const planned = plannedByWorkerDay.get(k) ?? 0;
        const actual = actualByWorkerDay.get(k) ?? 0;
        const overtime = Math.max(0, Math.round((actual - planned) * 100) / 100);
        return {
          workerId,
          name: nameById.get(workerId) ?? null,
          day,
          plannedHours: planned,
          actualHours: actual,
          overtimeHours: overtime,
        };
      })
      .sort((a, b) => (a.day === b.day ? a.workerId.localeCompare(b.workerId) : b.day.localeCompare(a.day)));

    const agg = new Map<string, { planned: number; actual: number; overtime: number; days: number }>();
    for (const r of dayRows) {
      const cur = agg.get(r.workerId) ?? { planned: 0, actual: 0, overtime: 0, days: 0 };
      cur.planned = Math.round((cur.planned + (r.plannedHours ?? 0)) * 100) / 100;
      cur.actual = Math.round((cur.actual + (r.actualHours ?? 0)) * 100) / 100;
      cur.overtime = Math.round((cur.overtime + (r.overtimeHours ?? 0)) * 100) / 100;
      cur.days += 1;
      agg.set(r.workerId, cur);
    }

    const summary = Array.from(agg.entries())
      .map(([workerId, v]) => ({
        workerId,
        name: nameById.get(workerId) ?? null,
        plannedHours: v.planned,
        actualHours: v.actual,
        overtimeHours: v.overtime,
        days: v.days,
      }))
      .sort((a, b) => (b.overtimeHours ?? 0) - (a.overtimeHours ?? 0));

    return res.json({ rows: summary, days: dayRows });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Workers/Locations", requireAuth, checkRole([1, 3, 4, 5, 6, 7]), async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true, Name: true },
      take: 5000,
    });
    const workerIds = (scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean);

    if (roleId !== 1 && !workerIds.length) return res.json({ rows: [] });

    await prisma.$executeRawUnsafe(
      "IF OBJECT_ID('dbo.Tbl_Worker_Location','U') IS NULL BEGIN " +
        "CREATE TABLE dbo.Tbl_Worker_Location (" +
        "workerId VARCHAR(100) NOT NULL PRIMARY KEY," +
        "lat DECIMAL(10,7) NULL," +
        "lng DECIMAL(10,7) NULL," +
        "accuracy DECIMAL(10,2) NULL," +
        "updatedOn DATETIME NULL" +
        ") END"
    );

    const locations = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT TOP (5000) workerId, lat, lng, accuracy, updatedOn FROM dbo.Tbl_Worker_Location ORDER BY updatedOn DESC"
        : `SELECT TOP (5000) workerId, lat, lng, accuracy, updatedOn FROM dbo.Tbl_Worker_Location WHERE workerId IN (${workerIds
            .map(() => "?")
            .join(",")}) ORDER BY updatedOn DESC`,
      ...(roleId === 1 ? [] : workerIds)
    )) as Array<{ workerId: string; lat: any; lng: any; accuracy: any; updatedOn: any }>;

    const nameById = new Map<string, string | null>();
    for (const w of scopedWorkers ?? []) {
      nameById.set((w.Worker_Id ?? "").toString(), w.Name ?? null);
    }

    return res.json({
      rows: (locations ?? []).map((l) => ({
        workerId: l.workerId,
        name: nameById.get(l.workerId) ?? null,
        lat: l.lat != null ? Number(l.lat as any) : null,
        lng: l.lng != null ? Number(l.lng as any) : null,
        accuracy: l.accuracy != null ? Number(l.accuracy as any) : null,
        updatedAt: l.updatedOn ? new Date(l.updatedOn as any).toISOString() : null,
      })),
    });
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/subscription/checkout", requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe is not configured" });

    await ensureSubscriptionTableExists();

    const user = (req as any).user as { userKey?: string; roleId?: number; emailId?: string };
    const roleId = user?.roleId != null ? Number(user.roleId) : null;
    if (roleId !== 3 && roleId !== 4) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const entityId = (user?.userKey ?? "").toString().trim();
    if (!entityId) return res.status(400).json({ error: "Missing entity id" });

    const planType = (req.body?.planType ?? "").toString().trim();
    if (!planType) return res.status(400).json({ error: "planType is required" });

    const planKey = planType.toLowerCase();
    if (planKey === "free") return res.status(400).json({ error: "Free plan does not require checkout" });

    const priceIdEnvKey = planKey === "pro" ? "STRIPE_PRICE_PRO" : planKey === "enterprise" ? "STRIPE_PRICE_ENTERPRISE" : "";
    const priceId = priceIdEnvKey ? (process.env as any)[priceIdEnvKey] : null;
    if (!priceId || typeof priceId !== "string" || !priceId.trim()) {
      return res.status(500).json({ error: "Stripe price is not configured" });
    }

    const origin = (req.header("origin") ?? "").toString().trim();
    const bodySuccess = (req.body?.successUrl ?? "").toString().trim();
    const bodyCancel = (req.body?.cancelUrl ?? "").toString().trim();

    const envSuccess = (process.env.STRIPE_SUCCESS_URL ?? "").toString().trim();
    const envCancel = (process.env.STRIPE_CANCEL_URL ?? "").toString().trim();

    const isAbsoluteUrl = (u: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(u) && !/^(javascript|data):/i.test(u);

    const successUrl = bodySuccess && isAbsoluteUrl(bodySuccess) ? bodySuccess : envSuccess ? envSuccess : origin ? `${origin}/pricing?checkout=success` : "";
    const cancelUrl = bodyCancel && isAbsoluteUrl(bodyCancel) ? bodyCancel : envCancel ? envCancel : origin ? `${origin}/pricing?checkout=cancel` : "";

    if (!successUrl || !cancelUrl) {
      return res.status(500).json({ error: "Missing success/cancel URL (set STRIPE_SUCCESS_URL/STRIPE_CANCEL_URL or pass successUrl/cancelUrl)" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId.trim(), quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: entityId,
      customer_email: user?.emailId ? String(user.emailId) : undefined,
      // Make sure subscription carries metadata so webhooks can map back.
      subscription_data: {
        metadata: {
          entityId,
          planType,
          roleId: roleId != null ? String(roleId) : "",
        },
      },
      metadata: {
        entityId,
        planType,
        roleId: roleId != null ? String(roleId) : "",
      },
    });

    return res.status(201).json({ ok: true, url: session.url, id: session.id });
  } catch (e) {
    return next(e);
  }
});

app.post(
  "/webhooks/stripe",
  async (req, res) => {
    try {
      if (!stripe) return res.status(500).send("Stripe not configured");

      const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").toString().trim();
      if (!webhookSecret) return res.status(500).send("Missing webhook secret");

      const sig = req.header("stripe-signature");
      if (!sig) return res.status(400).send("Missing stripe-signature");

      const payload = (req as any).rawBody;
      if (!payload) return res.status(400).send("Missing raw body");

      const event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);

      if (event.type === "checkout.session.completed") {
        const s = event.data.object as Stripe.Checkout.Session;
        const entityId = (s.metadata?.entityId ?? s.client_reference_id ?? "").toString().trim();
        const planType = (s.metadata?.planType ?? "").toString().trim();
        const subscriptionId = (s.subscription ?? "").toString().trim();

        if (entityId && planType && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const startMs = (sub.current_period_start ?? 0) * 1000;
          const endMs = (sub.current_period_end ?? 0) * 1000;
          const startDate = startMs ? new Date(startMs) : new Date();
          const endDate = endMs ? new Date(endMs) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          // Idempotency: avoid duplicating the same active period.
          const existing = await prisma.tbl_Subscription.findFirst({
            where: {
              entityId,
              planType,
              status: "Active",
              startDate,
              endDate,
            },
          });

          if (!existing) {
            await prisma.tbl_Subscription.updateMany({
              where: { entityId, status: "Active" },
              data: { status: "Expired" },
            });

            await prisma.tbl_Subscription.create({
              data: {
                entityId,
                planType,
                status: "Active",
                startDate,
                endDate,
              },
            });
          }
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const s = event.data.object as Stripe.Subscription;
        const entityId = (s.metadata?.entityId ?? "").toString().trim();
        if (entityId) {
          await prisma.tbl_Subscription.updateMany({
            where: { entityId, status: "Active" },
            data: { status: "Expired" },
          });
        }
      }

      if (event.type === "customer.subscription.updated") {
        const s = event.data.object as Stripe.Subscription;
        const entityId = (s.metadata?.entityId ?? "").toString().trim();
        const planType = (s.metadata?.planType ?? "").toString().trim();
        if (entityId) {
          const startMs = (s.current_period_start ?? 0) * 1000;
          const endMs = (s.current_period_end ?? 0) * 1000;
          const startDate = startMs ? new Date(startMs) : new Date();
          const endDate = endMs ? new Date(endMs) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          const latest = await prisma.tbl_Subscription.findFirst({
            where: { entityId, status: "Active" },
            orderBy: [{ endDate: "desc" }],
          });

          if (latest) {
            await prisma.tbl_Subscription.update({
              where: { id: latest.id },
              data: {
                planType: planType || latest.planType,
                startDate,
                endDate,
              },
            });
          } else if (planType) {
            await prisma.tbl_Subscription.create({
              data: {
                entityId,
                planType,
                status: "Active",
                startDate,
                endDate,
              },
            });
          }
        }
      }

      if (event.type === "invoice.payment_failed") {
        const inv = event.data.object as Stripe.Invoice;
        const subId = (inv.subscription ?? "").toString().trim();
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const entityId = (sub.metadata?.entityId ?? "").toString().trim();
          if (entityId) {
            await prisma.tbl_Subscription.updateMany({
              where: { entityId, status: "Active" },
              data: { status: "Expired" },
            });
          }
        }
      }

      return res.json({ received: true });
    } catch (err: any) {
      return res.status(400).send(err?.message ?? "Webhook Error");
    }
  }
);
app.use("/uploads", express.static(uploadsDir));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:8081",
  },
});

io.on("connection", (socket) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return;
    const raw = typeof token === "string" ? token : "";
    const bearer = raw.toLowerCase().startsWith("bearer ") ? raw.slice("bearer ".length).trim() : raw;
    const secret = process.env.JWT_SECRET;
    if (!secret || !bearer) return;

    const decoded = jwt.verify(bearer, secret) as any;
    const roleId = decoded?.roleId != null ? Number(decoded.roleId) : null;
    const userKey = (decoded?.userKey ?? "").toString().trim();
    const countryCode = decoded?.countryCode != null ? Number(decoded.countryCode) : NaN;

    socket.join("broadcast_all");

    if (roleId === 1) {
      socket.join("admin");
      console.log("ALERTS: User joined admin room");
    }

    if (roleId === 3 && userKey) {
      socket.join("employers");
      socket.join(`employer:${userKey}`);
    }
    if (roleId === 4 && userKey) {
      socket.join("agencies");
      socket.join(`agency:${userKey}`);
    }

    if (roleId === 2 && userKey) {
      socket.join("workers");
      socket.join(`worker:${userKey}`);
      resolveWorkerScopes(userKey)
        .then((s) => {
          if (s.employerId) socket.join(`employer:${s.employerId}`);
          for (const id of s.agencyIds) socket.join(`agency:${id}`);
          if (s.nationality != null) socket.join(`nationality:${s.nationality}`);
        })
        .catch(() => undefined);
    }

    if (roleId === 7) {
      socket.join("labour");
      if (Number.isFinite(countryCode)) socket.join(`nationality:${countryCode}`);
    }

    const isPanicViewer = roleId === 1 || roleId === 3 || roleId === 4 || roleId === 5 || roleId === 6 || roleId === 7;
    if (isPanicViewer) {
      socket.join("panic_viewers");
    }

    const isAuthority = roleId === 1 || roleId === 4 || roleId === 5 || roleId === 6 || roleId === 7;
    if (isAuthority) {
      socket.join("authorities");
    }

    if (roleId === 5) {
      socket.join("embassy_source");
      if (Number.isFinite(countryCode)) socket.join(`nationality:${countryCode}`);
    }
    if (roleId === 6) {
      socket.join("embassy_destination");
      if (Number.isFinite(countryCode)) socket.join(`nationality:${countryCode}`);
    }
  } catch (e) {
    console.warn("socket auth rejected", e);
  }
});

app.post("/Api/Broadcast/Send", requireAuth, async (req, res, next) => {
  try {
    await ensureBroadcastTableExists();
    const ok = await broadcastTableExists();
    if (!ok) return res.status(501).json({ error: "Broadcast table not installed" });

    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    const senderKey = (user?.userKey ?? "").toString().trim() || null;
    const senderName = (user?.userName ?? user?.emailId ?? senderKey ?? "").toString().trim() || null;
    const message = (req.body?.message ?? "").toString();

    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });
    if (!message.trim()) return res.status(400).json({ error: "message is required" });

    let target: "workers" | "workers_employers" | "nationality" | "all" = "all";
    if (roleId === 3) target = "workers";
    else if (roleId === 4) target = "workers_employers";
    else if (roleId === 5 || roleId === 6) target = "nationality";
    else if (roleId === 7 || roleId === 1) target = "all";

    const rows = (await prisma.$queryRawUnsafe(
      "INSERT INTO dbo.Tbl_Broadcast_Message(senderRoleId,senderKey,senderName,message,target) OUTPUT INSERTED.id, INSERTED.createdOn VALUES(@P1,@P2,@P3,@P4,@P5);",
      roleId,
      senderKey,
      senderName,
      message.trim().slice(0, 2000),
      target
    )) as any[];

    const row = Array.isArray(rows) ? rows[0] : null;
    const payload = {
      id: row?.id != null ? Number(row.id) : null,
      senderRoleId: roleId,
      senderKey,
      senderName,
      message: message.trim().slice(0, 2000),
      target,
      createdOn: row?.createdOn ? new Date(row.createdOn).toISOString() : new Date().toISOString(),
      attachments: [] as Array<{ id: number; url: string; mime: string | null; originalName: string | null; sizeBytes: number | null }>,
    };

    try {
      if (target === "all") {
        io.to("broadcast_all").emit("broadcast_message", payload);
      } else if (target === "workers") {
        if (senderKey) io.to(`employer:${senderKey}`).emit("broadcast_message", payload);
      } else if (target === "workers_employers") {
        if (senderKey) io.to(`agency:${senderKey}`).emit("broadcast_message", payload);

        // Also explicitly target employers connected to workers under this agency.
        if (senderKey) {
          const links = await prisma.tbl_Worker_RecruitAgent.findMany({
            where: {
              OR: [{ Malaysian_Reqruitment_Agency: senderKey }, { Source_Country_Requirtment_Agency: senderKey }],
            },
            select: { Worker_Id: true },
            take: 5000,
          });
          const wids = Array.from(new Set((links ?? []).map((x) => (x.Worker_Id ?? "").toString()).filter(Boolean)));
          if (wids.length) {
            const infos = await prisma.tbl_Worker_PersonalInfo.findMany({
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
      } else if (target === "nationality") {
        const nat = user?.countryCode != null ? Number(user.countryCode) : NaN;
        if (Number.isFinite(nat)) io.to(`nationality:${nat}`).emit("broadcast_message", payload);
      }
    } catch {
      // ignore emit errors
    }

    return res.json({ ok: true, payload });
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Broadcast/SendMultipart", requireAuth, broadcastUpload.array("files", 5), async (req, res, next) => {
  try {
    await ensureBroadcastTableExists();
    const ok = await broadcastTableExists();
    if (!ok) return res.status(501).json({ error: "Broadcast table not installed" });

    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    const senderKey = (user?.userKey ?? "").toString().trim() || null;
    const senderName = (user?.userName ?? user?.emailId ?? senderKey ?? "").toString().trim() || null;
    const message = (req.body?.message ?? "").toString();

    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    const files = ((req as any).files ?? []) as Array<{ filename?: string; mimetype?: string; originalname?: string; size?: number }>;
    const hasFiles = Array.isArray(files) && files.length > 0;
    if (!message.trim() && !hasFiles) return res.status(400).json({ error: "message or files are required" });

    let target: "workers" | "workers_employers" | "nationality" | "all" = "all";
    if (roleId === 3) target = "workers";
    else if (roleId === 4) target = "workers_employers";
    else if (roleId === 5 || roleId === 6) target = "nationality";
    else if (roleId === 7 || roleId === 1) target = "all";

    const inserted = (await prisma.$queryRawUnsafe(
      "INSERT INTO dbo.Tbl_Broadcast_Message(senderRoleId,senderKey,senderName,message,target) OUTPUT INSERTED.id, INSERTED.createdOn VALUES(@P1,@P2,@P3,@P4,@P5);",
      roleId,
      senderKey,
      senderName,
      message.trim().slice(0, 2000),
      target
    )) as any[];

    const row = Array.isArray(inserted) ? inserted[0] : null;
    const messageId = row?.id != null ? Number(row.id) : NaN;
    if (!Number.isFinite(messageId)) return res.status(500).json({ error: "Unable to send" });

    const attachments: Array<{ id: number; url: string; mime: string | null; originalName: string | null; sizeBytes: number | null }> = [];
    for (const f of files ?? []) {
      const filename = (f.filename ?? "").toString();
      if (!filename) continue;
      const url = `/uploads/${filename}`;
      const mime = (f.mimetype ?? "").toString() || null;
      const originalName = (f.originalname ?? filename).toString() || null;
      const sizeBytes = f.size != null ? Number(f.size) : null;

      const attRows = (await prisma.$queryRawUnsafe(
        "INSERT INTO dbo.Tbl_Broadcast_Attachment(messageId,url,mime,originalName,sizeBytes) OUTPUT INSERTED.id VALUES(@P1,@P2,@P3,@P4,@P5);",
        messageId,
        url,
        mime,
        originalName,
        sizeBytes
      )) as any[];
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
      if (target === "all") {
        io.to("broadcast_all").emit("broadcast_message", payload);
      } else if (target === "workers") {
        if (senderKey) io.to(`employer:${senderKey}`).emit("broadcast_message", payload);
      } else if (target === "workers_employers") {
        if (senderKey) io.to(`agency:${senderKey}`).emit("broadcast_message", payload);

        if (senderKey) {
          const links = await prisma.tbl_Worker_RecruitAgent.findMany({
            where: {
              OR: [{ Malaysian_Reqruitment_Agency: senderKey }, { Source_Country_Requirtment_Agency: senderKey }],
            },
            select: { Worker_Id: true },
            take: 5000,
          });
          const wids = Array.from(new Set((links ?? []).map((x) => (x.Worker_Id ?? "").toString()).filter(Boolean)));
          if (wids.length) {
            const infos = await prisma.tbl_Worker_PersonalInfo.findMany({
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
      } else if (target === "nationality") {
        const nat = user?.countryCode != null ? Number(user.countryCode) : NaN;
        if (Number.isFinite(nat)) io.to(`nationality:${nat}`).emit("broadcast_message", payload);
      }
    } catch {
      // ignore
    }

    return res.json({ ok: true, payload });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Broadcast/Feed", requireAuth, async (req, res, next) => {
  try {
    await ensureBroadcastTableExists();
    const ok = await broadcastTableExists();
    if (!ok) return res.status(501).json({ error: "Broadcast table not installed" });

    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    const userKey = (user?.userKey ?? "").toString().trim();
    const countryCode = user?.countryCode != null ? Number(user.countryCode) : NaN;

    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limit = Math.min(200, Math.max(10, Number(limitRaw ?? 60)));
    const fetchLimit = Math.min(600, Math.max(60, limit * 6));

    const targets = new Set<string>();
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
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT TOP (${fetchLimit}) id, senderRoleId, senderKey, senderName, message, target, createdOn FROM dbo.Tbl_Broadcast_Message WHERE target IN (${placeholders}) ORDER BY createdOn DESC, id DESC`,
      ...targetList
    )) as any[];

    // For nationality-targeted messages, filter to the user's nationality if needed.
    let out = (rows ?? []).map((r) => ({
      id: Number(r.id),
      senderRoleId: Number(r.senderRoleId),
      senderKey: r.senderKey != null ? String(r.senderKey) : null,
      senderName: r.senderName != null ? String(r.senderName) : null,
      message: String(r.message ?? ""),
      target: String(r.target ?? ""),
      createdOn: r.createdOn ? new Date(r.createdOn).toISOString() : null,
      attachments: [] as Array<{ id: number; url: string; mime: string | null; originalName: string | null; sizeBytes: number | null }>,
    }));

    if (roleId === 2) {
      const scopes = userKey ? await resolveWorkerScopes(userKey) : { employerId: null, nationality: null, agencyIds: [] as string[] };
      const employerId = scopes.employerId;
      const agencySet = new Set(scopes.agencyIds);
      out = out.filter((m) => {
        if (m.target === "all") return true;
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
    } else if (roleId === 3) {
      const myEmployerId = userKey;
      const agencies = myEmployerId ? await resolveEmployerAgencies(myEmployerId) : [];
      const agencySet = new Set(agencies);
      out = out.filter((m) => {
        if (m.target === "all") return true;
        if (m.target === "workers_employers") return agencySet.has(String(m.senderKey ?? "").trim());
        return false;
      });
    } else if (roleId === 4) {
      const myAgencyId = userKey;
      out = out.filter((m) => {
        if (m.target === "all") return true;
        if (m.target === "workers_employers") return String(m.senderKey ?? "").trim() === myAgencyId;
        return false;
      });
    } else if (roleId === 5 || roleId === 6) {
      if (!Number.isFinite(countryCode)) {
        out = out.filter((x) => x.target !== "nationality");
      }
    }

    out = out.slice(0, limit);

    const ids = Array.from(new Set(out.map((x) => Number(x.id)).filter((x) => Number.isFinite(x) && x > 0)));
    if (ids.length) {
      const attPlaceholders = ids.map((_, i) => `@P${i + 1}`).join(",");
      const attRows = (await prisma.$queryRawUnsafe(
        `SELECT id, messageId, url, mime, originalName, sizeBytes FROM dbo.Tbl_Broadcast_Attachment WHERE messageId IN (${attPlaceholders}) ORDER BY id ASC`,
        ...ids
      )) as any[];

      const byMsg = new Map<number, Array<any>>();
      for (const a of attRows ?? []) {
        const mid = Number(a.messageId);
        if (!Number.isFinite(mid)) continue;
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
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Workers/:workerId", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    const workerId = (req.params?.workerId ?? "").toString().trim();
    if (!workerId) return res.status(400).json({ error: "workerId is required" });

    if (![1, 2, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    if (roleId === 2) {
      const myId = (user?.userKey ?? "").toString().trim();
      if (!myId || myId !== workerId) return res.status(403).json({ error: "Forbidden" });
    } else if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere(user);
      const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
      if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
    }

    const personal = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { Worker_Id: workerId } });
    if (!personal) return res.status(404).json({ error: "Not found" });

    const permit = await prisma.tbl_Worker_PermitInsurance.findFirst({ where: { Worker_Id: workerId } });
    const employer = await prisma.tbl_Worker_EmployerInfo.findFirst({ where: { Worker_Id: workerId } });

    return res.json({ personal, permit, employer });
  } catch (e) {
    return next(e);
  }
});

app.put("/Api/Workers/:workerId", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    const workerId = (req.params?.workerId ?? "").toString().trim();
    if (!workerId) return res.status(400).json({ error: "workerId is required" });

    // only admin/employer/agency/worker can update
    if (![1, 2, 3, 4].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    if (roleId === 2) {
      const myId = (user?.userKey ?? "").toString().trim();
      if (!myId || myId !== workerId) return res.status(403).json({ error: "Forbidden" });
    } else if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere(user);
      const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
      if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
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

    const updated = await prisma.tbl_Worker_PersonalInfo.update({
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

    if (
      permitIssue != null ||
      permitExpire != null ||
      permitIssuePlace != null ||
      insurancePolicyNumber != null ||
      soscoNumber != null
    ) {
      await prisma.tbl_Worker_PermitInsurance.upsert({
        where: { Worker_Id: workerId },
        create: {
          Worker_Id: workerId,
          ...(permitIssue && !isNaN(permitIssue.getTime()) ? { Permit_Issue_Date: permitIssue } : {}),
          ...(permitExpire && !isNaN(permitExpire.getTime()) ? { Permit_Expire_Date: permitExpire } : {}),
          ...(permitIssuePlace != null ? { Permit_Issue_Place: String(permitIssuePlace) } : {}),
          ...(insurancePolicyNumber != null ? { Insurance_Policy_Number: String(insurancePolicyNumber) } : {}),
          ...(soscoNumber != null ? { SOSCO_Number: String(soscoNumber) } : {}),
          Created_On: new Date(),
        } as any,
        update: {
          ...(permitIssue && !isNaN(permitIssue.getTime()) ? { Permit_Issue_Date: permitIssue } : {}),
          ...(permitExpire && !isNaN(permitExpire.getTime()) ? { Permit_Expire_Date: permitExpire } : {}),
          ...(permitIssuePlace != null ? { Permit_Issue_Place: String(permitIssuePlace) } : {}),
          ...(insurancePolicyNumber != null ? { Insurance_Policy_Number: String(insurancePolicyNumber) } : {}),
          ...(soscoNumber != null ? { SOSCO_Number: String(soscoNumber) } : {}),
          Created_On: new Date(),
        } as any,
      });
    }

    if (roleId !== 2) {
      const userRow = await prisma.tbl_User.findFirst({ where: { User_Id: workerId } });
      if (userRow) {
        await prisma.tbl_User.update({
          where: { User_Id_Email_Id: { User_Id: userRow.User_Id, Email_Id: userRow.Email_Id } } as any,
          data: {
            ...(email != null ? { Email_Id: String(email) } : {}),
            ...(name != null ? { User_Name: String(name) } : {}),
          } as any,
        });
      }
    }

    const permit = await prisma.tbl_Worker_PermitInsurance.findFirst({ where: { Worker_Id: workerId } });
    return res.json({ ok: true, personal: updated, permit });
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Workers/Create", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = Number(user?.roleId ?? 0);
    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

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

    const existingUser = await prisma.tbl_User.findFirst({
      where: {
        OR: [{ User_Id: workerId }, ...(emailId ? [{ Email_Id: emailId }] : [])],
      },
    });
    if (existingUser) return res.status(409).json({ error: "Worker user already exists" });

    const existingPassport = await prisma.tbl_Worker_PersonalInfo.findFirst({
      where: { Passport_Number: passportNo },
    });
    if (existingPassport) return res.status(409).json({ error: "Passport already exists" });

    const loginPwd = encryptLegacyPassword(password, workerId);

    await prisma.tbl_User.create({
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

    await prisma.tbl_Worker_PersonalInfo.create({
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
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/dashboard/me", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = user?.roleId != null ? Number(user.roleId) : 0;

    // Worker
    if (roleId === 2) {
      const workerId = ((user?.userKey ?? "").toString().trim() || null) ?? null;
      if (!workerId) return res.status(400).json({ error: "Worker not found" });

      const myIncidents = await prisma.tbl_ProbSol.count({ where: { worker_ID: workerId } });
      const openIncidents = await prisma.tbl_ProbSol.count({ where: { worker_ID: workerId, OR: [{ IsResolved: false }, { IsResolved: null }] } });
      const myLeaves = await prisma.tbl_Leave.count({ where: { workerId } });
      const pendingLeaves = await prisma.tbl_Leave.count({ where: { workerId, status: "Pending" } });
      const openAttendance = await prisma.tbl_Attendance.count({ where: { workerId, checkOut: null } });

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
    const scopeWhere = await buildWorkerScopeWhere(user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));

    const totalWorkers = workerIds.length;
    const incidents = workerIds.length
      ? await prisma.tbl_ProbSol.count({ where: { worker_ID: { in: workerIds } } })
      : 0;
    const openIncidents = workerIds.length
      ? await prisma.tbl_ProbSol.count({ where: { worker_ID: { in: workerIds }, OR: [{ IsResolved: false }, { IsResolved: null }] } })
      : 0;

    const leaves = workerIds.length ? await prisma.tbl_Leave.count({ where: { workerId: { in: workerIds } } }) : 0;
    const pendingLeaves = workerIds.length
      ? await prisma.tbl_Leave.count({ where: { workerId: { in: workerIds }, status: "Pending" } })
      : 0;

    const openAttendance = workerIds.length ? await prisma.tbl_Attendance.count({ where: { workerId: { in: workerIds }, checkOut: null } }) : 0;

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
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Incidents", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    if (roleId === 3 || roleId === 4) {
      const entityId = ((req as any).user?.userKey ?? "").toString().trim();
      if (!entityId) return res.status(400).json({ error: "Missing entity id" });
      const ok = await hasActivePlan(entityId);
      if (!ok) return res.status(402).json({ error: "Subscription required" });
    }

    const workerId = (req.body?.workerId ?? req.body?.Worker_Id ?? req.body?.WorkerId ?? "").toString().trim();
    const typeRaw = (req.body?.type ?? req.body?.Type ?? "Issue").toString().trim();
    const type = typeRaw.toLowerCase().includes("panic") ? "Panic" : "Issue";
    const title = (req.body?.title ?? req.body?.Title ?? (type === "Panic" ? "Panic Alert" : "Issue")).toString();
    const description = (req.body?.description ?? req.body?.Description ?? "").toString();

    if (!workerId) return res.status(400).json({ error: "workerId is required" });

    if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere((req as any).user);
      const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
      if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
    }

    const workerMeta = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { Worker_Id: workerId } });
    const employerMeta = await prisma.tbl_Worker_EmployerInfo.findFirst({ where: { Worker_Id: workerId } });

    const created = await prisma.tbl_ProbSol.create({
      data: {
        Prob_ID: workerMeta?.Passport_Number?.toString() ?? workerId,
        Type: type,
        Title: title,
        Description: description || title,
        ProbStatus: "Pending",
        Updated_On: new Date(),
        worker_ID: workerId,
        Current_Location: (workerMeta as any)?.Current_Location ?? undefined,
        Company_Name: (employerMeta as any)?.Employer_Name ?? (workerMeta as any)?.Company_Name ?? undefined,
        IsResolved: false,
      } as any,
    });

    try {
      io.to("admin").emit("new_trigger", {
        id: created.ID,
        title,
        description: description || title,
        workerId,
        companyName: (employerMeta as any)?.Employer_Name ?? null,
        status: "Pending",
        createdAt: new Date().toISOString(),
      });
    } catch {
      // ignore emit errors
    }

    return res.status(201).json({ ok: true, id: created.ID });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/me", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const roleId = user?.roleId != null ? Number(user.roleId) : null;
    const jwtUserId = user?.userId != null ? Number(user.userId) : 0;

    let workerId: string | null = null;
    let passportNo: string | null = null;

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
  } catch (e) {
    return next(e);
  }
});

async function hasActivePlan(entityId: string): Promise<boolean> {
  await ensureSubscriptionTableExists();
  const now = new Date();
  const active = await prisma.tbl_Subscription.findFirst({
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

function requireActivePlanForWrite(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user as { userKey?: string; roleId?: number };
  const roleId = user?.roleId != null ? Number(user.roleId) : null;
  if (roleId !== 3 && roleId !== 4) return next();

  const entityId = (user?.userKey ?? "").toString().trim();
  if (!entityId) return res.status(400).json({ error: "Missing entity id" });

  hasActivePlan(entityId)
    .then((ok) => {
      if (!ok) return res.status(402).json({ error: "Subscription required" });
      return next();
    })
    .catch(() => res.status(500).json({ error: "Unable to verify subscription" }));
}

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

app.get("/Api/subscription/me", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { userKey?: string; roleId?: number };
    const roleId = user?.roleId != null ? Number(user.roleId) : null;
    if (roleId !== 3 && roleId !== 4) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const entityId = (user?.userKey ?? "").toString().trim();
    if (!entityId) {
      return res.status(400).json({ error: "Missing entity id" });
    }

    await ensureSubscriptionTableExists();

    const now = new Date();
    const active = await prisma.tbl_Subscription.findFirst({
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
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/subscription/purchase", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { userKey?: string; roleId?: number };
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

    await ensureSubscriptionTableExists();

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 30);

    const created = await prisma.tbl_Subscription.create({
      data: {
        entityId,
        planType,
        status: "Active",
        startDate: now,
        endDate: end,
      },
    });

    return res.status(201).json({ ok: true, id: created.id, planType: created.planType, endDate: created.endDate });
  } catch (e) {
    return next(e);
  }
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

    if (userRole === 3) {
      try {
        await prisma.tbl_Employer.create({
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
      } catch {
        // ignore employer profile insert errors
      }
    }

    if (userRole === 4) {
      try {
        await prisma.tbl_Agent.create({
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
      } catch {
        // ignore agent profile insert errors
      }
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

    let countryCode: number | undefined = undefined;

    if (userRoleId === 6) {
      const embassyUserId = (user.User_Id ?? "").toString().trim();
      const candidates: Array<{ sql: string; param: any; key: string }> = [
        { sql: "SELECT TOP 1 Nationality as value FROM Tbl_Embassy WHERE User_Id = @p1", param: embassyUserId, key: "value" },
        { sql: "SELECT TOP 1 Country_Code as value FROM Tbl_Embassy WHERE User_Id = @p1", param: embassyUserId, key: "value" },
        { sql: "SELECT TOP 1 CountryCode as value FROM Tbl_Embassy WHERE User_Id = @p1", param: embassyUserId, key: "value" },
        { sql: "SELECT TOP 1 Nationality as value FROM Tbl_User WHERE User_Id = @p1", param: embassyUserId, key: "value" },
        { sql: "SELECT TOP 1 Country_Code as value FROM Tbl_User WHERE User_Id = @p1", param: embassyUserId, key: "value" },
        { sql: "SELECT TOP 1 CountryCode as value FROM Tbl_User WHERE User_Id = @p1", param: embassyUserId, key: "value" },
      ];

      for (const c of candidates) {
        try {
          const rows = (await prisma.$queryRawUnsafe(c.sql, c.param)) as any[];
          const row = Array.isArray(rows) ? rows[0] : null;
          const raw = row?.[c.key];
          const n = raw != null ? Number(raw) : NaN;
          if (Number.isFinite(n) && n > 0) {
            countryCode = n;
            break;
          }
        } catch {
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

    io.to("admin").emit("new_trigger", data);

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
app.post("/panic", requireAuth, upload.single("file"), handlePanic);

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

app.get("/Api/HRMS/Workers/:workerId/Profile", requireAuth, checkRole([1, 3, 4]), async (req, res, next) => {
  try {
    const workerId = (req.params?.workerId ?? "").toString().trim();
    if (!workerId) return res.status(400).json({ error: "workerId is required" });

    const roleId = Number((req as any).user?.roleId ?? 0);
    if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere((req as any).user);
      const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
      if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
    }

    const personal = await prisma.tbl_Worker_PersonalInfo.findFirst({
      where: { Worker_Id: workerId },
      select: {
        Worker_Id: true,
        Name: true,
        Passport_Number: true,
        Email_Id: true,
        Nationality: true,
        Gender: true,
        Date_Of_Birth: true,
        Contact_Number: true,
        Contact_Number_Country_Code: true,
        Address: true,
        Created_On: true,
        Employer_Id: true,
      },
    });

    const employerInfo = await prisma.tbl_Worker_EmployerInfo.findFirst({
      where: { Worker_Id: workerId },
      select: {
        Employer_Name: true,
        Employer_Address: true,
        Telephone_No: true,
        Contract_Expiry_Date: true,
        Contract_issue_Date: true,
        Employment_Description: true,
      },
    });

    const permit = await prisma.tbl_Worker_PermitInsurance.findFirst({
      where: { Worker_Id: workerId },
      select: {
        Permit_Issue_Date: true,
        Permit_Expire_Date: true,
        Insurance_Policy_Number: true,
        SOSCO_Number: true,
      },
    });

    return res.json({ personal, employerInfo, permit });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Workers/:workerId/Documents", requireAuth, checkRole([1, 3, 4]), async (req, res, next) => {
  try {
    const workerId = (req.params?.workerId ?? "").toString().trim();
    if (!workerId) return res.status(400).json({ error: "workerId is required" });

    const roleId = Number((req as any).user?.roleId ?? 0);
    if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere((req as any).user);
      const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
      if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
    }

    const row = await prisma.tbl_Worker_Attachments.findFirst({ where: { Worker_Id: workerId } });
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

app.post(
  "/Api/HRMS/Workers/:workerId/Documents",
  requireAuth,
  checkRole([1, 3, 4]),
  requireActivePlanForWrite,
  upload.single("file"),
  async (req, res, next) => {
    const workerId = (req.params?.workerId ?? "").toString().trim();
    const docType = (req.body?.docType ?? req.body?.DocType ?? "").toString().trim().toLowerCase();
    const uploaded = (req as any).file as { filename?: string; originalname?: string } | undefined;
    if (!workerId) return res.status(400).json({ error: "workerId is required" });
    if (!uploaded?.filename) return res.status(400).json({ error: "file is required" });

    try {
      const roleId = Number((req as any).user?.roleId ?? 0);
      if (roleId !== 1) {
        const scopeWhere = await buildWorkerScopeWhere((req as any).user);
        const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
        if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
      }

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
  }
);

app.delete("/Api/HRMS/Workers/:workerId/Documents", requireAuth, checkRole([1, 3, 4]), requireActivePlanForWrite, async (req, res, next) => {
  const workerId = (req.params?.workerId ?? "").toString().trim();
  const raw = Array.isArray(req.query.docType) ? req.query.docType[0] : req.query.docType;
  const docType = (raw ?? "").toString().trim().toLowerCase();

  try {
    if (!workerId) return res.status(400).json({ error: "workerId is required" });

    const roleId = Number((req as any).user?.roleId ?? 0);
    if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere((req as any).user);
      const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
      if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
    }

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

app.get("/Api/Panic/Latest", requireAuth, checkRole([1, 3, 4, 5, 6, 7]), async (req, res, next) => {
  const rawSinceId = Array.isArray(req.query.sinceId) ? req.query.sinceId[0] : req.query.sinceId;
  const sinceId = rawSinceId != null ? Number(rawSinceId) : 0;

  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));

    if (roleId !== 1 && !allowedWorkerIds.size) {
      return res.json([]);
    }

    const rows = await prisma.tbl_ProbSol.findMany({
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
  } catch (e) {
    return next(e);
  }
});

const requireAuthority = checkRole([1, 4, 5, 6, 7]);
const requireAlertViewer = checkRole([1, 3, 4, 5, 6, 7]);
const requireAdmin = checkRole([1]);
const requireReportsAccess = checkRole([1, 3, 4, 5, 6, 7]);

app.post("/Api/Incidents/Approve", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.body?.id ?? req.body?.incidentId ?? req.body?.panicId ?? 0);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "id is required" });
    }

    const row = await prisma.tbl_ProbSol.findFirst({ where: { ID: id } });
    if (!row) return res.status(404).json({ error: "Not found" });

    const updated = await prisma.tbl_ProbSol.update({
      where: { ID: id },
      data: { ProbStatus: "Approved", Updated_On: new Date(), Updated_By: ((req as any).user?.userKey ?? "admin").toString() },
    });

    const payload = {
      id: updated.ID,
      title: (updated.Title ?? updated.Type ?? "Alert").toString(),
      description: (updated.Description ?? "").toString(),
      workerId: (updated as any)?.worker_ID ?? null,
      companyName: (updated as any)?.Company_Name ?? null,
      currentLocation: (updated as any)?.Current_Location ?? null,
      status: "Approved",
      createdAt: updated.Updated_On ? new Date(updated.Updated_On as any).toISOString() : new Date().toISOString(),
    };

    try {
      io.to("panic_viewers").emit("new_trigger", payload);
      io.to("admin").emit("incident_approved", { id: updated.ID, status: "Approved" });
    } catch {
      // ignore emit errors
    }

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Panic/Forward", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const panicId = Number(req.body?.panicId ?? req.body?.id ?? 0);
    const target = (req.body?.target ?? req.body?.embassy ?? "").toString().trim();
    if (!Number.isFinite(panicId) || panicId <= 0) {
      return res.status(400).json({ error: "panicId is required" });
    }
    if (target !== "embassy_source" && target !== "embassy_destination") {
      return res.status(400).json({ error: "target must be embassy_source or embassy_destination" });
    }

    const row = await prisma.tbl_ProbSol.findFirst({ where: { ID: panicId, Type: "Panic" } });
    if (!row) return res.status(404).json({ error: "Panic not found" });

    if ((row as any)?.ProbStatus?.toString() === "Pending") {
      await prisma.tbl_ProbSol.update({ where: { ID: panicId }, data: { ProbStatus: "Approved", Updated_On: new Date() } });
    }

    const payload = {
      id: row.ID,
      title: (row as any)?.Title ?? "Panic Alert",
      description: (row as any)?.Description ?? "",
      workerId: (row as any)?.worker_ID ?? null,
      companyName: (row as any)?.Company_Name ?? null,
      currentLocation: (row as any)?.Current_Location ?? null,
      status: "Approved",
      createdOn: (row as any)?.Updated_On ?? null,
    };

    io.to(target).emit("panic_forwarded", payload);
    io.to(target).emit("new_trigger", payload);
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

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
    const scopeWhere = await buildWorkerScopeWhere((req as any).user);

    const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: {
        ...scopeWhere,
        OR: [{ Worker_Id: { contains: q } }, { Name: { contains: q } }, { Passport_Number: { contains: q } }],
      },
      select: { Worker_Id: true, Name: true, Passport_Number: true, Created_On: true },
      orderBy: [{ Created_On: "desc" }],
      take: 50,
    });

    const employers = await prisma.tbl_Employer.findMany({
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
    const scopeWhere = await buildWorkerScopeWhere((req as any).user);

    const rows = await prisma.tbl_Worker_PersonalInfo.findMany({
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
      ? await prisma.tbl_Worker_EmployerInfo.findMany({
          where: { Worker_Id: { in: workerIds } },
          select: { Worker_Id: true, Employer_Name: true },
          take: 5000,
        })
      : [];
    const employerMap = new Map((employers ?? []).map((e) => [String(e.Worker_Id), (e.Employer_Name ?? "").toString()]));

    return res.json(
      (rows ?? []).map((r) => ({
        ...r,
        Current_Location: null,
        Company_Name: employerMap.get(String(r.Worker_Id)) ?? null,
      }))
    );
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

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true, Name: true, Passport_Number: true, Created_On: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));

    const permits = workerIds.length
      ? await prisma.tbl_Worker_PermitInsurance.findMany({
          where: { Worker_Id: { in: workerIds }, OR: [{ Permit_Expire_Date: null }, { Permit_Expire_Date: { gte: now, lt: end } }] },
          select: { Worker_Id: true, Permit_Expire_Date: true },
          take: 5000,
        })
      : [];

    const employers = workerIds.length
      ? await prisma.tbl_Worker_EmployerInfo.findMany({
          where: { Worker_Id: { in: workerIds } },
          select: { Worker_Id: true, Employer_Name: true },
          take: 5000,
        })
      : [];
    const employerMap = new Map((employers ?? []).map((e) => [String(e.Worker_Id), (e.Employer_Name ?? "").toString()]));

    const metaByWorkerId = new Map(
      (scopedWorkers ?? []).map((w) => [
        String(w.Worker_Id),
        {
          Worker_Id: w.Worker_Id,
          Name: w.Name,
          Passport_Number: w.Passport_Number,
          Created_On: w.Created_On,
        },
      ])
    );

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
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Roster/Shifts", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    await ensureRosterTablesExist();

    const entityId = ((req as any).user?.userKey ?? "").toString().trim();
    if (!entityId && roleId !== 1) return res.json([]);

    const rows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT TOP (500) id, entityId, name, startTime, endTime, breakMinutes FROM dbo.Tbl_Shift_Template ORDER BY id DESC"
        : "SELECT TOP (500) id, entityId, name, startTime, endTime, breakMinutes FROM dbo.Tbl_Shift_Template WHERE entityId = ? ORDER BY id DESC",
      ...(roleId === 1 ? [] : [entityId])
    )) as Array<any>;

    return res.json(
      (rows ?? []).map((r) => ({
        id: Number(r.id),
        name: (r.name ?? "").toString(),
        startTime: (r.startTime ?? "").toString(),
        endTime: (r.endTime ?? "").toString(),
        breakMinutes: Number(r.breakMinutes ?? 0),
      }))
    );
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Roster/Shifts", requireAuth, requireActivePlanForWrite, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    await ensureRosterTablesExist();

    const entityId = ((req as any).user?.userKey ?? "").toString().trim();
    if (!entityId && roleId !== 1) return res.status(400).json({ error: "Missing entity id" });

    const name = (req.body?.name ?? "").toString().trim();
    const startTime = (req.body?.startTime ?? "").toString().trim();
    const endTime = (req.body?.endTime ?? "").toString().trim();
    const breakMinutes = Number(req.body?.breakMinutes ?? 0);
    if (!name || !startTime || !endTime) return res.status(400).json({ error: "name, startTime, endTime are required" });

    const inserted = (await prisma.$queryRawUnsafe(
      "INSERT INTO dbo.Tbl_Shift_Template(entityId,name,startTime,endTime,breakMinutes) OUTPUT INSERTED.id VALUES(?,?,?,?,?);",
      entityId || "admin",
      name,
      startTime,
      endTime,
      Number.isFinite(breakMinutes) ? breakMinutes : 0
    )) as any[];

    const id = inserted?.[0]?.id != null ? Number(inserted[0].id) : NaN;
    return res.status(201).json({ id, name, startTime, endTime, breakMinutes: Number.isFinite(breakMinutes) ? breakMinutes : 0 });
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Roster/Assign", requireAuth, requireActivePlanForWrite, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    await ensureRosterTablesExist();

    const entityId = ((req as any).user?.userKey ?? "").toString().trim();
    if (!entityId && roleId !== 1) return res.status(400).json({ error: "Missing entity id" });

    const workerId = (req.body?.workerId ?? "").toString().trim();
    const shiftId = Number(req.body?.shiftId ?? 0);
    const dateRaw = req.body?.date;
    const date = dateRaw ? new Date(String(dateRaw)) : null;
    if (!workerId || !Number.isFinite(shiftId) || shiftId <= 0 || !date || isNaN(date.getTime())) {
      return res.status(400).json({ error: "workerId, date, shiftId are required" });
    }

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
    if (roleId !== 1 && !scopedWorker) return res.status(403).json({ error: "Forbidden" });

    const dStr = date.toISOString().slice(0, 10);
    await prisma.$executeRawUnsafe(
      "MERGE dbo.Tbl_Roster_Assignment AS t " +
        "USING (SELECT ? AS workerId, ? AS entityId, CAST(? AS DATE) AS [date], ? AS shiftId) AS s " +
        "ON (t.workerId=s.workerId AND t.[date]=s.[date]) " +
        "WHEN MATCHED THEN UPDATE SET shiftId=s.shiftId, entityId=s.entityId, updatedOn=GETDATE() " +
        "WHEN NOT MATCHED THEN INSERT(workerId,entityId,[date],shiftId) VALUES(s.workerId,s.entityId,s.[date],s.shiftId);",
      workerId,
      entityId || "admin",
      dStr,
      shiftId
    );

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Roster", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    await ensureRosterTablesExist();

    const rawFrom = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const rawTo = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const from = rawFrom ? new Date(String(rawFrom)) : null;
    const to = rawTo ? new Date(String(rawTo)) : null;
    if (!from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (roleId !== 1 && !workerIds.length) return res.json({ rows: [] });

    const rows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT TOP (5000) r.id, r.workerId, r.date, r.shiftId, s.name AS shiftName, s.startTime, s.endTime, s.breakMinutes FROM dbo.Tbl_Roster_Assignment r LEFT JOIN dbo.Tbl_Shift_Template s ON s.id=r.shiftId WHERE r.date >= CAST(? AS DATE) AND r.date <= CAST(? AS DATE) ORDER BY r.date DESC, r.id DESC"
        : `SELECT TOP (5000) r.id, r.workerId, r.date, r.shiftId, s.name AS shiftName, s.startTime, s.endTime, s.breakMinutes FROM dbo.Tbl_Roster_Assignment r LEFT JOIN dbo.Tbl_Shift_Template s ON s.id=r.shiftId WHERE r.date >= CAST(? AS DATE) AND r.date <= CAST(? AS DATE) AND r.workerId IN (${workerIds
            .map(() => "?")
            .join(",")}) ORDER BY r.date DESC, r.id DESC`,
      fromStr,
      toStr,
      ...(roleId === 1 ? [] : workerIds)
    )) as Array<any>;

    const parseTime = (t: string) => {
      const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(t ?? ""));
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
      return hh * 60 + mm;
    };

    return res.json({
      rows: (rows ?? []).map((r) => {
        const startMin = parseTime(r.startTime);
        const endMin = parseTime(r.endTime);
        const breakMin = Number(r.breakMinutes ?? 0);
        const minutes = startMin != null && endMin != null ? Math.max(0, endMin - startMin - (Number.isFinite(breakMin) ? breakMin : 0)) : 0;
        const hours = Math.round((minutes / 60) * 100) / 100;

        return {
          id: Number(r.id),
          workerId: (r.workerId ?? "").toString(),
          date: r.date ? new Date(r.date).toISOString() : null,
          shiftId: Number(r.shiftId),
          shiftName: (r.shiftName ?? "").toString(),
          shiftHours: hours,
        };
      }),
    });
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

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true, Name: true, Passport_Number: true, Created_On: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));

    const employer = workerIds.length
      ? await prisma.tbl_Worker_EmployerInfo.findMany({
          where: {
            Worker_Id: { in: workerIds },
            OR: [{ Contract_Expiry_Date: null }, { Contract_Expiry_Date: { gte: now, lt: end } }],
          },
          select: { Worker_Id: true, Employer_Name: true, Contract_Expiry_Date: true },
          take: 5000,
        })
      : [];

    const metaByWorkerId = new Map(
      (scopedWorkers ?? []).map((w) => [
        String(w.Worker_Id),
        {
          Worker_Id: w.Worker_Id,
          Name: w.Name,
          Passport_Number: w.Passport_Number,
          Created_On: w.Created_On,
        },
      ])
    );

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
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Panic/Active", requireAuth, requireAlertViewer, async (_req, res, next) => {
  try {
    const roleId = Number((_req as any).user?.roleId ?? 0);
    const scopeWhere = await buildWorkerScopeWhere((_req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));

    const rows = await prisma.tbl_ProbSol.findMany({
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
    const scopeWhere = await buildWorkerScopeWhere((_req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));

    const rows = await prisma.tbl_ProbSol.findMany({
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

app.get("/Api/Incidents", requireAuth, requireAlertViewer, async (_req, res, next) => {
  try {
    const scopeWhere = await buildWorkerScopeWhere((_req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));

    const roleId = Number((_req as any).user?.roleId ?? 0);

    const rows = await prisma.tbl_ProbSol.findMany({
      where: {
        NOT: { Type: "Panic" },
        ...(allowedWorkerIds.size ? { worker_ID: { in: Array.from(allowedWorkerIds) } } : {}),
        ...(roleId !== 1 ? { ProbStatus: { not: "Pending" } } : {}),
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

app.get("/Api/Incidents/:id", requireAuth, requireAlertViewer, async (req, res, next) => {
  const id = Number(req.params?.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  try {
    const roleId = Number((req as any).user?.roleId ?? 0);

    const row = await prisma.tbl_ProbSol.findFirst({ where: { ID: id } });
    if (!row) return res.status(404).json({ error: "Not found" });

    if (roleId !== 1 && ((row as any)?.ProbStatus ?? "").toString() === "Pending") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere((req as any).user);
      const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
        where: scopeWhere,
        select: { Worker_Id: true },
        take: 5000,
      });
      const allowed = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));
      const workerId = (row as any)?.worker_ID != null ? String((row as any).worker_ID) : "";
      if (!workerId || !allowed.has(workerId)) return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(row);
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Alerts/Recent", requireAuth, requireAlertViewer, async (req, res, next) => {
  try {
    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limit = Math.min(200, Math.max(1, Number(rawLimit ?? 50)));

    const roleId = Number((req as any).user?.roleId ?? 0);
    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const allowedWorkerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));

    if (roleId !== 1 && !allowedWorkerIds.size) {
      return res.json({ rows: [] });
    }

    const incidents = await prisma.tbl_ProbSol.findMany({
      where: {
        ...(roleId !== 1 && allowedWorkerIds.size ? { worker_ID: { in: Array.from(allowedWorkerIds) } } : {}),
        ...(roleId !== 1 ? { ProbStatus: { not: "Pending" } } : {}),
      },
      select: {
        ID: true,
        Type: true,
        Title: true,
        Description: true,
        ProbStatus: true,
        Updated_On: true,
        worker_ID: true,
        Company_Name: true,
      },
      orderBy: [{ Updated_On: "desc" }, { ID: "desc" }],
      take: limit,
    });

    const leave = await prisma.tbl_Leave.findMany({
      where: {
        status: { in: ["Approved", "Rejected"] },
        ...(roleId !== 1 && allowedWorkerIds.size ? { workerId: { in: Array.from(allowedWorkerIds) } } : {}),
      },
      select: { id: true, workerId: true, leaveType: true, status: true, startDate: true, endDate: true },
      orderBy: [{ id: "desc" }],
      take: Math.min(100, limit),
    });

    const payroll = await prisma.tbl_Payroll.findMany({
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
        status: x.ProbStatus != null ? String(x.ProbStatus) : null,
        createdAt: x.Updated_On ? new Date(x.Updated_On as any).toISOString() : null,
      })),
      ...(leave ?? []).map((x) => ({
        id: x.id,
        kind: "new_trigger",
        title: `Leave ${String(x.status ?? "")}`,
        description: `Leave ${String(x.status ?? "").toLowerCase()} (${String(x.leaveType ?? "")}) for worker ${String(x.workerId ?? "")}`,
        workerId: x.workerId ?? null,
        companyName: null,
        createdAt: x.endDate ? new Date(x.endDate as any).toISOString() : null,
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
  } catch (e) {
    return next(e);
  }
});

app.delete("/Api/Incidents/:id", requireAuth, checkRole([1]), async (req, res, next) => {
  const id = Number(req.params?.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  try {
    await prisma.tbl_ProbSol.delete({ where: { ID: id } });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Attendance", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    await ensureRosterTablesExist();

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (!workerIds.length) return res.json([]);

    const rows = await prisma.tbl_Attendance.findMany({
      where: { workerId: { in: workerIds } },
      orderBy: [{ id: "desc" }],
      take: 1000,
    });

    const attendanceRows = (rows ?? []) as Array<any>;
    const keyPairs: Array<{ workerId: string; dateStr: string }> = [];
    for (const r of attendanceRows) {
      const workerId = (r?.workerId ?? "").toString();
      const d = r?.checkIn ? new Date(r.checkIn) : null;
      if (!workerId || !d || isNaN(d.getTime())) continue;
      keyPairs.push({ workerId, dateStr: d.toISOString().slice(0, 10) });
    }

    const uniqueKey = new Set(keyPairs.map((k) => `${k.workerId}__${k.dateStr}`));
    const pairs = Array.from(uniqueKey).map((x) => {
      const [workerId, dateStr] = x.split("__");
      return { workerId, dateStr };
    });

    const shiftByWorkerDay = new Map<string, { startTime: string | null; endTime: string | null }>();
    if (pairs.length) {
      const whereParts: string[] = [];
      const params: any[] = [];
      let p = 1;
      for (const pair of pairs) {
        whereParts.push(`(r.workerId=@P${p} AND r.[date]=CAST(@P${p + 1} AS DATE))`);
        params.push(pair.workerId, pair.dateStr);
        p += 2;
      }

      const q =
        "SELECT TOP (50000) r.workerId, r.[date] as d, s.startTime, s.endTime " +
        "FROM dbo.Tbl_Roster_Assignment r LEFT JOIN dbo.Tbl_Shift_Template s ON s.id=r.shiftId " +
        (whereParts.length ? `WHERE ${whereParts.join(" OR ")}` : "");

      const roster = (await prisma.$queryRawUnsafe(q, ...params)) as any[];
      for (const rr of roster ?? []) {
        const workerId = (rr.workerId ?? "").toString();
        const d = rr.d ? new Date(rr.d) : null;
        const dateStr = d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
        if (!workerId || !dateStr) continue;
        shiftByWorkerDay.set(`${workerId}__${dateStr}`, {
          startTime: rr.startTime != null ? String(rr.startTime) : null,
          endTime: rr.endTime != null ? String(rr.endTime) : null,
        });
      }
    }

    const graceMinutes = 5;
    const parseTime = (t: string | null): { hh: number; mm: number } | null => {
      if (!t) return null;
      const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
      return { hh, mm };
    };

    const withFlags = attendanceRows.map((r) => {
      const checkIn = r?.checkIn ? new Date(r.checkIn) : null;
      const checkOut = r?.checkOut ? new Date(r.checkOut) : null;
      const dateStr = checkIn && !isNaN(checkIn.getTime()) ? checkIn.toISOString().slice(0, 10) : "";
      const shift = dateStr ? shiftByWorkerDay.get(`${String(r.workerId)}__${dateStr}`) : undefined;
      const start = parseTime(shift?.startTime ?? null);
      const end = parseTime(shift?.endTime ?? null);

      let plannedStart: Date | null = null;
      let plannedEnd: Date | null = null;
      if (dateStr && start) {
        plannedStart = new Date(`${dateStr}T00:00:00.000Z`);
        plannedStart.setUTCHours(start.hh, start.mm, 0, 0);
      }
      if (dateStr && end) {
        plannedEnd = new Date(`${dateStr}T00:00:00.000Z`);
        plannedEnd.setUTCHours(end.hh, end.mm, 0, 0);
      }

      const workedHours =
        checkIn && checkOut && !isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())
          ? Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 36e5)
          : 0;

      const lateMinutes =
        plannedStart && checkIn
          ? Math.max(0, Math.round((checkIn.getTime() - plannedStart.getTime()) / 60000) - graceMinutes)
          : 0;

      const earlyLeaveMinutes =
        plannedEnd && checkOut
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
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Reports/Summary", requireAuth, checkRole([1, 3, 4]), async (req, res, next) => {
  try {
    await ensureRosterTablesExist();
    await ensureHrmsRequestTablesExist();

    const roleId = Number((req as any).user?.roleId ?? 0);
    const rawFrom = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const rawTo = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const from = rawFrom ? new Date(String(rawFrom)) : null;
    const to = rawTo ? new Date(String(rawTo)) : null;
    if (!from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) return res.status(400).json({ error: "from and to are required" });

    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: roleId === 1 ? {} : scopeWhere,
      select: { Worker_Id: true, Name: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (roleId !== 1 && !workerIds.length) return res.json({ from: fromStr, to: toStr, rows: [] });

    const nameById = new Map<string, string | null>();
    for (const w of scopedWorkers ?? []) {
      const id = (w.Worker_Id ?? "").toString();
      if (id) nameById.set(id, w.Name ?? null);
    }

    const attendance = await prisma.tbl_Attendance.findMany({
      where: {
        workerId: { in: workerIds },
        checkIn: { gte: from, lte: to },
      },
      select: { id: true, workerId: true, checkIn: true, checkOut: true },
      take: 50000,
    });

    const byWorker = new Map<string, any>();
    const ensureRow = (workerId: string) => {
      if (!byWorker.has(workerId)) {
        byWorker.set(workerId, {
          workerId,
          name: nameById.get(workerId) ?? null,
          daysPresent: 0,
          workedHours: 0,
          lateCount: 0,
          earlyLeaveCount: 0,
          overtimeRequestedHours: 0,
          overtimeApprovedHours: 0,
          expenseClaimed: 0,
          expenseApproved: 0,
        });
      }
      return byWorker.get(workerId);
    };

    const dayKeySet = new Set<string>();
    for (const a of attendance ?? []) {
      const workerId = (a.workerId ?? "").toString();
      if (!workerId) continue;
      const checkIn = a.checkIn ? new Date(a.checkIn) : null;
      const checkOut = a.checkOut ? new Date(a.checkOut) : null;
      if (!checkIn || isNaN(checkIn.getTime())) continue;
      const dayKey = `${workerId}__${checkIn.toISOString().slice(0, 10)}`;
      const row = ensureRow(workerId);
      if (!dayKeySet.has(dayKey)) {
        dayKeySet.add(dayKey);
        row.daysPresent += 1;
      }
      if (checkOut && !isNaN(checkOut.getTime())) {
        row.workedHours += Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 36e5);
      }
    }

    // Late/early count based on roster shifts where available
    const pairs = Array.from(dayKeySet).map((k) => {
      const [workerId, dateStr] = k.split("__");
      return { workerId, dateStr };
    });
    const shiftByWorkerDay = new Map<string, { startTime: string | null; endTime: string | null }>();
    if (pairs.length) {
      const whereParts: string[] = [];
      const params: any[] = [];
      let p = 1;
      for (const pair of pairs) {
        whereParts.push(`(r.workerId=@P${p} AND r.[date]=CAST(@P${p + 1} AS DATE))`);
        params.push(pair.workerId, pair.dateStr);
        p += 2;
      }
      const q =
        "SELECT TOP (50000) r.workerId, r.[date] as d, s.startTime, s.endTime " +
        "FROM dbo.Tbl_Roster_Assignment r LEFT JOIN dbo.Tbl_Shift_Template s ON s.id=r.shiftId " +
        `WHERE ${whereParts.join(" OR ")}`;
      const roster = (await prisma.$queryRawUnsafe(q, ...params)) as any[];
      for (const rr of roster ?? []) {
        const workerId = (rr.workerId ?? "").toString();
        const d = rr.d ? new Date(rr.d) : null;
        const dateStr = d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
        if (!workerId || !dateStr) continue;
        shiftByWorkerDay.set(`${workerId}__${dateStr}`, {
          startTime: rr.startTime != null ? String(rr.startTime) : null,
          endTime: rr.endTime != null ? String(rr.endTime) : null,
        });
      }
    }

    const parseTime = (t: string | null): { hh: number; mm: number } | null => {
      if (!t) return null;
      const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
      return { hh, mm };
    };
    const graceMinutes = 5;

    // Build lookup for attendance by worker/day to compare with shift
    const attByWorkerDay = new Map<string, { checkIn: Date | null; checkOut: Date | null }>();
    for (const a of attendance ?? []) {
      const workerId = (a.workerId ?? "").toString();
      const checkIn = a.checkIn ? new Date(a.checkIn) : null;
      if (!workerId || !checkIn || isNaN(checkIn.getTime())) continue;
      const dateStr = checkIn.toISOString().slice(0, 10);
      const k = `${workerId}__${dateStr}`;
      const existing = attByWorkerDay.get(k);
      const checkOut = a.checkOut ? new Date(a.checkOut) : null;
      if (!existing) {
        attByWorkerDay.set(k, { checkIn, checkOut: checkOut && !isNaN(checkOut.getTime()) ? checkOut : null });
      } else {
        // keep earliest checkIn and latest checkOut for the day
        if (checkIn && (!existing.checkIn || checkIn.getTime() < existing.checkIn.getTime())) existing.checkIn = checkIn;
        if (checkOut && !isNaN(checkOut.getTime())) {
          if (!existing.checkOut || checkOut.getTime() > existing.checkOut.getTime()) existing.checkOut = checkOut;
        }
      }
    }

    for (const [k, att] of attByWorkerDay.entries()) {
      const [workerId, dateStr] = k.split("__");
      const shift = shiftByWorkerDay.get(k);
      if (!shift) continue;
      const start = parseTime(shift.startTime);
      const end = parseTime(shift.endTime);
      if (!start || !end) continue;
      const plannedStart = new Date(`${dateStr}T00:00:00.000Z`);
      plannedStart.setUTCHours(start.hh, start.mm, 0, 0);
      const plannedEnd = new Date(`${dateStr}T00:00:00.000Z`);
      plannedEnd.setUTCHours(end.hh, end.mm, 0, 0);
      const row = ensureRow(workerId);
      if (att.checkIn) {
        const lateMinutes = Math.max(0, Math.round((att.checkIn.getTime() - plannedStart.getTime()) / 60000) - graceMinutes);
        if (lateMinutes > 0) row.lateCount += 1;
      }
      if (att.checkOut) {
        const earlyMinutes = Math.max(0, Math.round((plannedEnd.getTime() - att.checkOut.getTime()) / 60000) - graceMinutes);
        if (earlyMinutes > 0) row.earlyLeaveCount += 1;
      }
    }

    // Overtime aggregates
    const otRows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT workerId, SUM(hours) as totalHours, SUM(CASE WHEN status='Approved' THEN hours ELSE 0 END) as approvedHours FROM dbo.Tbl_HRMS_Overtime_Request WHERE workDate >= CAST(@P1 AS DATE) AND workDate <= CAST(@P2 AS DATE) GROUP BY workerId"
        : `SELECT workerId, SUM(hours) as totalHours, SUM(CASE WHEN status='Approved' THEN hours ELSE 0 END) as approvedHours FROM dbo.Tbl_HRMS_Overtime_Request WHERE workDate >= CAST(@P1 AS DATE) AND workDate <= CAST(@P2 AS DATE) AND workerId IN (${workerIds
            .map((_, i) => `@P${i + 3}`)
            .join(",")}) GROUP BY workerId`,
      fromStr,
      toStr,
      ...(roleId === 1 ? [] : workerIds)
    )) as any[];
    for (const r of otRows ?? []) {
      const workerId = (r.workerId ?? "").toString();
      if (!workerId) continue;
      const row = ensureRow(workerId);
      row.overtimeRequestedHours += Number(r.totalHours ?? 0) || 0;
      row.overtimeApprovedHours += Number(r.approvedHours ?? 0) || 0;
    }

    // Expense aggregates
    const expRows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT workerId, SUM(amount) as totalAmount, SUM(CASE WHEN status='Approved' THEN amount ELSE 0 END) as approvedAmount FROM dbo.Tbl_HRMS_Expense_Claim WHERE claimDate >= CAST(@P1 AS DATE) AND claimDate <= CAST(@P2 AS DATE) GROUP BY workerId"
        : `SELECT workerId, SUM(amount) as totalAmount, SUM(CASE WHEN status='Approved' THEN amount ELSE 0 END) as approvedAmount FROM dbo.Tbl_HRMS_Expense_Claim WHERE claimDate >= CAST(@P1 AS DATE) AND claimDate <= CAST(@P2 AS DATE) AND workerId IN (${workerIds
            .map((_, i) => `@P${i + 3}`)
            .join(",")}) GROUP BY workerId`,
      fromStr,
      toStr,
      ...(roleId === 1 ? [] : workerIds)
    )) as any[];
    for (const r of expRows ?? []) {
      const workerId = (r.workerId ?? "").toString();
      if (!workerId) continue;
      const row = ensureRow(workerId);
      row.expenseClaimed += Number(r.totalAmount ?? 0) || 0;
      row.expenseApproved += Number(r.approvedAmount ?? 0) || 0;
    }

    const out = Array.from(byWorker.values()).map((r) => ({
      ...r,
      workedHours: Math.round(Number(r.workedHours ?? 0) * 100) / 100,
      overtimeRequestedHours: Math.round(Number(r.overtimeRequestedHours ?? 0) * 100) / 100,
      overtimeApprovedHours: Math.round(Number(r.overtimeApprovedHours ?? 0) * 100) / 100,
      expenseClaimed: Math.round(Number(r.expenseClaimed ?? 0) * 100) / 100,
      expenseApproved: Math.round(Number(r.expenseApproved ?? 0) * 100) / 100,
    }));

    return res.json({ from: fromStr, to: toStr, rows: out });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Attendance/me", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rows = await prisma.tbl_Attendance.findMany({
      where: { workerId: userKey },
      orderBy: [{ id: "desc" }],
      take: 200,
    });
    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Attendance/ClockIn", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const lat = req.body?.lat != null ? Number(req.body.lat) : null;
    const lng = req.body?.lng != null ? Number(req.body.lng) : null;
    const photoUrl = (req.body?.photoUrl ?? null) != null ? String(req.body.photoUrl) : null;

    const created = await prisma.tbl_Attendance.create({
      data: {
        workerId: userKey,
        checkIn: new Date(),
        checkOut: null,
        lat: lat != null && Number.isFinite(lat) ? lat : null,
        lng: lng != null && Number.isFinite(lng) ? lng : null,
        photoUrl,
      } as any,
    });

    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Attendance/ClockOut", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const open = await prisma.tbl_Attendance.findFirst({
      where: { workerId: userKey, checkOut: null },
      orderBy: [{ id: "desc" }],
    });

    if (!open) return res.status(409).json({ error: "No open attendance record" });

    const updated = await prisma.tbl_Attendance.update({
      where: { id: open.id },
      data: { checkOut: new Date() },
    });
    return res.json(updated);
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Overtime/Request", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rawDate = (req.body?.workDate ?? req.body?.date ?? "").toString();
    const workDate = rawDate ? new Date(String(rawDate)) : null;
    const hours = Number(req.body?.hours ?? 0);
    const reason = (req.body?.reason ?? "").toString();
    if (!workDate || isNaN(workDate.getTime())) return res.status(400).json({ error: "workDate is required" });
    if (!Number.isFinite(hours) || hours <= 0) return res.status(400).json({ error: "hours is required" });

    const dStr = workDate.toISOString().slice(0, 10);
    const rows = (await prisma.$queryRawUnsafe(
      "INSERT INTO dbo.Tbl_HRMS_Overtime_Request(workerId, workDate, hours, reason) OUTPUT INSERTED.id, INSERTED.workerId, INSERTED.workDate, INSERTED.hours, INSERTED.reason, INSERTED.status, INSERTED.createdOn VALUES (@P1, CAST(@P2 AS DATE), @P3, @P4)",
      userKey,
      dStr,
      hours,
      reason
    )) as any[];

    return res.json((rows ?? [])[0] ?? null);
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Overtime", requireAuth, checkRole([1, 3, 4]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const roleId = Number((req as any).user?.roleId ?? 0);
    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: roleId === 1 ? {} : scopeWhere,
      select: { Worker_Id: true, Name: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (roleId !== 1 && !workerIds.length) return res.json([]);

    const limit = Math.min(500, Math.max(1, Number((Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit) ?? 200)));

    const rows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT TOP (@P1) id, workerId, workDate, hours, reason, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Overtime_Request ORDER BY id DESC"
        : `SELECT TOP (@P1) id, workerId, workDate, hours, reason, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Overtime_Request WHERE workerId IN (${workerIds
            .map((_, i) => `@P${i + 2}`)
            .join(",")}) ORDER BY id DESC`,
      limit,
      ...(roleId === 1 ? [] : workerIds)
    )) as any[];

    const nameById = new Map<string, string | null>();
    for (const w of scopedWorkers ?? []) {
      const id = (w.Worker_Id ?? "").toString();
      if (id) nameById.set(id, w.Name ?? null);
    }

    const ids = Array.from(new Set((rows ?? []).map((r) => Number(r?.id ?? 0)).filter((x) => Number.isFinite(x) && x > 0)));
    let attByClaim = new Map<number, any[]>();
    if (ids.length) {
      const attRows = (await prisma.$queryRawUnsafe(
        `SELECT id, claimId, filePath, originalName, mimeType, fileSize, createdOn FROM dbo.Tbl_HRMS_Expense_Attachment WHERE claimId IN (${ids
          .map((_, i) => `@P${i + 1}`)
          .join(",")}) ORDER BY id DESC`,
        ...ids
      )) as any[];
      attByClaim = new Map<number, any[]>();
      for (const a of attRows ?? []) {
        const claimId = Number(a?.claimId ?? 0);
        if (!attByClaim.has(claimId)) attByClaim.set(claimId, []);
        attByClaim.get(claimId)!.push({
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

    return res.json(
      (rows ?? []).map((r) => ({
        ...r,
        workerName: nameById.get((r.workerId ?? "").toString()) ?? null,
        attachments: attByClaim.get(Number(r?.id ?? 0)) ?? [],
      }))
    );
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Overtime/Decision", requireAuth, checkRole([1, 3, 4]), requireActivePlanForWrite, async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const id = Number(req.body?.id ?? 0);
    const status = (req.body?.status ?? "").toString();
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id is required" });
    if (status !== "Approved" && status !== "Rejected") return res.status(400).json({ error: "Invalid status" });

    const row = (await prisma.$queryRawUnsafe(
      "SELECT TOP (1) id, workerId FROM dbo.Tbl_HRMS_Overtime_Request WHERE id=@P1",
      id
    )) as any[];
    const workerId = (row?.[0]?.workerId ?? "").toString();
    if (!workerId) return res.status(404).json({ error: "Not found" });

    const roleId = Number((req as any).user?.roleId ?? 0);
    if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere((req as any).user);
      const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
      if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
    }

    const decisionBy = ((req as any).user?.userKey ?? "").toString().trim() || "approver";
    await prisma.$executeRawUnsafe(
      "UPDATE dbo.Tbl_HRMS_Overtime_Request SET status=@P1, decisionBy=@P2, decisionOn=GETDATE() WHERE id=@P3",
      status,
      decisionBy,
      id
    );

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Expenses/Claim", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rawDate = (req.body?.claimDate ?? req.body?.date ?? "").toString();
    const claimDate = rawDate ? new Date(String(rawDate)) : null;
    const amount = Number(req.body?.amount ?? 0);
    const category = (req.body?.category ?? "").toString();
    const description = (req.body?.description ?? "").toString();
    if (!claimDate || isNaN(claimDate.getTime())) return res.status(400).json({ error: "claimDate is required" });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "amount is required" });

    const dStr = claimDate.toISOString().slice(0, 10);
    const rows = (await prisma.$queryRawUnsafe(
      "INSERT INTO dbo.Tbl_HRMS_Expense_Claim(workerId, claimDate, amount, category, description) OUTPUT INSERTED.id, INSERTED.workerId, INSERTED.claimDate, INSERTED.amount, INSERTED.category, INSERTED.description, INSERTED.status, INSERTED.createdOn VALUES (@P1, CAST(@P2 AS DATE), @P3, @P4, @P5)",
      userKey,
      dStr,
      amount,
      category,
      description
    )) as any[];

    return res.json((rows ?? [])[0] ?? null);
  } catch (e) {
    return next(e);
  }
});

app.post(
  "/Api/HRMS/Expenses/:id/Attachments",
  requireAuth,
  checkRole([2]),
  upload.array("files", 5),
  async (req, res, next) => {
    try {
      await ensureHrmsRequestTablesExist();

      const id = Number(req.params?.id ?? 0);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid claim id" });

      const userKey = ((req as any).user?.userKey ?? "").toString().trim();
      if (!userKey) return res.status(400).json({ error: "Missing worker id" });

      const claim = (await prisma.$queryRawUnsafe(
        "SELECT TOP (1) id, workerId FROM dbo.Tbl_HRMS_Expense_Claim WHERE id=@P1",
        id
      )) as any[];
      const claimWorkerId = (claim?.[0]?.workerId ?? "").toString();
      if (!claimWorkerId) return res.status(404).json({ error: "Claim not found" });
      if (claimWorkerId !== userKey) return res.status(403).json({ error: "Forbidden" });

      const files = ((req as any).files ?? []) as Array<{ filename?: string; originalname?: string; mimetype?: string; size?: number }>;
      if (!files.length) return res.status(400).json({ error: "No files uploaded" });

      const inserted: any[] = [];
      for (const f of files) {
        if (!f?.filename) continue;
        const filePath = `/uploads/${f.filename}`;
        const rows = (await prisma.$queryRawUnsafe(
          "INSERT INTO dbo.Tbl_HRMS_Expense_Attachment(claimId, filePath, originalName, mimeType, fileSize) OUTPUT INSERTED.id, INSERTED.claimId, INSERTED.filePath, INSERTED.originalName, INSERTED.mimeType, INSERTED.fileSize, INSERTED.createdOn VALUES (@P1, @P2, @P3, @P4, @P5)",
          id,
          filePath,
          (f.originalname ?? "").toString(),
          (f.mimetype ?? "").toString(),
          Number(f.size ?? 0)
        )) as any[];
        if (rows?.[0]) inserted.push(rows[0]);
      }

      return res.json({ ok: true, attachments: inserted });
    } catch (e) {
      return next(e);
    }
  }
);

app.get("/Api/HRMS/Expenses/me", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const rows = (await prisma.$queryRawUnsafe(
      "SELECT TOP (1000) id, workerId, claimDate, amount, category, description, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Expense_Claim WHERE workerId=@P1 ORDER BY id DESC",
      userKey
    )) as any[];

    const ids = Array.from(new Set((rows ?? []).map((r) => Number(r?.id ?? 0)).filter((x) => Number.isFinite(x) && x > 0)));
    let attByClaim = new Map<number, any[]>();
    if (ids.length) {
      const attRows = (await prisma.$queryRawUnsafe(
        `SELECT id, claimId, filePath, originalName, mimeType, fileSize, createdOn FROM dbo.Tbl_HRMS_Expense_Attachment WHERE claimId IN (${ids
          .map((_, i) => `@P${i + 1}`)
          .join(",")}) ORDER BY id DESC`,
        ...ids
      )) as any[];
      attByClaim = new Map<number, any[]>();
      for (const a of attRows ?? []) {
        const claimId = Number(a?.claimId ?? 0);
        if (!attByClaim.has(claimId)) attByClaim.set(claimId, []);
        attByClaim.get(claimId)!.push({
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
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Expenses", requireAuth, checkRole([1, 3, 4]), async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const roleId = Number((req as any).user?.roleId ?? 0);
    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: roleId === 1 ? {} : scopeWhere,
      select: { Worker_Id: true, Name: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (roleId !== 1 && !workerIds.length) return res.json([]);

    const limit = Math.min(500, Math.max(1, Number((Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit) ?? 200)));

    const rows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? "SELECT TOP (@P1) id, workerId, claimDate, amount, category, description, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Expense_Claim ORDER BY id DESC"
        : `SELECT TOP (@P1) id, workerId, claimDate, amount, category, description, status, createdOn, decisionBy, decisionOn FROM dbo.Tbl_HRMS_Expense_Claim WHERE workerId IN (${workerIds
            .map((_, i) => `@P${i + 2}`)
            .join(",")}) ORDER BY id DESC`,
      limit,
      ...(roleId === 1 ? [] : workerIds)
    )) as any[];

    const nameById = new Map<string, string | null>();
    for (const w of scopedWorkers ?? []) {
      const id = (w.Worker_Id ?? "").toString();
      if (id) nameById.set(id, w.Name ?? null);
    }

    return res.json(
      (rows ?? []).map((r) => ({
        ...r,
        workerName: nameById.get((r.workerId ?? "").toString()) ?? null,
      }))
    );
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Expenses/Decision", requireAuth, checkRole([1, 3, 4]), requireActivePlanForWrite, async (req, res, next) => {
  try {
    await ensureHrmsRequestTablesExist();

    const id = Number(req.body?.id ?? 0);
    const status = (req.body?.status ?? "").toString();
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id is required" });
    if (status !== "Approved" && status !== "Rejected") return res.status(400).json({ error: "Invalid status" });

    const row = (await prisma.$queryRawUnsafe(
      "SELECT TOP (1) id, workerId FROM dbo.Tbl_HRMS_Expense_Claim WHERE id=@P1",
      id
    )) as any[];
    const workerId = (row?.[0]?.workerId ?? "").toString();
    if (!workerId) return res.status(404).json({ error: "Not found" });

    const roleId = Number((req as any).user?.roleId ?? 0);
    if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere((req as any).user);
      const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
      if (!scopedWorker) return res.status(403).json({ error: "Forbidden" });
    }

    const decisionBy = ((req as any).user?.userKey ?? "").toString().trim() || "approver";
    await prisma.$executeRawUnsafe(
      "UPDATE dbo.Tbl_HRMS_Expense_Claim SET status=@P1, decisionBy=@P2, decisionOn=GETDATE() WHERE id=@P3",
      status,
      decisionBy,
      id
    );

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Leave", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);

    if (roleId === 2) {
      const userKey = ((req as any).user?.userKey ?? "").toString().trim();
      const rows = await prisma.tbl_Leave.findMany({
        where: { workerId: userKey },
        orderBy: [{ id: "desc" }],
        take: 500,
      });
      return res.json(rows ?? []);
    }

    if (![1, 3, 4].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (!workerIds.length) return res.json([]);

    const rows = await prisma.tbl_Leave.findMany({
      where: { workerId: { in: workerIds } },
      orderBy: [{ id: "desc" }],
      take: 1000,
    });
    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Leave/Apply", requireAuth, checkRole([2]), async (req, res, next) => {
  try {
    const userKey = ((req as any).user?.userKey ?? "").toString().trim();
    if (!userKey) return res.status(400).json({ error: "Missing worker id" });

    const leaveType = (req.body?.leaveType ?? "").toString().trim();
    const startDateRaw = req.body?.startDate;
    const endDateRaw = req.body?.endDate;
    const startDate = startDateRaw ? new Date(String(startDateRaw)) : null;
    const endDate = endDateRaw ? new Date(String(endDateRaw)) : null;
    if (!leaveType || !startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "leaveType, startDate, endDate are required" });
    }

    const created = await prisma.tbl_Leave.create({
      data: {
        workerId: userKey,
        leaveType,
        startDate,
        endDate,
        status: "Pending",
      },
    });
    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Leave/Decision", requireAuth, requireActivePlanForWrite, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    const id = Number(req.body?.id ?? 0);
    const decision = (req.body?.status ?? "").toString().trim();
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id is required" });
    if (decision !== "Approved" && decision !== "Rejected") return res.status(400).json({ error: "Invalid status" });

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean));

    const row = await prisma.tbl_Leave.findFirst({ where: { id } });
    if (!row) return res.status(404).json({ error: "Not found" });
    if (roleId !== 1 && !workerIds.has((row.workerId ?? "").toString())) return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.tbl_Leave.update({ where: { id }, data: { status: decision } });

    try {
      io.to("authorities").emit("new_trigger", {
        id: updated.id,
        title: `Leave ${decision}`,
        description: `Leave request ${decision} for worker ${String(updated.workerId ?? "")}`,
        workerId: updated.workerId ?? null,
        companyName: null,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // ignore emit errors
    }

    return res.json(updated);
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Payroll", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (!workerIds.length) return res.json([]);

    const rows = await prisma.tbl_Payroll.findMany({
      where: { workerId: { in: workerIds } },
      orderBy: [{ id: "desc" }],
      take: 1000,
    });
    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/HRMS/Payroll/Upload", requireAuth, requireActivePlanForWrite, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    const workerId = (req.body?.workerId ?? "").toString().trim();
    const month = Number(req.body?.month ?? 0);
    const year = Number(req.body?.year ?? 0);
    const amount = Number(req.body?.amount ?? 0);
    const voucherUrl = (req.body?.voucherUrl ?? "").toString().trim();
    const isPaid = req.body?.isPaid != null ? Boolean(req.body.isPaid) : false;
    if (!workerId || !Number.isFinite(month) || !Number.isFinite(year)) {
      return res.status(400).json({ error: "workerId, month, year are required" });
    }

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorker = await prisma.tbl_Worker_PersonalInfo.findFirst({ where: { ...scopeWhere, Worker_Id: workerId } });
    if (roleId !== 1 && !scopedWorker) return res.status(403).json({ error: "Forbidden" });

    const created = await prisma.tbl_Payroll.create({
      data: {
        workerId,
        month,
        year,
        amount: Number.isFinite(amount) ? amount : 0,
        voucherUrl: voucherUrl || null,
        isPaid,
      } as any,
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
    } catch {
      // ignore emit errors
    }

    return res.status(201).json(created);
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/HRMS/Contracts/Expiring", requireAuth, async (req, res, next) => {
  try {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (![1, 3, 4, 5, 6, 7].includes(roleId)) return res.status(403).json({ error: "Forbidden" });

    const rawDays = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
    const days = Math.min(3650, Math.max(1, Number(rawDays ?? 90)));
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);

    const scopeWhere = await buildWorkerScopeWhere((req as any).user);
    const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
      where: scopeWhere,
      select: { Worker_Id: true },
      take: 5000,
    });
    const workerIds = Array.from(new Set((scopedWorkers ?? []).map((w) => (w.Worker_Id ?? "").toString()).filter(Boolean)));
    if (!workerIds.length) return res.json({ windowDays: days, rows: [] });

    const rows = await prisma.tbl_Worker_EmployerInfo.findMany({
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
  } catch (e) {
    return next(e);
  }
});

app.get("/Api/Workers/List", requireAuth, requireReportsAccess, async (_req, res, next) => {
  try {
    const where = await buildWorkerScopeWhere((_req as any).user);
    const rows = await prisma.tbl_Worker_PersonalInfo.findMany({
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
    const roleId = Number((req as any).user?.roleId ?? 0);
    const rawStatus = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
    const rawType = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
    const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;

    const status = (rawStatus ?? "").toString().trim().toLowerCase();
    const type = (rawType ?? "").toString().trim().toLowerCase();
    const q = (rawQ ?? "").toString().trim();
    const limit = Math.min(1000, Math.max(1, Number(rawLimit ?? 200)));

    const wherePrisma: any = {};

    if (roleId !== 1) {
      const scopeWhere = await buildWorkerScopeWhere((req as any).user);
      const scopedWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
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
  const workerId = Number((req as any).user?.userId ?? 0);
  if (!Number.isFinite(workerId) || workerId <= 0) return res.status(401).json({ error: "Unauthorized" });

  try {
    await ensureChatTablesExist();
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
    await ensureChatTablesExist();

    const workerId = Number((req as any).user?.userId ?? 0);
    if (!Number.isFinite(workerId) || workerId <= 0) return res.status(401).json({ error: "Unauthorized" });
    const ok = await assertChatSessionOwner(chatSessionId, workerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

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
    await ensureChatTablesExist();

    const workerId = Number((req as any).user?.userId ?? 0);
    if (!Number.isFinite(workerId) || workerId <= 0) return res.status(401).json({ error: "Unauthorized" });
    const ok = await assertChatSessionOwner(chatSessionId, workerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

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
  const workerId = Number((req as any).user?.userId ?? 0);
  const reason = (req.body?.Reason ?? req.body?.reason ?? "").toString();

  if (!Number.isFinite(chatSessionId) || chatSessionId <= 0) {
    return res.status(400).json({ error: "ChatSessionId is required" });
  }
  if (!Number.isFinite(workerId) || workerId <= 0) return res.status(401).json({ error: "Unauthorized" });

  try {
    await ensureChatTablesExist();
    const ok = await assertChatSessionOwner(chatSessionId, workerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

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
    await ensureChatTablesExist();
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
  const workerId = Number((req as any).user?.userId ?? 0);
  const userText = (req.body?.Message ?? req.body?.message ?? "").toString();

  if (!Number.isFinite(chatSessionId) || chatSessionId <= 0) {
    return res.status(400).json({ error: "ChatSessionId is required" });
  }
  if (!Number.isFinite(workerId) || workerId <= 0) return res.status(401).json({ error: "Unauthorized" });
  if (!userText.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  try {
    await ensureChatTablesExist();
    const ok = await assertChatSessionOwner(chatSessionId, workerId);
    if (!ok) return res.status(403).json({ error: "Forbidden" });

    await prisma.$queryRawUnsafe(
      "INSERT INTO [dbo].[ChatMessages]([ChatSessionId],[SenderType],[Message]) VALUES(@p1,@p2,@p3);",
      chatSessionId,
      "User",
      userText
    );

    const history = (await prisma.$queryRawUnsafe(
      "SELECT TOP (16) [SenderType],[Message] FROM [dbo].[ChatMessages] WHERE [ChatSessionId]=@p1 ORDER BY [ChatMessageId] DESC;",
      chatSessionId
    )) as any[];

    const ordered = (history ?? []).slice().reverse();

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
        ...ordered
          .map((m) => {
            const t = (m?.SenderType ?? "").toString();
            const content = (m?.Message ?? "").toString();
            if (t === "User") return { role: "user" as const, content };
            if (t === "AI" || t === "Agent") return { role: "assistant" as const, content };
            return null;
          })
          .filter(Boolean) as any,
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
  if (err?.code === "P2021") {
    const message = "Database schema is missing required tables";
    console.error(message, err);
    return res.status(500).json({ error: message, code: "DB_SCHEMA_MISSING" });
  }

  if (/invalid object name/i.test(errStr)) {
    const message = "Database schema is missing required tables";
    console.error(message, err);
    return res.status(500).json({ error: message, code: "DB_SCHEMA_MISSING" });
  }

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
