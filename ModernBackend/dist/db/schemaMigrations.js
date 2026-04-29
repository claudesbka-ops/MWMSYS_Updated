"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureRosterTablesExist = ensureRosterTablesExist;
exports.ensureHrmsRequestTablesExist = ensureHrmsRequestTablesExist;
exports.ensureAttestationTableExists = ensureAttestationTableExists;
exports.ensureChatTablesExist = ensureChatTablesExist;
exports.ensureBroadcastTableExists = ensureBroadcastTableExists;
exports.ensureDisputeTableExists = ensureDisputeTableExists;
exports.ensureOtpTableExists = ensureOtpTableExists;
exports.ensureRelationshipTablesExist = ensureRelationshipTablesExist;
exports.broadcastTableExists = broadcastTableExists;
exports.runSchemaMigrations = runSchemaMigrations;
const db_1 = require("../db");
const subscription_1 = require("../middleware/subscription");
/**
 * Idempotent `CREATE TABLE IF NOT EXISTS` bootstrappers (PostgreSQL).
 * Each helper silently swallows errors so a partially-present schema or
 * an already-running cluster does not fail server start.
 *
 * `runSchemaMigrations()` awaits every bootstrapper in parallel — call it
 * once from the server bootstrap before `server.listen(...)`. Individual
 * helpers can still be awaited lazily from route handlers for legacy
 * behavior (e.g. hosts with read-only credentials where table creation
 * must be explicitly opt-in).
 */
