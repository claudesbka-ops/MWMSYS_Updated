"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
exports.accountRouter = (0, express_1.Router)();
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
        });
    }
    catch (e) {
        return next(e);
    }
});
