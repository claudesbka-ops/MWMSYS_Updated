import dotenv from "dotenv";
dotenv.config();
import express from "express";
import http from "http";
import OpenAI from "openai";

import { prisma } from "./db";
import { encryptLegacyPassword } from "./cryptoLegacy";
import {
  checkRole,
  requireAdmin,
  requireAlertViewer,
  requireAuth,
  requireAuthority,
  requireReportsAccess,
} from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { jsonParser, urlencodedParser } from "./middleware/bodyParsers";
import { broadcastUpload, safeUnlinkUpload, upload, uploadsDir } from "./middleware/upload";
import { errorHandler } from "./middleware/errorHandler";
import { hasActivePlan, requireActivePlanForWrite } from "./middleware/subscription";
import {
  broadcastTableExists,
  ensureAttestationTableExists,
  ensureBroadcastTableExists,
  ensureChatTablesExist,
  ensureHrmsRequestTablesExist,
  ensureRosterTablesExist,
  runSchemaMigrations,
} from "./db/schemaMigrations";
import { buildWorkerScopeWhere } from "./services/queryGuard";
import { resolveWorkerScopes } from "./services/workerScopes";
import { initSocket } from "./services/socketService";
import { findWorkerIdByJwtUserId, findWorkerPassportByJwtUserId } from "./services/workerLookup";
import { extractDocumentData } from "./services/documentAiService";
import { evaluateDocument } from "./services/documentValidity";
import { accountRouter } from "./routes/accountRoutes";
import { authRouter } from "./routes/authRoutes";
import { broadcastRouter } from "./routes/broadcastRoutes";
import { chatRouter } from "./routes/chatRoutes";
import { disputeRouter } from "./routes/disputeRoutes";
import { hrmsRouter } from "./routes/hrmsRoutes";
import { panicRouter } from "./routes/panicRoutes";
import { relationshipRouter } from "./routes/relationshipRoutes";
import { subscriptionRouter } from "./routes/subscriptionRoutes";

const app = express();

