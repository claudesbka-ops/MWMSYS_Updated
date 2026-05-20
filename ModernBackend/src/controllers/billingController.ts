import { Request, Response } from "express";
import { prisma } from "../db";
import { getStripe, PLANS, FREE_PLAN, isStripeConfigured, getPlanLimits, PlanType } from "../services/stripeService";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Billing not configured" });
    return;
  }

  const user = (req as any).user;
  const userId = user?.userKey || user?.userId;
  const email = user?.emailId;
  const planKey = (req.body?.plan || "").toString().toLowerCase();
  type PaidPlanType = keyof typeof PLANS;
  const validPlans = Object.keys(PLANS) as PaidPlanType[];

  if (!planKey || !validPlans.includes(planKey as PaidPlanType)) {
    res.status(400).json({ error: "Invalid plan. Choose: starter, growth, enterprise" });
    return;
  }

  const plan = PLANS[planKey as PaidPlanType];
  if (!plan.priceId) {
    res.status(503).json({ error: "Plan not configured" });
    return;
  }

  try {
    // Get or create Stripe customer
    const userRecord = await prisma.tbl_User.findFirst({
      where: { User_Id: String(userId) },
      select: { Stripe_Customer_Id: true, Email_Id: true },
    });

    let customerId = userRecord?.Stripe_Customer_Id;

    if (!customerId) {
      const customer = await getStripe()!.customers.create({
        email: email || userRecord?.Email_Id,
        metadata: { userId: String(userId) },
      });
      customerId = customer.id;

      await prisma.tbl_User.updateMany({
        where: { User_Id: String(userId) },
        data: { Stripe_Customer_Id: customerId },
      });
    }

    // Create checkout session with metadata at SESSION level (Fix #2)
    const session = await getStripe()!.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      // Metadata at session level for webhook access
      metadata: { userId: String(userId), plan: planKey },
      subscription_data: {
        trial_period_days: 30,
      },
      success_url: `${FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/billing/cancel`,
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("[Billing] Create checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
}

export async function getBillingStatus(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const userId = user?.userKey || user?.userId;

  try {
    const userRecord = await prisma.tbl_User.findFirst({
      where: { User_Id: String(userId) },
      select: {
        Plan_Name: true,
        Plan_Status: true,
        Plan_Workers_Limit: true,
        Plan_Employers_Limit: true,
        Plan_Current_Period_End: true,
        Plan_Trial_End: true,
      },
    });

    const now = new Date();
    const isTrialing = userRecord?.Plan_Trial_End ? new Date(userRecord.Plan_Trial_End) > now : false;

    res.json({
      plan: userRecord?.Plan_Name || "free",
      status: userRecord?.Plan_Status || "active",
      workersLimit: userRecord?.Plan_Workers_Limit || FREE_PLAN.workersLimit,
      employersLimit: userRecord?.Plan_Employers_Limit || FREE_PLAN.employersLimit,
      periodEnd: userRecord?.Plan_Current_Period_End,
      trialEnd: userRecord?.Plan_Trial_End,
      isTrialing,
    });
  } catch (err) {
    console.error("[Billing] Get status error:", err);
    res.status(500).json({ error: "Failed to get billing status" });
  }
}

export async function createPortalSession(req: Request, res: Response): Promise<void> {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Billing not configured" });
    return;
  }

  const user = (req as any).user;
  const userId = user?.userKey || user?.userId;

  try {
    const userRecord = await prisma.tbl_User.findFirst({
      where: { User_Id: String(userId) },
      select: { Stripe_Customer_Id: true },
    });

    if (!userRecord?.Stripe_Customer_Id) {
      res.status(400).json({ error: "No Stripe customer found" });
      return;
    }

    const session = await getStripe()!.billingPortal.sessions.create({
      customer: userRecord.Stripe_Customer_Id,
      return_url: `${FRONTEND_URL}/billing`,
    });

    res.json({ portalUrl: session.url });
  } catch (err) {
    console.error("[Billing] Create portal error:", err);
    res.status(500).json({ error: "Failed to create portal session" });
  }
}

export async function cancelSubscription(req: Request, res: Response): Promise<void> {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Billing not configured" });
    return;
  }

  const user = (req as any).user;
  const userId = user?.userKey || user?.userId;

  try {
    const userRecord = await prisma.tbl_User.findFirst({
      where: { User_Id: String(userId) },
      select: { Stripe_Subscription_Id: true },
    });

    if (!userRecord?.Stripe_Subscription_Id) {
      res.status(400).json({ error: "No active subscription found" });
      return;
    }

    // Cancel at period end (not immediately)
    await getStripe()!.subscriptions.update(userRecord.Stripe_Subscription_Id, {
      cancel_at_period_end: true,
    });

    // Get subscription to return period end
    const subscription = await getStripe()!.subscriptions.retrieve(userRecord.Stripe_Subscription_Id);

    await prisma.tbl_User.updateMany({
      where: { User_Id: String(userId) },
      data: { Plan_Status: "cancelling" },
    });

    res.json({
      cancelledAt: subscription.current_period_end,
      message: "Subscription will cancel at period end",
    });
  } catch (err) {
    console.error("[Billing] Cancel error:", err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
}