async function ensureRosterTablesExist() {
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_Shift_Template" (
        id SERIAL PRIMARY KEY,
        "entityId" VARCHAR(100) NOT NULL,
        name VARCHAR(80) NOT NULL,
        "startTime" VARCHAR(5) NOT NULL,
        "endTime" VARCHAR(5) NOT NULL,
        "breakMinutes" INT NOT NULL DEFAULT 0,
        "createdOn" TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_Roster_Assignment" (
        id SERIAL PRIMARY KEY,
        "workerId" VARCHAR(100) NOT NULL,
        "entityId" VARCHAR(100) NOT NULL,
        "date" DATE NOT NULL,
        "shiftId" INT NOT NULL,
        "updatedOn" TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UX_Roster_Worker_Date" ON "Tbl_Roster_Assignment"("workerId","date")`);
    }
    catch {
        // ignore
    }
}
async function ensureHrmsRequestTablesExist() {
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_HRMS_Overtime_Request" (
        id SERIAL PRIMARY KEY,
        "workerId" VARCHAR(100) NOT NULL,
        "workDate" DATE NOT NULL,
        hours DECIMAL(10,2) NOT NULL DEFAULT 0,
        reason VARCHAR(500) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        "createdOn" TIMESTAMP NOT NULL DEFAULT NOW(),
        "decisionBy" VARCHAR(100) NULL,
        "decisionOn" TIMESTAMP NULL
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_HRMS_OT_workerId" ON "Tbl_HRMS_Overtime_Request"("workerId")`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_HRMS_OT_status" ON "Tbl_HRMS_Overtime_Request"(status)`);
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_HRMS_Expense_Claim" (
        id SERIAL PRIMARY KEY,
        "workerId" VARCHAR(100) NOT NULL,
        "claimDate" DATE NOT NULL,
        amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        category VARCHAR(50) NULL,
        description VARCHAR(500) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        "createdOn" TIMESTAMP NOT NULL DEFAULT NOW(),
        "decisionBy" VARCHAR(100) NULL,
        "decisionOn" TIMESTAMP NULL
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_HRMS_EXP_workerId" ON "Tbl_HRMS_Expense_Claim"("workerId")`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_HRMS_EXP_status" ON "Tbl_HRMS_Expense_Claim"(status)`);
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_HRMS_Expense_Attachment" (
        id SERIAL PRIMARY KEY,
        "claimId" INT NOT NULL,
        "filePath" VARCHAR(500) NOT NULL,
        "originalName" VARCHAR(255) NULL,
        "mimeType" VARCHAR(120) NULL,
        "fileSize" INT NULL,
        "createdOn" TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_HRMS_EXP_ATT_claimId" ON "Tbl_HRMS_Expense_Attachment"("claimId")`);
    }
    catch {
        // ignore
    }
}
async function ensureAttestationTableExists() {
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_Attestation" (
        "AttestationId" SERIAL PRIMARY KEY,
        "Worker_Id" VARCHAR(100) NOT NULL,
        "Passport_Number" VARCHAR(20) NULL,
        "DocumentType" VARCHAR(50) NULL,
        "DocumentPath" VARCHAR(500) NULL,
        "Status" VARCHAR(20) NOT NULL DEFAULT 'Submitted',
        "AdminRemarks" VARCHAR(500) NULL,
        "Created_On" TIMESTAMP NULL DEFAULT NOW(),
        "Updated_On" TIMESTAMP NULL
      )`);
    }
    catch {
        // ignore
    }
}
async function ensureChatTablesExist() {
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChatSessions" (
        "ChatSessionId" SERIAL PRIMARY KEY,
        "WorkerId" INT NOT NULL,
        "CreatedOn" TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_ChatSessions_WorkerId" ON "ChatSessions"("WorkerId")`);
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChatMessages" (
        "ChatMessageId" SERIAL PRIMARY KEY,
        "ChatSessionId" INT NOT NULL,
        "SenderType" VARCHAR(20) NOT NULL,
        "Message" VARCHAR(2000) NOT NULL,
        "CreatedOn" TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_ChatMessages_SessionId" ON "ChatMessages"("ChatSessionId")`);
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SupportRequests" (
        "SupportRequestId" SERIAL PRIMARY KEY,
        "ChatSessionId" INT NOT NULL,
        "WorkerId" INT NOT NULL,
        "Reason" VARCHAR(500) NULL,
        "CreatedOn" TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_SupportRequests_SessionId" ON "SupportRequests"("ChatSessionId")`);
    }
    catch {
        // ignore
    }
}
async function ensureBroadcastTableExists() {
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_Broadcast_Message" (
        id SERIAL PRIMARY KEY,
        "senderRoleId" INT NOT NULL,
        "senderKey" VARCHAR(120) NULL,
        "senderName" VARCHAR(120) NULL,
        message VARCHAR(2000) NOT NULL,
        target VARCHAR(30) NOT NULL,
        "createdOn" TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_Broadcast_Attachment" (
        id SERIAL PRIMARY KEY,
        "messageId" INT NOT NULL,
        url VARCHAR(500) NOT NULL,
        mime VARCHAR(120) NULL,
        "originalName" VARCHAR(260) NULL,
        "sizeBytes" BIGINT NULL,
        "createdOn" TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_Broadcast_Att_MessageId" ON "Tbl_Broadcast_Attachment"("messageId")`);
    }
    catch {
        // ignore
    }
}
async function ensureDisputeTableExists() {
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_SalaryDispute" (
        "Id" SERIAL PRIMARY KEY,
        "Worker_Id" VARCHAR(100) NOT NULL,
        "Employer_Id" VARCHAR(100) NOT NULL,
        "Dispute_Month" VARCHAR(20) NOT NULL,
        "Expected_Amount" DECIMAL(10,2) NOT NULL,
        "Received_Amount" DECIMAL(10,2) NOT NULL,
        "Description" VARCHAR(1000) NOT NULL,
        "Proof_File_Path" VARCHAR(500) NULL,
        "Status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
        "Employer_Comment" VARCHAR(500) NULL,
        "Submitted_At" TIMESTAMP NOT NULL DEFAULT NOW(),
        "Reviewed_At" TIMESTAMP NULL,
        "Reviewed_By" VARCHAR(100) NULL
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_Tbl_SalaryDispute_Worker_Id" ON "Tbl_SalaryDispute"("Worker_Id")`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_Tbl_SalaryDispute_Employer_Id" ON "Tbl_SalaryDispute"("Employer_Id")`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_Tbl_SalaryDispute_Status" ON "Tbl_SalaryDispute"("Status")`);
    }
    catch {
        // ignore
    }
}
async function ensureOtpTableExists() {
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_UserOtp" (
        "Id" SERIAL PRIMARY KEY,
        "User_Id" VARCHAR(100) NOT NULL,
        "Otp_Code" VARCHAR(6) NOT NULL,
        "Otp_Type" VARCHAR(20) NOT NULL,
        "Created_At" TIMESTAMP NOT NULL DEFAULT NOW(),
        "Expires_At" TIMESTAMP NOT NULL,
        "Is_Used" BOOLEAN NOT NULL DEFAULT FALSE
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_Tbl_UserOtp_user_type" ON "Tbl_UserOtp"("User_Id","Otp_Type")`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_Tbl_UserOtp_expires" ON "Tbl_UserOtp"("Expires_At")`);
    }
    catch {
        // ignore
    }
    // Add Is_Verified column to Tbl_User if missing (idempotent ALTER).
    try {
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE "Tbl_User" ADD COLUMN IF NOT EXISTS "Is_Verified" BOOLEAN NULL DEFAULT FALSE`);
    }
    catch {
        // ignore
    }
}
async function ensureRelationshipTablesExist() {
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_Agency_Employer_Link" (
        id SERIAL PRIMARY KEY,
        "agencyId" VARCHAR(100) NOT NULL,
        "employerId" VARCHAR(100) NOT NULL,
        "linkedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "createdBy" VARCHAR(100) NULL
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tbl_Agency_Employer_Link_agency_employer" ON "Tbl_Agency_Employer_Link"("agencyId","employerId")`);
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tbl_Worker_EmployerLink" (
        id SERIAL PRIMARY KEY,
        "workerId" VARCHAR(100) NOT NULL,
        "employerId" VARCHAR(100) NOT NULL,
        "startDate" TIMESTAMP NOT NULL DEFAULT NOW(),
        "endDate" TIMESTAMP NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Active',
        "createdBy" VARCHAR(100) NULL
      )`);
        await db_1.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tbl_Worker_EmployerLink_w_e_s" ON "Tbl_Worker_EmployerLink"("workerId","employerId","startDate")`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_Tbl_Worker_EmployerLink_workerId" ON "Tbl_Worker_EmployerLink"("workerId")`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IX_Tbl_Worker_EmployerLink_employerId" ON "Tbl_Worker_EmployerLink"("employerId")`);
    }
    catch {
        // ignore
    }
}
/**
 * Non-mutating probe used when a host denies `CREATE TABLE` (e.g. read-only
 * DB users). Returns true if `Tbl_Broadcast_Message` currently exists.
 */
async function broadcastTableExists() {
    try {
        // We check the information_schema directly. 
        // This avoids the 'oid' and 'to_regclass' confusion.
        const rows = (await db_1.prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'Tbl_Broadcast_Message'
    `));
        return rows.length > 0;
    }
    catch (error) {
        console.error("Error checking broadcast table:", error);
        return false;
    }
}
/**
 * Runs every schema bootstrapper in parallel. Intended to be awaited once
 * during server startup before listening for connections. Individual
 * bootstrappers are idempotent and swallow their own errors, so this call
 * itself never rejects.
 */
async function runSchemaMigrations() {
    // Note: ensureSubscriptionTableExists lives in middleware/subscription.ts
    // because it is also invoked by the subscription middleware at request time.
    await Promise.all([
        ensureRosterTablesExist(),
        ensureHrmsRequestTablesExist(),
        ensureAttestationTableExists(),
        ensureChatTablesExist(),
        ensureBroadcastTableExists(),
        (0, subscription_1.ensureSubscriptionTableExists)(),
        ensureRelationshipTablesExist(),
        ensureOtpTableExists(),
        ensureDisputeTableExists(),
    ]);
}