app.use(corsMiddleware);
app.use(jsonParser);
app.use(urlencodedParser);

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
      `CREATE TABLE IF NOT EXISTS "Tbl_Worker_Location" (
        "workerId" VARCHAR(100) NOT NULL PRIMARY KEY,
        lat DECIMAL(10,7) NULL,
        lng DECIMAL(10,7) NULL,
        accuracy DECIMAL(10,2) NULL,
        "updatedOn" TIMESTAMP NULL
      )`
    );

    const accVal = Number.isFinite(accNum) ? accNum : null;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Tbl_Worker_Location"("workerId", lat, lng, accuracy, "updatedOn") VALUES ($1, $2, $3, $4, $5) ON CONFLICT ("workerId") DO UPDATE SET lat=EXCLUDED.lat, lng=EXCLUDED.lng, accuracy=EXCLUDED.accuracy, "updatedOn"=EXCLUDED."updatedOn"`,
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
        ? `SELECT r."workerId", r."date", s."startTime", s."endTime", s."breakMinutes" FROM "Tbl_Roster_Assignment" r LEFT JOIN "Tbl_Shift_Template" s ON s.id=r."shiftId" WHERE r."date" >= CAST($1 AS DATE) AND r."date" <= CAST($2 AS DATE) LIMIT 50000`
        : `SELECT r."workerId", r."date", s."startTime", s."endTime", s."breakMinutes" FROM "Tbl_Roster_Assignment" r LEFT JOIN "Tbl_Shift_Template" s ON s.id=r."shiftId" WHERE r."date" >= CAST($1 AS DATE) AND r."date" <= CAST($2 AS DATE) AND r."workerId" IN (${workerIds
            .map((_, i) => `$${i + 3}`)
            .join(",")}) LIMIT 50000`,
      fromStr,
      toStr,
      ...(roleId === 1 ? [] : workerIds)
    )) as Array<any>;

    const attendanceRows = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? `SELECT "workerId", "checkIn", "checkOut" FROM "Tbl_Attendance" WHERE "checkIn" >= $1 AND "checkIn" <= (CAST($2 AS TIMESTAMP) + INTERVAL '1 day') LIMIT 50000`
        : `SELECT "workerId", "checkIn", "checkOut" FROM "Tbl_Attendance" WHERE "checkIn" >= $1 AND "checkIn" <= (CAST($2 AS TIMESTAMP) + INTERVAL '1 day') AND "workerId" IN (${workerIds
            .map((_, i) => `$${i + 3}`)
            .join(",")}) LIMIT 50000`,
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
      `CREATE TABLE IF NOT EXISTS "Tbl_Worker_Location" (
        "workerId" VARCHAR(100) NOT NULL PRIMARY KEY,
        lat DECIMAL(10,7) NULL,
        lng DECIMAL(10,7) NULL,
        accuracy DECIMAL(10,2) NULL,
        "updatedOn" TIMESTAMP NULL
      )`
    );

    const locations = (await prisma.$queryRawUnsafe(
      roleId === 1
        ? `SELECT "workerId", lat, lng, accuracy, "updatedOn" FROM "Tbl_Worker_Location" ORDER BY "updatedOn" DESC LIMIT 5000`
        : `SELECT "workerId", lat, lng, accuracy, "updatedOn" FROM "Tbl_Worker_Location" WHERE "workerId" IN (${workerIds
            .map((_, i) => `$${i + 1}`)
            .join(",")}) ORDER BY "updatedOn" DESC LIMIT 5000`,
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

app.use("/uploads", express.static(uploadsDir));

const server = http.createServer(app);
const io = initSocket(server);

// ---- Domain routers (mounted after socket init so `getIO()` works at request time) ----
app.use(accountRouter);
app.use(authRouter);
app.use(broadcastRouter);
app.use(chatRouter);
app.use(disputeRouter);
app.use(hrmsRouter);
app.use(panicRouter);
app.use(relationshipRouter);
app.use(subscriptionRouter);


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

app.post(
  "/Api/Attestation/Submit",
  requireAuth,
  checkRole([2]),
  upload.single("file"),
  async (req, res, next) => {
    const uploaded = (req as any).file as
      | { filename?: string; originalname?: string; mimetype?: string; path?: string; size?: number }
      | undefined;
    if (!uploaded?.filename || !uploaded?.path) {
      return res.status(400).json({ error: "file is required" });
    }

    try {
      await ensureAttestationTableExists();

      const jwtUserId = Number((req as any).user?.userId ?? 0);
      const workerId = await findWorkerIdByJwtUserId(jwtUserId);
      if (!workerId) return res.status(400).json({ error: "Worker profile not found" });

      const passportFromBody = (req.body?.passportNumber ?? req.body?.PassportNumber ?? "").toString().trim();
      const passportFallback = await findWorkerPassportByJwtUserId(jwtUserId);
      const passportNumber = passportFromBody || passportFallback || null;

      const rawDocType = (req.body?.documentType ?? req.body?.docType ?? "").toString().trim().toLowerCase();
      const allowed = new Set(["passport", "permit", "work_permit", "insurance", "contract", "medical", "demand_letter"]);
      const docType = allowed.has(rawDocType) ? rawDocType : "passport";
      const documentPath = `/uploads/${uploaded.filename}`;

      // Best-effort AI extraction. Failures must not abort the upload.
      const fs = await import("fs");
      let extracted: Awaited<ReturnType<typeof extractDocumentData>> = {
        confidence: "low",
        rawText: "AI extraction skipped",
      };
      try {
        const buf = fs.readFileSync(uploaded.path);
        const base64 = buf.toString("base64");
        extracted = await extractDocumentData(base64, docType, uploaded.mimetype || "image/jpeg");
      } catch (aiErr) {
        console.error("[attestation/submit] AI extraction threw", aiErr);
      }

      const expiryTimestamp = extracted.expiryDate ? new Date(extracted.expiryDate) : null;
      const expiryValid = expiryTimestamp && Number.isFinite(expiryTimestamp.getTime()) ? expiryTimestamp : null;

      // Insert attestation row with AI extracted fields.
      const insertedRows = (await prisma.$queryRawUnsafe(
        `INSERT INTO "Tbl_Attestation"
          ("Worker_Id","Passport_Number","DocumentType","DocumentPath","Status","Created_On",
           "Extracted_Name","Extracted_Document_Number","Extracted_Expiry_Date","Extracted_Nationality","Ai_Confidence","Ai_Raw_Response")
         VALUES ($1,$2,$3,$4,'Submitted',NOW(),$5,$6,$7,$8,$9,$10)
         RETURNING "AttestationId"`,
        workerId,
        passportNumber,
        docType,
        documentPath,
        extracted.fullName ?? null,
        extracted.documentNumber ?? null,
        expiryValid,
        extracted.nationality ?? null,
        extracted.confidence,
        extracted.rawText ?? null,
      )) as Array<{ AttestationId: number }>;

      const attestationId = insertedRows?.[0]?.AttestationId ?? null;

      // Auto-fill expiry on the relevant worker profile table only when AI is
      // confident enough to trust the value. Low-confidence extractions still
      // get stored on the attestation row for human review.
      let autoFilled = false;
      if (expiryValid && (extracted.confidence === "high" || extracted.confidence === "medium")) {
        try {
          if (docType === "passport") {
            await prisma.tbl_Worker_PersonalInfo.update({
              where: { Worker_Id: workerId },
              data: { Passport_Expire_Date: expiryValid },
            });
            autoFilled = true;
          } else if (docType === "permit" || docType === "work_permit") {
            await prisma.tbl_Worker_PermitInsurance.upsert({
              where: { Worker_Id: workerId },
              create: { Worker_Id: workerId, Permit_Expire_Date: expiryValid },
              update: { Permit_Expire_Date: expiryValid },
            });
            autoFilled = true;
          } else if (docType === "contract") {
            await prisma.tbl_Worker_EmployerInfo.upsert({
              where: { Worker_Id: workerId },
              create: { Worker_Id: workerId, Contract_Expiry_Date: expiryValid },
              update: { Contract_Expiry_Date: expiryValid },
            });
            autoFilled = true;
          }
        } catch (autoErr) {
          console.error("[attestation/submit] auto-fill failed", autoErr);
        }
      }

      // Compute validity report against the worker's current profile so the
      // worker sees the same checklist the agency will see.
      const workerInfo = await prisma.tbl_Worker_PersonalInfo.findFirst({
        where: { Worker_Id: workerId },
        select: { Name: true, Passport_Number: true },
      });
      const validity = evaluateDocument(
        docType,
        {
          name: extracted.fullName,
          documentNumber: extracted.documentNumber,
          expiryDate: extracted.expiryDate,
          nationality: extracted.nationality,
          confidence: extracted.confidence,
        },
        {
          name: workerInfo?.Name ?? null,
          passportNumber: workerInfo?.Passport_Number ?? passportNumber,
        },
      );

      return res.status(201).json({
        message: "Document uploaded",
        attestationId,
        documentPath,
        extracted: {
          name: extracted.fullName ?? null,
          documentNumber: extracted.documentNumber ?? null,
          expiryDate: extracted.expiryDate ?? null,
          nationality: extracted.nationality ?? null,
          dateOfBirth: extracted.dateOfBirth ?? null,
          confidence: extracted.confidence,
        },
        autoFilled,
        validity,
      });
    } catch (e) {
      return next(e);
    }
  },
);

app.get("/Api/Attestation/List", requireAuth, checkRole([1, 4, 5, 6, 7]), async (req, res, next) => {
  try {
    await ensureAttestationTableExists();
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "AttestationId", "Worker_Id", "Passport_Number", "DocumentType", "DocumentPath", "Status", "AdminRemarks", "Created_On", "Updated_On",
              "Extracted_Name", "Extracted_Document_Number", "Extracted_Expiry_Date", "Extracted_Nationality", "Ai_Confidence"
         FROM "Tbl_Attestation"
         ORDER BY "AttestationId" DESC
         LIMIT 500`,
    )) as any[];

    const callerRoleId = Number((req as any).user?.roleId ?? 0);
    const isAdmin = callerRoleId === 1;

    // Compute validity per row against the worker's current profile and scrub
    // raw file paths from the response for non-admin reviewers (only admins
    // are allowed to open the actual document during attestation).
    const workerIds = Array.from(new Set((rows ?? []).map((r: any) => (r.Worker_Id ?? "").toString()).filter(Boolean)));
    const workerInfos = workerIds.length
      ? await prisma.tbl_Worker_PersonalInfo.findMany({
          where: { Worker_Id: { in: workerIds } },
          select: { Worker_Id: true, Name: true, Passport_Number: true },
        })
      : [];
    const workerMap = new Map(workerInfos.map((w) => [(w.Worker_Id ?? "").toString(), w]));

    const enriched = (rows ?? []).map((r: any) => {
      const w = workerMap.get((r.Worker_Id ?? "").toString());
      const validity = evaluateDocument(
        r.DocumentType,
        {
          name: r.Extracted_Name,
          documentNumber: r.Extracted_Document_Number,
          expiryDate: r.Extracted_Expiry_Date,
          nationality: r.Extracted_Nationality,
          confidence: r.Ai_Confidence,
        },
        {
          name: w?.Name ?? null,
          passportNumber: w?.Passport_Number ?? r.Passport_Number ?? null,
        },
      );
      const hasDocument = !!(r.DocumentPath && String(r.DocumentPath).trim());
      const out: any = {
        ...r,
        validity,
        hasDocument,
      };
      // Hide the raw filesystem path from non-admin reviewers — they must use
      // the gated `/Api/Attestation/:id/Document` endpoint instead.
      if (!isAdmin) delete out.DocumentPath;
      return out;
    });

    return res.json(enriched);
  } catch (e) {
    return next(e);
  }
});

/**
 * Streams the uploaded attestation document to the caller after enforcing
 * the role-based access policy:
 *   - Admin (1):    always allowed.
 *   - Worker (2):   only their own submission.
 *   - Employer (3): only after Status = 'Approved' AND the worker is
 *                   linked to that employer (Tbl_Worker_PersonalInfo.Employer_Id).
 *   - Anyone else:  403.
 */
app.get("/Api/Attestation/:id/Document", requireAuth, async (req, res, next) => {
  try {
    await ensureAttestationTableExists();
    const id = Number(req.params?.id ?? 0);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid attestation id" });
    }

    const callerRoleId = Number((req as any).user?.roleId ?? 0);
    const callerKey = ((req as any).user?.userKey ?? "").toString().trim();

    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "AttestationId", "Worker_Id", "DocumentPath", "Status" FROM "Tbl_Attestation" WHERE "AttestationId" = $1 LIMIT 1`,
      id,
    )) as Array<{ AttestationId: number; Worker_Id: string; DocumentPath: string | null; Status: string | null }>;
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: "Attestation not found" });

    const documentPath = (row.DocumentPath ?? "").toString().trim();
    if (!documentPath) return res.status(404).json({ error: "Document not available" });

    // Authorisation
    let allowed = false;
    if (callerRoleId === 1) {
      allowed = true;
    } else if (callerRoleId === 2) {
      allowed = !!callerKey && callerKey === (row.Worker_Id ?? "").toString();
    } else if (callerRoleId === 3) {
      const status = (row.Status ?? "").toString().toLowerCase();
      if (status === "approved") {
        const link = await prisma.tbl_Worker_PersonalInfo.findFirst({
          where: { Worker_Id: row.Worker_Id ?? "" },
          select: { Employer_Id: true },
        });
        const linkedEmployer = (link?.Employer_Id ?? "").toString().trim();
        allowed = !!callerKey && !!linkedEmployer && linkedEmployer === callerKey;
      }
    }

    if (!allowed) return res.status(403).json({ error: "Not authorised to view this document" });

    // Resolve the file from `uploadsDir` regardless of the stored path shape
    // (`/uploads/{name}` for new rows, raw filename for legacy rows). The
    // resolution is sandboxed to `uploadsDir` so a malicious DocumentPath
    // cannot escape via `..`.
    const path = await import("path");
    const fs = await import("fs");
    const fileName = documentPath.replace(/^\/+uploads\/+/, "").replace(/^\/+/, "");
    const safeName = path.basename(fileName);
    const fullPath = path.join(uploadsDir, safeName);
    if (!fullPath.startsWith(uploadsDir) || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "Document file missing on disk" });
    }

    const ext = path.extname(safeName).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, max-age=0, no-store");
    return fs.createReadStream(fullPath).pipe(res);
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Attestation/Approve", requireAuth, checkRole([1]), async (req, res, next) => {
  const id = Number(req.body?.id ?? 0);
  const remarks = (req.body?.remarks ?? "").toString();
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id is required" });

  try {
    await ensureAttestationTableExists();
    await prisma.$executeRawUnsafe(
      `UPDATE "Tbl_Attestation" SET "Status" = 'Approved', "AdminRemarks" = $1, "Updated_On" = NOW() WHERE "AttestationId" = $2`,
      remarks,
      id,
    );
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.post("/Api/Attestation/Reject", requireAuth, checkRole([1]), async (req, res, next) => {
  const id = Number(req.body?.id ?? 0);
  const remarks = (req.body?.remarks ?? "").toString();
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id is required" });

  try {
    await ensureAttestationTableExists();
    await prisma.$executeRawUnsafe(
      `UPDATE "Tbl_Attestation" SET "Status" = 'Rejected', "AdminRemarks" = $1, "Updated_On" = NOW() WHERE "AttestationId" = $2`,
      remarks,
      id,
    );
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

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

    const totalUsersRows = (await prisma.$queryRawUnsafe(`SELECT COUNT(1) as cnt FROM "Tbl_User"`)) as any[];
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
      `SELECT COALESCE(c."Country_Name", 'Unknown') as name, COUNT(1) as value FROM "Tbl_User" u INNER JOIN "Tbl_Worker_PersonalInfo" wpi ON wpi."Worker_Id" = u."User_Id" LEFT JOIN "Tbl_Country" c ON c."ID" = wpi."Nationality" GROUP BY c."Country_Name" ORDER BY value DESC`,
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
      `SELECT "ID", "User_Id", "User_Name", "Created_On" FROM "Tbl_User" ORDER BY "Created_On" DESC, "ID" DESC LIMIT 5`
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
      `SELECT "User_Id", "Employer_Name", "Employer_Address", "Employer_ContactPerson", "Employer_Position", "Employer_EmailID", "Employer_OfficeNumber", "Employer_PIC_MobileNumber", "Created_On" FROM "Tbl_Employer" ORDER BY "Created_On" DESC LIMIT 500`,
    )) as any[];
    return res.json(rows ?? []);
  } catch (e) {
    return next(e);
  }
});

