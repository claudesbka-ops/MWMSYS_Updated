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
    const rows = (await db_1.prisma.$queryRawUnsafe("SELECT TOP (1) [ChatSessionId] FROM [dbo].[ChatSessions] WHERE [ChatSessionId]=@p1 AND [WorkerId]=@p2;", chatSessionId, workerId));
    return !!rows?.[0]?.ChatSessionId;
}
exports.chatRouter = (0, express_1.Router)();
exports.chatRouter.post("/Api/Chat/Sessions", auth_1.requireAuth, async (req, res, next) => {
    const workerId = Number(req.user?.userId ?? 0);
    if (!Number.isFinite(workerId) || workerId <= 0)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        await (0, schemaMigrations_1.ensureChatTablesExist)();
        const rows = (await db_1.prisma.$queryRawUnsafe("INSERT INTO [dbo].[ChatSessions]([WorkerId]) OUTPUT INSERTED.[ChatSessionId] as ChatSessionId VALUES(@p1);", workerId));
        const id = Array.isArray(rows) ? rows[0]?.ChatSessionId : null;
        if (!id)
            return res.status(500).json({ error: "Unable to create chat session" });
        return res.json({ ChatSessionId: Number(id) });
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
        const rows = (await db_1.prisma.$queryRawUnsafe("INSERT INTO [dbo].[ChatMessages]([ChatSessionId],[SenderType],[Message]) OUTPUT INSERTED.[ChatMessageId] as ChatMessageId, INSERTED.[CreatedOn] as CreatedOn VALUES(@p1,@p2,@p3);", chatSessionId, senderType, message));
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
        const rows = (await db_1.prisma.$queryRawUnsafe("SELECT [ChatMessageId],[ChatSessionId],[SenderType],[Message],[CreatedOn] FROM [dbo].[ChatMessages] WHERE [ChatSessionId] = @p1 ORDER BY [CreatedOn] ASC;", chatSessionId));
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
        const rows = (await db_1.prisma.$queryRawUnsafe("INSERT INTO [dbo].[SupportRequests]([ChatSessionId],[WorkerId],[Reason]) OUTPUT INSERTED.[SupportRequestId] as SupportRequestId VALUES(@p1,@p2,@p3);", chatSessionId, workerId, reason));
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
        const sessions = (await db_1.prisma.$queryRawUnsafe("SELECT TOP (1) [ChatSessionId] FROM [dbo].[ChatSessions] ORDER BY [ChatSessionId] DESC;"));
        const messages = (await db_1.prisma.$queryRawUnsafe("SELECT TOP (1) [ChatMessageId] FROM [dbo].[ChatMessages] ORDER BY [ChatMessageId] DESC;"));
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
        await db_1.prisma.$queryRawUnsafe("INSERT INTO [dbo].[ChatMessages]([ChatSessionId],[SenderType],[Message]) VALUES(@p1,@p2,@p3);", chatSessionId, "User", userText);
        const history = (await db_1.prisma.$queryRawUnsafe("SELECT TOP (16) [SenderType],[Message] FROM [dbo].[ChatMessages] WHERE [ChatSessionId]=@p1 ORDER BY [ChatMessageId] DESC;", chatSessionId));
        const ordered = (history ?? []).slice().reverse();
        const systemPrompt = "You are a Supportive Safety Liaison for International Workers using the MWMSYS app. " +
            "You must only answer questions related to: personal safety, emergency steps, worker rights, workplace issues, immigration/permit general guidance, and how to use this app (panic button, reporting, evidence upload). " +
            "If the user asks for anything off-topic (coding, entertainment, politics, hacking, medical diagnosis, illegal activity, unrelated personal advice), politely refuse and redirect to safety/app topics. " +
            "Use Markdown for clarity with short sections and bullet points. Keep responses concise. " +
            "If the user indicates immediate danger, instruct them to trigger the Panic Button and contact local emergency services immediately.";
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
        await db_1.prisma.$queryRawUnsafe("INSERT INTO [dbo].[ChatMessages]([ChatSessionId],[SenderType],[Message]) VALUES(@p1,@p2,@p3);", chatSessionId, "AI", aiText);
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
