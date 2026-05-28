import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../db";

export const mobileRouter = Router();

/**
 * POST /Api/Mobile/RegisterPushToken
 * Store Expo push token for the authenticated user.
 * Body: { token: string, platform: "ios" | "android" }
 */
mobileRouter.post("/Api/Mobile/RegisterPushToken", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    const userId = (user?.userKey ?? "").toString().trim();
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const token = (req.body?.token ?? "").toString().trim();
    const platform = (req.body?.platform ?? "").toString().toLowerCase();

    if (!token) return res.status(400).json({ error: "token is required" });
    if (!token.startsWith("ExponentPushToken[")) {
      return res.status(400).json({ error: "Invalid Expo push token format" });
    }
    if (platform && platform !== "ios" && platform !== "android") {
      return res.status(400).json({ error: "platform must be ios or android" });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "Tbl_User" SET "Push_Token" = $1, "Push_Platform" = $2 WHERE "User_Id" = $3`,
      token,
      platform || null,
      userId
    );

    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});