/**
 * GET /Api/Agencies/List
 *
 * Returns the recruitment-agency directory for the Agencies page. Any
 * authenticated authority-role user may read it (admin, embassy, labour,
 * employer, agency) so the directory works across dashboards.
 */
app.get("/Api/Agencies/List", requireAuth, requireAuthority, async (_req, res, next) => {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "User_Id", "Agent_Name", "Agent_Organization_Name", "Agent_IC_Passport", "Agent_EmailID", "Agent_ContactNumber", "Agent_Country", "Agent_CountryCode", "Created_On" FROM "Tbl_Agent" ORDER BY "Created_On" DESC LIMIT 500`,
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
        ? `SELECT id, "entityId", name, "startTime", "endTime", "breakMinutes" FROM "Tbl_Shift_Template" ORDER BY id DESC LIMIT 500`
        : `SELECT id, "entityId", name, "startTime", "endTime", "breakMinutes" FROM "Tbl_Shift_Template" WHERE "entityId" = $1 ORDER BY id DESC LIMIT 500`,
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
      `INSERT INTO "Tbl_Shift_Template"("entityId",name,"startTime","endTime","breakMinutes") VALUES($1,$2,$3,$4,$5) RETURNING id`,
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
      `INSERT INTO "Tbl_Roster_Assignment"("workerId", "entityId", "date", "shiftId") VALUES ($1, $2, CAST($3 AS DATE), $4) ON CONFLICT ("workerId", "date") DO UPDATE SET "shiftId"=EXCLUDED."shiftId", "entityId"=EXCLUDED."entityId", "updatedOn"=NOW()`,
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
        ? `SELECT r.id, r."workerId", r."date", r."shiftId", s.name AS "shiftName", s."startTime", s."endTime", s."breakMinutes" FROM "Tbl_Roster_Assignment" r LEFT JOIN "Tbl_Shift_Template" s ON s.id=r."shiftId" WHERE r."date" >= CAST($1 AS DATE) AND r."date" <= CAST($2 AS DATE) ORDER BY r."date" DESC, r.id DESC LIMIT 5000`
        : `SELECT r.id, r."workerId", r."date", r."shiftId", s.name AS "shiftName", s."startTime", s."endTime", s."breakMinutes" FROM "Tbl_Roster_Assignment" r LEFT JOIN "Tbl_Shift_Template" s ON s.id=r."shiftId" WHERE r."date" >= CAST($1 AS DATE) AND r."date" <= CAST($2 AS DATE) AND r."workerId" IN (${workerIds
            .map((_, i) => `$${i + 3}`)
            .join(",")}) ORDER BY r."date" DESC, r.id DESC LIMIT 5000`,
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
        whereParts.push(`(r."workerId"=$${p} AND r."date"=CAST($${p + 1} AS DATE))`);
        params.push(pair.workerId, pair.dateStr);
        p += 2;
      }
      const q =
        `SELECT r."workerId", r."date" as d, s."startTime", s."endTime" ` +
        `FROM "Tbl_Roster_Assignment" r LEFT JOIN "Tbl_Shift_Template" s ON s.id=r."shiftId" ` +
        `WHERE ${whereParts.join(" OR ")} LIMIT 50000`;
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
        ? `SELECT "workerId", SUM(hours) as "totalHours", SUM(CASE WHEN status='Approved' THEN hours ELSE 0 END) as "approvedHours" FROM "Tbl_HRMS_Overtime_Request" WHERE "workDate" >= CAST($1 AS DATE) AND "workDate" <= CAST($2 AS DATE) GROUP BY "workerId"`
        : `SELECT "workerId", SUM(hours) as "totalHours", SUM(CASE WHEN status='Approved' THEN hours ELSE 0 END) as "approvedHours" FROM "Tbl_HRMS_Overtime_Request" WHERE "workDate" >= CAST($1 AS DATE) AND "workDate" <= CAST($2 AS DATE) AND "workerId" IN (${workerIds
            .map((_, i) => `$${i + 3}`)
            .join(",")}) GROUP BY "workerId"`,
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
        ? `SELECT "workerId", SUM(amount) as "totalAmount", SUM(CASE WHEN status='Approved' THEN amount ELSE 0 END) as "approvedAmount" FROM "Tbl_HRMS_Expense_Claim" WHERE "claimDate" >= CAST($1 AS DATE) AND "claimDate" <= CAST($2 AS DATE) GROUP BY "workerId"`
        : `SELECT "workerId", SUM(amount) as "totalAmount", SUM(CASE WHEN status='Approved' THEN amount ELSE 0 END) as "approvedAmount" FROM "Tbl_HRMS_Expense_Claim" WHERE "claimDate" >= CAST($1 AS DATE) AND "claimDate" <= CAST($2 AS DATE) AND "workerId" IN (${workerIds
            .map((_, i) => `$${i + 3}`)
            .join(",")}) GROUP BY "workerId"`,
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
        Name: true,
        Passport_Number: true,
        Email_Id: true,
        Created_On: true,
        Nationality: true,
        Employer_Id: true,
      },
      orderBy: [{ Created_On: "desc" }],
      take: 500,
    });

    const workerIds = Array.from(new Set((rows ?? []).map((r) => (r.Worker_Id ?? "").toString()).filter(Boolean)));
    const natIds = Array.from(new Set((rows ?? []).map((r) => r.Nationality).filter((x): x is number => x != null)));
    const employerUserIds = Array.from(
      new Set((rows ?? []).map((r) => (r.Employer_Id ?? "").toString().trim()).filter(Boolean))
    );

    const [countries, employerInfos, employerAccounts, permits] = await Promise.all([
      natIds.length
        ? prisma.tbl_Country.findMany({
            where: { ID: { in: natIds } },
            select: { ID: true, Country_Name: true },
          })
        : Promise.resolve([] as Array<{ ID: number; Country_Name: string }>),
      workerIds.length
        ? prisma.tbl_Worker_EmployerInfo.findMany({
            where: { Worker_Id: { in: workerIds } },
            select: { Worker_Id: true, Employer_Name: true, Employer_Address: true },
            take: 5000,
          })
        : Promise.resolve([] as Array<{ Worker_Id: string; Employer_Name: string | null; Employer_Address: string | null }>),
      employerUserIds.length
        ? prisma.tbl_Employer.findMany({
            where: { User_Id: { in: employerUserIds } },
            select: { User_Id: true, Employer_Name: true, Employer_Address: true },
            take: 5000,
          })
        : Promise.resolve([] as Array<{ User_Id: string; Employer_Name: string; Employer_Address: string }>),
      workerIds.length
        ? prisma.tbl_Worker_PermitInsurance.findMany({
            where: { Worker_Id: { in: workerIds } },
            select: { Worker_Id: true, Permit_Expire_Date: true },
            take: 5000,
          })
        : Promise.resolve([] as Array<{ Worker_Id: string; Permit_Expire_Date: Date | null }>),
    ]);

    const countryById = new Map<number, string>();
    for (const c of countries ?? []) countryById.set(c.ID, c.Country_Name);

    const employerByWorker = new Map<string, { name: string | null; address: string | null }>();
    for (const e of employerInfos ?? []) {
      employerByWorker.set((e.Worker_Id ?? "").toString(), {
        name: e.Employer_Name ?? null,
        address: e.Employer_Address ?? null,
      });
    }

    const employerByAccount = new Map<string, { name: string | null; address: string | null }>();
    for (const e of employerAccounts ?? []) {
      employerByAccount.set((e.User_Id ?? "").toString(), {
        name: e.Employer_Name ?? null,
        address: e.Employer_Address ?? null,
      });
    }

    const permitByWorker = new Map<string, Date | null>();
    for (const p of permits ?? []) {
      permitByWorker.set((p.Worker_Id ?? "").toString(), p.Permit_Expire_Date ?? null);
    }

    return res.json(
      (rows ?? []).map((r) => {
        const wid = (r.Worker_Id ?? "").toString();
        const eid = (r.Employer_Id ?? "").toString().trim();
        const employer = employerByWorker.get(wid) ?? (eid ? employerByAccount.get(eid) : undefined) ?? null;
        return {
          Worker_Id: r.Worker_Id,
          Name: r.Name ?? null,
          Passport_Number: r.Passport_Number,
          Email_Id: r.Email_Id,
          Created_On: r.Created_On,
          Employer_Id: r.Employer_Id ?? null,
          Current_Location: employer?.address ?? null,
          Company_Name: employer?.name ?? null,
          Country_Name: r.Nationality != null ? countryById.get(r.Nationality) ?? null : null,
          Permit_Expire_Date: permitByWorker.get(wid) ?? null,
        };
      })
    );
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


app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
app.get("/", (req, res) => {
  res.status(200).json({
    status: "online",
    system: "MWMSYS API Production",
    version: "1.0.0",
    serverTime: new Date().toISOString()
  });
});
// Bootstrap schema bootstrappers up-front (idempotent, errors swallowed),
// then start listening. Route-level `ensure*TableExists()` calls remain
// in place as cheap no-ops after the initial run for defense-in-depth.
runSchemaMigrations()
  .catch((e) => console.warn("runSchemaMigrations failed (continuing)", e))
  .finally(() => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`ModernBackend listening on port ${String(port)}`);
    });
  });

