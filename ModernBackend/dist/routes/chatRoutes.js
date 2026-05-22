"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = void 0;
const express_1 = require("express");
const openai_1 = __importDefault(require("openai"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const schemaMigrations_1 = require("../db/schemaMigrations");
// ---------- Chat-local ownership guard ----------
async function assertChatSessionOwner(chatSessionId, workerId) {
    const rows = (await db_1.prisma.$queryRawUnsafe(`SELECT "ChatSessionId" FROM "ChatSessions" WHERE "ChatSessionId"=$1 AND "WorkerId"=$2 LIMIT 1`, chatSessionId, workerId));
    return !!rows?.[0]?.ChatSessionId;
}
exports.chatRouter = (0, express_1.Router)();
exports.chatRouter.post("/Api/Chat/Sessions", auth_1.requireAuth, async (req, res, next) => {
    const workerId = Number(req.user?.userId ?? 0);
    if (!Number.isFinite(workerId) || workerId <= 0)
        return res.status(401).json({ error: "Unauthorized" });
    const preferredLanguage = (req.body?.preferredLanguage ?? req.body?.language ?? "en").toString().toLowerCase();
    try {
        await (0, schemaMigrations_1.ensureChatTablesExist)();
        const rows = (await db_1.prisma.$queryRawUnsafe(`INSERT INTO "ChatSessions"("WorkerId","PreferredLanguage") VALUES($1,$2) RETURNING "ChatSessionId"`, workerId, preferredLanguage));
        const id = Array.isArray(rows) ? rows[0]?.ChatSessionId : null;
        if (!id)
            return res.status(500).json({ error: "Unable to create chat session" });
        return res.json({ ChatSessionId: Number(id), PreferredLanguage: preferredLanguage });
    }
    catch (e) {
        const msg = (e?.message ?? "").toString();
        if (/invalid object name|chatsessions/i.test(msg)) {
            return res.status(501).json({ error: "Chat tables not installed" });
        }
        return next(e);
    }
});
exports.chatRouter.post("/Api/Chat/Messages", auth_1.requireAuth, async (req, res, next) => {
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
        await (0, schemaMigrations_1.ensureChatTablesExist)();
        const workerId = Number(req.user?.userId ?? 0);
        if (!Number.isFinite(workerId) || workerId <= 0)
            return res.status(401).json({ error: "Unauthorized" });
        const ok = await assertChatSessionOwner(chatSessionId, workerId);
        if (!ok)
            return res.status(403).json({ error: "Forbidden" });
        const rows = (await db_1.prisma.$queryRawUnsafe(`INSERT INTO "ChatMessages"("ChatSessionId","SenderType","Message") VALUES($1,$2,$3) RETURNING "ChatMessageId", "CreatedOn"`, chatSessionId, senderType, message));
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
exports.chatRouter.get("/Api/Chat/Messages", auth_1.requireAuth, async (req, res, next) => {
    const raw = Array.isArray(req.query.ChatSessionId) ? req.query.ChatSessionId[0] : req.query.ChatSessionId;
    const chatSessionId = raw != null ? Number(raw) : 0;
    if (!Number.isFinite(chatSessionId) || chatSessionId <= 0) {
        return res.status(400).json({ error: "ChatSessionId is required" });
    }
    try {
        await (0, schemaMigrations_1.ensureChatTablesExist)();
        const workerId = Number(req.user?.userId ?? 0);
        if (!Number.isFinite(workerId) || workerId <= 0)
            return res.status(401).json({ error: "Unauthorized" });
        const ok = await assertChatSessionOwner(chatSessionId, workerId);
        if (!ok)
            return res.status(403).json({ error: "Forbidden" });
        const rows = (await db_1.prisma.$queryRawUnsafe(`SELECT "ChatMessageId","ChatSessionId","SenderType","Message","CreatedOn" FROM "ChatMessages" WHERE "ChatSessionId" = $1 ORDER BY "CreatedOn" ASC`, chatSessionId));
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
exports.chatRouter.post("/Api/Chat/SupportRequests", auth_1.requireAuth, async (req, res, next) => {
    const chatSessionId = Number(req.body?.ChatSessionId ?? req.body?.chatSessionId ?? 0);
    const workerId = Number(req.user?.userId ?? 0);
    const reason = (req.body?.Reason ?? req.body?.reason ?? "").toString();
    if (!Number.isFinite(chatSessionId) || chatSessionId <= 0) {
        return res.status(400).json({ error: "ChatSessionId is required" });
    }
    if (!Number.isFinite(workerId) || workerId <= 0)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        await (0, schemaMigrations_1.ensureChatTablesExist)();
        const ok = await assertChatSessionOwner(chatSessionId, workerId);
        if (!ok)
            return res.status(403).json({ error: "Forbidden" });
        const rows = (await db_1.prisma.$queryRawUnsafe(`INSERT INTO "SupportRequests"("ChatSessionId","WorkerId","Reason") VALUES($1,$2,$3) RETURNING "SupportRequestId"`, chatSessionId, workerId, reason));
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
exports.chatRouter.get("/Api/Chat/DbStatus", auth_1.requireAuth, async (_req, res, next) => {
    try {
        await (0, schemaMigrations_1.ensureChatTablesExist)();
        const sessions = (await db_1.prisma.$queryRawUnsafe(`SELECT "ChatSessionId" FROM "ChatSessions" ORDER BY "ChatSessionId" DESC LIMIT 1`));
        const messages = (await db_1.prisma.$queryRawUnsafe(`SELECT "ChatMessageId" FROM "ChatMessages" ORDER BY "ChatMessageId" DESC LIMIT 1`));
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
exports.chatRouter.post("/Api/Chat/AIReply", auth_1.requireAuth, async (req, res, next) => {
    const chatSessionId = Number(req.body?.ChatSessionId ?? req.body?.chatSessionId ?? 0);
    const workerId = Number(req.user?.userId ?? 0);
    const userText = (req.body?.Message ?? req.body?.message ?? "").toString();
    if (!Number.isFinite(chatSessionId) || chatSessionId <= 0) {
        return res.status(400).json({ error: "ChatSessionId is required" });
    }
    if (!Number.isFinite(workerId) || workerId <= 0)
        return res.status(401).json({ error: "Unauthorized" });
    if (!userText.trim()) {
        return res.status(400).json({ error: "Message is required" });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";
    try {
        await (0, schemaMigrations_1.ensureChatTablesExist)();
        const ok = await assertChatSessionOwner(chatSessionId, workerId);
        if (!ok)
            return res.status(403).json({ error: "Forbidden" });
        // Get session language preference
        const sessionRows = (await db_1.prisma.$queryRawUnsafe(`SELECT "PreferredLanguage" FROM "ChatSessions" WHERE "ChatSessionId"=$1 LIMIT 1`, chatSessionId));
        const preferredLanguage = (sessionRows?.[0]?.PreferredLanguage ?? "en").toString();
        await db_1.prisma.$queryRawUnsafe(`INSERT INTO "ChatMessages"("ChatSessionId","SenderType","Message") VALUES($1,$2,$3)`, chatSessionId, "User", userText);
        const history = (await db_1.prisma.$queryRawUnsafe(`SELECT "SenderType","Message" FROM "ChatMessages" WHERE "ChatSessionId"=$1 ORDER BY "ChatMessageId" DESC LIMIT 16`, chatSessionId));
        const ordered = (history ?? []).slice().reverse();
        const systemPrompt = [
            "You are the MWMS Assistant, an expert on the MWMS (Migrant Worker Management System) platform.",
            "",
            `LANGUAGE INSTRUCTION: The user prefers to communicate in "${preferredLanguage}". Detect their language from their message and respond in the SAME language. Supported languages: English (en), Bengali/Bangla (bn), Tamil (ta), Bahasa Malaysia (ms), Arabic (ar). If the user's message is in Bengali, respond in Bengali. If Tamil, respond in Tamil. Always match the user's language exactly. Use natural, conversational tone appropriate for workers.`,
            "",
            "ROLES IN THE SYSTEM:",
            "- Worker (role 2): Files complaints, triggers SOS panic button with GPS, views own documents and payslips, submits salary disputes, uploads attestation documents",
            "- Employer (role 3): Manages their workers, views 6 expiry reports (visa/permit/insurance/contract/medical/passport), handles complaints, publishes company news, links workers via search",
            "- Agency (role 4): Manages multiple employers, views compliance scoring, exports JTKSM audit reports, links employers via search, monitors all linked workers",
            "- Embassy Source/Destination (roles 5/6): Views only workers matching their nationality, broadcasts messages to own nationality workers only",
            "- Labour Department (role 7): Global visibility — all workers, all employers, all agencies, no filters",
            "- Admin (role 1): Full system access",
            "",
            "KEY FEATURES:",
            "- SOS Panic Button: Worker triggers alert, GPS coordinates sent, employer and agency notified in real time via websocket",
            "- Document Expiry Alerts: Automatic alerts at 90, 60, 30 days before visa/permit/insurance/contract expiry, color coded red/amber/green",
            "- Live Operations Map: Real-time GPS location of all workers on Google Maps, scoped by role",
            "- Salary Dispute: Worker submits dispute with evidence, employer responds, agency and admin monitor",
            "- Attestation: Worker uploads documents, agency verifies, admin oversees",
            "- HRMS: Attendance, Leave, Payroll, Contracts, Roster, Timesheets — available on Pro and Enterprise plans",
            "- Broadcast: Send messages to all workers or nationality-specific workers",
            "- Subscription Plans: Free (basic), Pro (full HRMS), Enterprise (custom) — managed via Stripe",
            "- Registration: Workers select employer on signup and are immediately linked. Agencies link employers via search. Employers link workers via search.",
            "",
            "Always answer helpfully about how to use any feature. If unsure, direct users to contact support.",
        ].join("\n");
        const client = new openai_1.default({ apiKey });
        const completion = await client.chat.completions.create({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                ...ordered
                    .map((m) => {
                    const t = (m?.SenderType ?? "").toString();
                    const content = (m?.Message ?? "").toString();
                    if (t === "User")
                        return { role: "user", content };
                    if (t === "AI" || t === "Agent")
                        return { role: "assistant", content };
                    return null;
                })
                    .filter(Boolean),
            ],
            temperature: 0.4,
            max_tokens: 350,
        });
        const aiText = completion.choices?.[0]?.message?.content?.toString?.() ?? "";
        await db_1.prisma.$queryRawUnsafe(`INSERT INTO "ChatMessages"("ChatSessionId","SenderType","Message") VALUES($1,$2,$3)`, chatSessionId, "AI", aiText);
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
