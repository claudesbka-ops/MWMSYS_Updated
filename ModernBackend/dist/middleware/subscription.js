"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSubscriptionTableExists = ensureSubscriptionTableExists;
exports.hasActivePlan = hasActivePlan;
exports.requireActivePlanForWrite = requireActivePlanForWrite;
const db_1 = require("../db");
/**
 * Ensures the subscription table exists. Idempotent; safe to call on
 * every write attempt though callers typically batch via `hasActivePlan`.
 */
async function ensureSubscriptionTableExists() {
    try {
        await db_1.prisma.$executeRawUnsafe("IF OBJECT_ID('dbo.Tbl_Subscription','U') IS NULL BEGIN " +
            "CREATE TABLE dbo.Tbl_Subscription (" +
            "id INT IDENTITY(1,1) NOT NULL PRIMARY KEY," +
            "entityId VARCHAR(100) NOT NULL," +
            "planType VARCHAR(20) NOT NULL," +
            "status VARCHAR(20) NOT NULL," +
            "startDate DATETIME NOT NULL," +
            "endDate DATETIME NOT NULL" +
            ");" +
            "END");
    }
    catch {
        // ignore
    }
}
/**
 * Returns true if the given entity (employer/agency `userKey`) has an
 * Active, non-expired plan that is not the Free tier.
 */
async function hasActivePlan(entityId) {
    await ensureSubscriptionTableExists();
    const now = new Date();
    const active = await db_1.prisma.tbl_Subscription.findFirst({
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
/**
 * Express middleware that blocks write requests from employer (3) / agency (4)
 * users whose subscription is inactive. Admins, workers, and authorities pass
 * through unchecked. Returns HTTP 402 "Subscription required" on failure.
 */
function requireActivePlanForWrite(req, res, next) {
    const user = req.user;
    const roleId = user?.roleId != null ? Number(user.roleId) : null;
    if (roleId !== 3 && roleId !== 4)
        return next();
    const entityId = (user?.userKey ?? "").toString().trim();
    if (!entityId)
        return res.status(400).json({ error: "Missing entity id" });
    hasActivePlan(entityId)
        .then((ok) => {
        if (!ok)
            return res.status(402).json({ error: "Subscription required" });
        return next();
    })
        .catch(() => res.status(500).json({ error: "Unable to verify subscription" }));
}
