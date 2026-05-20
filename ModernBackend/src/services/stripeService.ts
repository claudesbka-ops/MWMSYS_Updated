import Stripe from "stripe";
import { prisma } from "../db";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" }) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const PLANS = {
  starter: {
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER,
    workersLimit: 10,
    employersLimit: 1,
    price: 49,
  },
  growth: {
    name: "Growth",
    priceId: process.env.STRIPE_PRICE_GROWTH,
    workersLimit: 50,
    employersLimit: 5,
    price: 149,
  },
  enterprise: {
    name: "Enterprise",
    priceId: process.env.STRIPE_PRICE_ENTERPRISE,
    workersLimit: 999999,
    employersLimit: 999999,
    price: 499,
  },
};

export const FREE_PLAN = {
  name: "free",
  workersLimit: 5,
  employersLimit: 1,
};

export function isStripeConfigured(): boolean {
  return !!stripe && !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe | null {
  return stripe;
}

export function getWebhookSecret(): string | undefined {
  return webhookSecret;
}

export type PlanType = "starter" | "growth" | "enterprise" | "free";

export interface PlanLimits {
  workersLimit: number;
  employersLimit: number;
}

export function getPlanLimits(plan: PlanType): PlanLimits {
  if (plan === "free" || !plan) return FREE_PLAN;
  return PLANS[plan] || FREE_PLAN;
}

export interface PlanLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
}

export async function checkPlanLimit(
  userId: string,
  limitType: "workers" | "employers"
): Promise<PlanLimitResult> {
  // Get the user's plan limits
  const user = await prisma.tbl_User.findFirst({
    where: { User_Id: userId },
    select: {
      Plan_Name: true,
      Plan_Workers_Limit: true,
      Plan_Employers_Limit: true,
    },
  });

  const planName = (user?.Plan_Name as PlanType) || "free";
  const limits = getPlanLimits(planName);

  let current = 0;
  let limit = 0;

  if (limitType === "workers") {
    limit = user?.Plan_Workers_Limit ?? FREE_PLAN.workersLimit;
    // Count workers linked to this employer/agency
    const [personalCount, linkCount] = await Promise.all([
      prisma.tbl_Worker_PersonalInfo.count({
        where: { Employer_Id: userId },
      }),
      prisma.tbl_Worker_EmployerLink.count({
        where: { employerId: userId, status: "Active" },
      }),
    ]);
    current = Math.max(personalCount, linkCount);
  } else if (limitType === "employers") {
    limit = user?.Plan_Employers_Limit ?? FREE_PLAN.employersLimit;
    // Count employers linked to this agency
    const linkCount = await prisma.tbl_Agency_Employer_Link.count({
      where: { agencyId: userId },
    });
    current = linkCount;
  }

  return {
    allowed: current < limit,
    current,
    limit,
  };
}
