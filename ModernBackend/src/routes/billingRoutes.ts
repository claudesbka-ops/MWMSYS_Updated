import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createCheckoutSession, getBillingStatus, createPortalSession, cancelSubscription } from "../controllers/billingController";
import { prisma } from "../db";
import { getStripe, getWebhookSecret, PLANS, FREE_PLAN } from "../services/stripeService";
import type { Request, Response } from "express";

export const billingRouter = Router();

// Protected routes (require JWT)
billingRouter.post("/Api/Billing/CreateCheckout", requireAuth, createCheckoutSession);
billingRouter.get("/Api/Billing/Status", requireAuth, getBillingStatus);
billingRouter.post("/Api/Billing/Cancel", requireAuth, cancelSubscription);
billingRouter.get("/Api/Billing/Portal", requireAuth, createPortalSession);

// Webhook handler (export for raw body middleware in index.ts)
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];
  const secret = getWebhookSecret();

  if (!sig || !secret) {
    res.status(400).send("Missing signature or secret");
    return;
  }

  let event;
  try {
    event = getStripe()!.webhooks.constructEvent(req.body, sig, secret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Return 200 immediately
  res.status(200).json({ received: true });

  // Process event asynchronously
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        // Read metadata from session level (Fix #2)
        const { userId, plan } = session.metadata || {};
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!userId || !plan) {
          console.error("[Stripe Webhook] Missing metadata in checkout.session.completed");
          return;
        }

        const planConfig = PLANS[plan as keyof typeof PLANS];
        if (!planConfig) return;

        await prisma.tbl_User.updateMany({
          where: { User_Id: String(userId) },
          data: {
            Stripe_Customer_Id: customerId,
            Stripe_Subscription_Id: subscriptionId,
            Plan_Name: plan,
            Plan_Status: "active",
            Plan_Workers_Limit: planConfig.workersLimit,
            Plan_Employers_Limit: planConfig.employersLimit,
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const status = subscription.status;
        const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
        const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

        // Find user by subscription ID
        const user = await prisma.tbl_User.findFirst({
          where: { Stripe_Subscription_Id: subscription.id },
          select: { User_Id: true },
        });

        if (user) {
          const mappedStatus = status === "active" ? "active" : status === "trialing" ? "trialing" : status === "past_due" ? "past_due" : status;
          await prisma.tbl_User.updateMany({
            where: { User_Id: user.User_Id },
            data: {
              Plan_Status: mappedStatus,
              Plan_Current_Period_End: periodEnd,
              Plan_Trial_End: trialEnd,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;

        const user = await prisma.tbl_User.findFirst({
          where: { Stripe_Subscription_Id: subscription.id },
          select: { User_Id: true },
        });

        if (user) {
          await prisma.tbl_User.updateMany({
            where: { User_Id: user.User_Id },
            data: {
              Plan_Name: "free",
              Plan_Status: "cancelled",
              Plan_Workers_Limit: FREE_PLAN.workersLimit,
              Plan_Employers_Limit: FREE_PLAN.employersLimit,
              Stripe_Subscription_Id: null,
            },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
          const user = await prisma.tbl_User.findFirst({
            where: { Stripe_Subscription_Id: subscriptionId },
            select: { User_Id: true },
          });

          if (user) {
            await prisma.tbl_User.updateMany({
              where: { User_Id: user.User_Id },
              data: { Plan_Status: "past_due" },
            });
          }
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[Stripe Webhook] Error processing event:", err);
  }
}
