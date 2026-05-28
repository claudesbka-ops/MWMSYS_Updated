import { prisma } from "../db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send a push notification to a single user via Expo Push Notifications.
 * Non-blocking — never throws to caller. Wrap in try/catch internally.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const row = await prisma.$queryRawUnsafe(
      `SELECT "Push_Token" FROM "Tbl_User" WHERE "User_Id" = $1 AND "Push_Token" IS NOT NULL LIMIT 1`,
      userId
    ) as Array<{ Push_Token: string | null }>;

    const token = row?.[0]?.Push_Token;
    if (!token || !token.startsWith("ExponentPushToken[")) return;

    await sendPushNotification(token, title, body, data);
  } catch {
    // Non-blocking — push failures must never affect main flow
  }
}

/**
 * Send a push notification to multiple users (fan-out).
 * Chunks into batches of 100 as per Expo API limits.
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!userIds.length) return;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "Push_Token" FROM "Tbl_User" WHERE "User_Id" = ANY($1::text[]) AND "Push_Token" IS NOT NULL`,
      userIds
    ) as Array<{ Push_Token: string | null }>;

    const tokens = (rows ?? [])
      .map((r) => r.Push_Token)
      .filter((t): t is string => typeof t === "string" && t.startsWith("ExponentPushToken["));

    if (!tokens.length) return;

    // Fan-out in batches of 100
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100).map((to) => ({
        to,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }));
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Low-level: send to a known Expo push token directly.
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }),
    });
  } catch {
    // Non-blocking
  }
}
