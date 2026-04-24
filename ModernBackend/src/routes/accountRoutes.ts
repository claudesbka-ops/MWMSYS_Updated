import { Router } from "express";

import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { ensureSubscriptionTableExists } from "../middleware/subscription";

export const accountRouter = Router();

/**
 * GET /Api/Account/Profile
 *
 * Returns a lightweight profile snapshot for the authenticated user along
 * with their current subscription plan (for the subscription badge on the
 * Account page). Batch D adds the subscription field; Batch E will extend
 * the response with editable profile fields.
 */
accountRouter.get("/Api/Account/Profile", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as {
      userKey?: string;
      roleId?: number;
      appRole?: string;
      emailId?: string;
      userName?: string;
    };

    const userKey = (user?.userKey ?? "").toString().trim();
    const roleId = user?.roleId != null ? Number(user.roleId) : null;

    let planType: string = "Free";
    let planStatus: string = "Active";
    let planEndDate: Date | null = null;

    if (userKey && (roleId === 3 || roleId === 4)) {
      await ensureSubscriptionTableExists();
      const now = new Date();
      const active = await prisma.tbl_Subscription.findFirst({
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
  } catch (e) {
    return next(e);
  }
});
