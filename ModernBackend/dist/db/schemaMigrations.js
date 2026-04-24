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
 * Idempotent `IF OBJECT_ID(...) IS NULL CREATE TABLE` bootstrappers.
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
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_Shift_Template','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.Tbl_Shift_Template (" +
            "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "entityId VARCHAR(100) NOT NULL," +
            "name VARCHAR(80) NOT NULL," +
            "startTime VARCHAR(5) NOT NULL," +
            "endTime VARCHAR(5) NOT NULL," +
            "breakMinutes INT NOT NULL DEFAULT(0)," +
            "createdOn DATETIME NOT NULL DEFAULT(GETDATE())" +
            ");" +
            "END");
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_Roster_Assignment','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.Tbl_Roster_Assignment (" +
            "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "workerId VARCHAR(100) NOT NULL," +
            "entityId VARCHAR(100) NOT NULL," +
            "date DATE NOT NULL," +
            "shiftId INT NOT NULL," +
            "updatedOn DATETIME NOT NULL DEFAULT(GETDATE())" +
            ");" +
            "CREATE UNIQUE INDEX UX_Roster_Worker_Date ON dbo.Tbl_Roster_Assignment(workerId,date);" +
            "END");
    }
    catch {
        // ignore
    }
}
async function ensureHrmsRequestTablesExist() {
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_HRMS_Overtime_Request','U') IS NULL BEGIN " +
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
            "END");
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_HRMS_Expense_Claim','U') IS NULL BEGIN " +
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
            "END");
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_HRMS_Expense_Attachment','U') IS NULL BEGIN " +
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
            "END");
    }
    catch {
        // ignore
    }
}
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
async function ensureChatTablesExist() {
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.ChatSessions','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.ChatSessions (" +
            "ChatSessionId INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "WorkerId INT NOT NULL," +
            "CreatedOn DATETIME NOT NULL DEFAULT(GETDATE())" +
            ");" +
            "CREATE INDEX IX_ChatSessions_WorkerId ON dbo.ChatSessions(WorkerId);" +
            "END");
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.ChatMessages','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.ChatMessages (" +
            "ChatMessageId INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "ChatSessionId INT NOT NULL," +
            "SenderType VARCHAR(20) NOT NULL," +
            "Message NVARCHAR(2000) NOT NULL," +
            "CreatedOn DATETIME NOT NULL DEFAULT(GETDATE())" +
            ");" +
            "CREATE INDEX IX_ChatMessages_SessionId ON dbo.ChatMessages(ChatSessionId);" +
            "END");
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.SupportRequests','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.SupportRequests (" +
            "SupportRequestId INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "ChatSessionId INT NOT NULL," +
            "WorkerId INT NOT NULL," +
            "Reason NVARCHAR(500) NULL," +
            "CreatedOn DATETIME NOT NULL DEFAULT(GETDATE())" +
            ");" +
            "CREATE INDEX IX_SupportRequests_SessionId ON dbo.SupportRequests(ChatSessionId);" +
            "END");
    }
    catch {
        // ignore
    }
}
async function ensureBroadcastTableExists() {
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_Broadcast_Message','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.Tbl_Broadcast_Message (" +
            "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "senderRoleId INT NOT NULL," +
            "senderKey VARCHAR(120) NULL," +
            "senderName VARCHAR(120) NULL," +
            "message NVARCHAR(2000) NOT NULL," +
            "target VARCHAR(30) NOT NULL," +
            "createdOn DATETIME NOT NULL DEFAULT(GETDATE())" +
            ");" +
            "END");
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_Broadcast_Attachment','U') IS NULL BEGIN " +
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
            "END");
    }
    catch {
        // ignore
    }
}
async function ensureDisputeTableExists() {
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_SalaryDispute','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.Tbl_SalaryDispute (" +
            "Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "Worker_Id VARCHAR(100) NOT NULL," +
            "Employer_Id VARCHAR(100) NOT NULL," +
            "Dispute_Month VARCHAR(20) NOT NULL," +
            "Expected_Amount DECIMAL(10,2) NOT NULL," +
            "Received_Amount DECIMAL(10,2) NOT NULL," +
            "Description VARCHAR(1000) NOT NULL," +
            "Proof_File_Path VARCHAR(500) NULL," +
            "Status VARCHAR(20) NOT NULL DEFAULT('Pending')," +
            "Employer_Comment VARCHAR(500) NULL," +
            "Submitted_At DATETIME NOT NULL DEFAULT(GETDATE())," +
            "Reviewed_At DATETIME NULL," +
            "Reviewed_By VARCHAR(100) NULL" +
            ");" +
            "CREATE INDEX IX_Tbl_SalaryDispute_Worker_Id ON dbo.Tbl_SalaryDispute(Worker_Id);" +
            "CREATE INDEX IX_Tbl_SalaryDispute_Employer_Id ON dbo.Tbl_SalaryDispute(Employer_Id);" +
            "CREATE INDEX IX_Tbl_SalaryDispute_Status ON dbo.Tbl_SalaryDispute(Status);" +
            "END");
    }
    catch {
        // ignore
    }
}
async function ensureOtpTableExists() {
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_UserOtp','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.Tbl_UserOtp (" +
            "Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "User_Id VARCHAR(100) NOT NULL," +
            "Otp_Code VARCHAR(6) NOT NULL," +
            "Otp_Type VARCHAR(20) NOT NULL," +
            "Created_At DATETIME NOT NULL DEFAULT(GETDATE())," +
            "Expires_At DATETIME NOT NULL," +
            "Is_Used BIT NOT NULL DEFAULT(0)" +
            ");" +
            "CREATE INDEX IX_Tbl_UserOtp_user_type ON dbo.Tbl_UserOtp(User_Id,Otp_Type);" +
            "CREATE INDEX IX_Tbl_UserOtp_expires ON dbo.Tbl_UserOtp(Expires_At);" +
            "END");
    }
    catch {
        // ignore
    }
    // Add Is_Verified column to Tbl_User if missing (idempotent ALTER).
    try {
        await db_1.prisma.$executeRawUnsafe("IF NOT EXISTS (SELECT 1 FROM sys.columns " +
            "WHERE object_id = OBJECT_ID('dbo.Tbl_User') AND name = 'Is_Verified') " +
            "BEGIN " +
            "ALTER TABLE dbo.Tbl_User ADD Is_Verified BIT NULL CONSTRAINT DF_Tbl_User_Is_Verified DEFAULT(0); " +
            "END");
    }
    catch {
        // ignore
    }
}
async function ensureRelationshipTablesExist() {
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_Agency_Employer_Link','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.Tbl_Agency_Employer_Link (" +
            "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "agencyId VARCHAR(100) NOT NULL," +
            "employerId VARCHAR(100) NOT NULL," +
            "linkedAt DATETIME NOT NULL DEFAULT(GETDATE())," +
            "createdBy VARCHAR(100) NULL" +
            ");" +
            "CREATE UNIQUE INDEX UX_Tbl_Agency_Employer_Link_agency_employer " +
            "ON dbo.Tbl_Agency_Employer_Link(agencyId,employerId);" +
            "END");
    }
    catch {
        // ignore
    }
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_Worker_EmployerLink','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.Tbl_Worker_EmployerLink (" +
            "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "workerId VARCHAR(100) NOT NULL," +
            "employerId VARCHAR(100) NOT NULL," +
            "startDate DATETIME NOT NULL DEFAULT(GETDATE())," +
            "endDate DATETIME NULL," +
            "status VARCHAR(20) NOT NULL DEFAULT('Active')," +
            "createdBy VARCHAR(100) NULL" +
            ");" +
            "CREATE UNIQUE INDEX UX_Tbl_Worker_EmployerLink_w_e_s " +
            "ON dbo.Tbl_Worker_EmployerLink(workerId,employerId,startDate);" +
            "CREATE INDEX IX_Tbl_Worker_EmployerLink_workerId " +
            "ON dbo.Tbl_Worker_EmployerLink(workerId);" +
            "CREATE INDEX IX_Tbl_Worker_EmployerLink_employerId " +
            "ON dbo.Tbl_Worker_EmployerLink(employerId);" +
            "END");
    }
    catch {
        // ignore
    }
}
/**
 * Non-mutating probe used when a host denies `CREATE TABLE` (e.g. read-only
 * DB users). Returns true if `dbo.Tbl_Broadcast_Message` currently exists.
 */
async function broadcastTableExists() {
    try {
        const rows = (await db_1.prisma.$queryRawUnsafe("SELECT OBJECT_ID('dbo.Tbl_Broadcast_Message','U') AS oid;"));
        const oid = rows?.[0]?.oid;
        return oid != null;
    }
    catch {
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
