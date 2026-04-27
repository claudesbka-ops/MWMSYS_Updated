"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionRouter = void 0;
const express_1 = require("express");
const stripe_1 = __importDefault(require("stripe"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
// Stripe client — null when STRIPE_SECRET_KEY is unset (handlers respond 500).
const stripeSecretKey = (process.env.STRIPE_SECRET_KEY ?? "").toString().trim();
const stripe = stripeSecretKey ? new stripe_1.default(stripeSecretKey, { apiVersion: "2023-10-16" }) : null;
exports.subscriptionRouter = (0, express_1.Router)();
// ---------- Stripe redirect bridge ----------
exports.subscriptionRouter.get("/stripe/return", (req, res) => {
    const raw = Array.isArray(req.query?.redirect) ? req.query.redirect[0] : req.query?.redirect;
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
    const allowedHosts = new Set(allowedHostsEnv
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean));
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
    }
    catch {
        return res.status(400).send("Invalid redirect");
    }
});
// ---------- Stripe checkout ----------
exports.subscriptionRouter.post("/Api/subscription/checkout", auth_1.requireAuth, async (req, res, next) => {
    try {
        if (!stripe)
            return res.status(500).json({ error: "Stripe is not configured" });
        await (0, subscription_1.ensureSubscriptionTableExists)();
        const user = req.user;
        const roleId = user?.roleId != null ? Number(user.roleId) : null;
        if (roleId !== 3 && roleId !== 4) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const entityId = (user?.userKey ?? "").toString().trim();
        if (!entityId)
            return res.status(400).json({ error: "Missing entity id" });
        const planType = (req.body?.planType ?? "").toString().trim();
        if (!planType)
            return res.status(400).json({ error: "planType is required" });
        const planKey = planType.toLowerCase();
        if (planKey === "free")
            return res.status(400).json({ error: "Free plan does not require checkout" });
        // Cycle defaults to monthly. Accept "monthly" | "yearly" (and a couple of
        // common aliases) so the mobile app can pass either.
        const rawCycle = (req.body?.cycle ?? req.body?.billingCycle ?? "").toString().trim().toLowerCase();
        const cycle = rawCycle === "yearly" || rawCycle === "annual" || rawCycle === "annually" ? "yearly" : "monthly";
        // Resolve the Stripe price ID. The lookup is cycle-aware: yearly first
        // tries cycle-specific env vars, then falls back to the cycle-agnostic
        // legacy names so deployments without separate yearly price IDs keep
        // working unchanged.
        const proCandidates = cycle === "yearly"
            ? ["STRIPE_PRO_PRICE_ID_YEARLY", "STRIPE_PRO_YEARLY_PRICE_ID", "STRIPE_PRICE_PRO_YEARLY", "STRIPE_PRO_PRICE_ID", "STRIPE_PRICE_PRO"]
            : ["STRIPE_PRO_PRICE_ID_MONTHLY", "STRIPE_PRO_MONTHLY_PRICE_ID", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRO_PRICE_ID", "STRIPE_PRICE_PRO"];
        const enterpriseCandidates = cycle === "yearly"
            ? ["STRIPE_ENTERPRISE_PRICE_ID_YEARLY", "STRIPE_ENTERPRISE_YEARLY_PRICE_ID", "STRIPE_PRICE_ENTERPRISE_YEARLY", "STRIPE_ENTERPRISE_PRICE_ID", "STRIPE_PRICE_ENTERPRISE"]
            : ["STRIPE_ENTERPRISE_PRICE_ID_MONTHLY", "STRIPE_ENTERPRISE_MONTHLY_PRICE_ID", "STRIPE_PRICE_ENTERPRISE_MONTHLY", "STRIPE_ENTERPRISE_PRICE_ID", "STRIPE_PRICE_ENTERPRISE"];
        const priceEnvCandidates = planKey === "pro" ? proCandidates : planKey === "enterprise" ? enterpriseCandidates : [];
        let priceId = null;
        for (const key of priceEnvCandidates) {
            const v = process.env[key];
            if (typeof v === "string" && v.trim()) {
                priceId = v.trim();
                break;
            }
        }
        if (!priceId) {
            return res.status(500).json({ error: `Stripe ${cycle} price for ${planKey} is not configured` });
        }
        const origin = (req.header("origin") ?? "").toString().trim();
        const bodySuccess = (req.body?.successUrl ?? "").toString().trim();
        const bodyCancel = (req.body?.cancelUrl ?? "").toString().trim();
        const envSuccess = (process.env.STRIPE_SUCCESS_URL ?? "").toString().trim();
        const envCancel = (process.env.STRIPE_CANCEL_URL ?? "").toString().trim();
        const isAbsoluteUrl = (u) => /^[a-z][a-z0-9+.-]*:\/\//i.test(u) && !/^(javascript|data):/i.test(u);
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
                    cycle,
                    roleId: roleId != null ? String(roleId) : "",
                },
            },
            metadata: {
                entityId,
                planType,
                cycle,
                roleId: roleId != null ? String(roleId) : "",
            },
        });
        return res.status(201).json({ ok: true, url: session.url, id: session.id });
    }
    catch (e) {
        return next(e);
    }
});
// ---------- Stripe webhook ----------
exports.subscriptionRouter.post("/webhooks/stripe", async (req, res) => {
    try {
        if (!stripe)
            return res.status(500).send("Stripe not configured");
        const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").toString().trim();
        if (!webhookSecret)
            return res.status(500).send("Missing webhook secret");
        const sig = req.header("stripe-signature");
        if (!sig)
            return res.status(400).send("Missing stripe-signature");
        const payload = req.rawBody;
        if (!payload)
            return res.status(400).send("Missing raw body");
        const event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
        if (event.type === "checkout.session.completed") {
            const s = event.data.object;
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
                const existing = await db_1.prisma.tbl_Subscription.findFirst({
                    where: {
                        entityId,
                        planType,
                        status: "Active",
                        startDate,
                        endDate,
                    },
                });
                if (!existing) {
                    await db_1.prisma.tbl_Subscription.updateMany({
                        where: { entityId, status: "Active" },
                        data: { status: "Expired" },
                    });
                    await db_1.prisma.tbl_Subscription.create({
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
            const s = event.data.object;
            const entityId = (s.metadata?.entityId ?? "").toString().trim();
            if (entityId) {
                await db_1.prisma.tbl_Subscription.updateMany({
                    where: { entityId, status: "Active" },
                    data: { status: "Expired" },
                });
            }
        }
        if (event.type === "customer.subscription.updated") {
            const s = event.data.object;
            const entityId = (s.metadata?.entityId ?? "").toString().trim();
            const planType = (s.metadata?.planType ?? "").toString().trim();
            if (entityId) {
                const startMs = (s.current_period_start ?? 0) * 1000;
                const endMs = (s.current_period_end ?? 0) * 1000;
                const startDate = startMs ? new Date(startMs) : new Date();
                const endDate = endMs ? new Date(endMs) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                const latest = await db_1.prisma.tbl_Subscription.findFirst({
                    where: { entityId, status: "Active" },
                    orderBy: [{ endDate: "desc" }],
                });
                if (latest) {
                    await db_1.prisma.tbl_Subscription.update({
                        where: { id: latest.id },
                        data: {
                            planType: planType || latest.planType,
                            startDate,
                            endDate,
                        },
                    });
                }
                else if (planType) {
                    await db_1.prisma.tbl_Subscription.create({
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
            const inv = event.data.object;
            const subId = (inv.subscription ?? "").toString().trim();
            if (subId) {
                const sub = await stripe.subscriptions.retrieve(subId);
                const entityId = (sub.metadata?.entityId ?? "").toString().trim();
                if (entityId) {
                    await db_1.prisma.tbl_Subscription.updateMany({
                        where: { entityId, status: "Active" },
                        data: { status: "Expired" },
                    });
                }
            }
        }
        return res.json({ received: true });
    }
    catch (err) {
        return res.status(400).send(err?.message ?? "Webhook Error");
    }
});
// ---------- Subscription CRUD ----------
exports.subscriptionRouter.get("/Api/subscription/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
        const roleId = user?.roleId != null ? Number(user.roleId) : null;
        if (roleId !== 3 && roleId !== 4) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const entityId = (user?.userKey ?? "").toString().trim();
        if (!entityId) {
            return res.status(400).json({ error: "Missing entity id" });
        }
        await (0, subscription_1.ensureSubscriptionTableExists)();
        const now = new Date();
        const active = await db_1.prisma.tbl_Subscription.findFirst({
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
    }
    catch (e) {
        return next(e);
    }
});
exports.subscriptionRouter.post("/Api/subscription/purchase", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = req.user;
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
        await (0, subscription_1.ensureSubscriptionTableExists)();
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + 30);
        const created = await db_1.prisma.tbl_Subscription.create({
            data: {
                entityId,
                planType,
                status: "Active",
                startDate: now,
                endDate: end,
            },
        });
        return res.status(201).json({ ok: true, id: created.id, planType: created.planType, endDate: created.endDate });
    }
    catch (e) {
        return next(e);
    }
});
