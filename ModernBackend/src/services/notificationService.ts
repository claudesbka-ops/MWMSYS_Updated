import { prisma } from "../db";

export type NotificationType =
  | "doc_expiry"
  | "risk_critical"
  | "dispute_reminder"
  | "compliance_low"
  | "leave_approved"
  | "bulk_import";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}

/**
 * Check if a similar notification was sent to this user within last 24 hours.
 * Prevents duplicate alerts for the same event.
 */
export async function hasRecentNotification(
  userId: string,
  type: NotificationType,
  referenceId?: string
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const where: any = {
    User_Id: userId,
    Type: type,
    Created_At: { gte: since },
  };

  // If referenceId provided, check Message contains it
  if (referenceId) {
    where.Message = { contains: referenceId };
  }

  const existing = await prisma.tbl_Notifications.findFirst({
    where,
  });

  return !!existing;
}

/**
 * Create in-app notification. Checks for duplicates first.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<{ id: number; created: boolean }> {
  // Check for duplicates
  const isDuplicate = await hasRecentNotification(
    input.userId,
    input.type,
    extractReferenceId(input.message)
  );

  if (isDuplicate) {
    return { id: 0, created: false };
  }

  const notification = await prisma.tbl_Notifications.create({
    data: {
      User_Id: input.userId,
      Type: input.type,
      Title: input.title,
      Message: input.message,
      Action_Url: input.actionUrl || null,
      Is_Read: false,
    },
  });

  return { id: notification.Id, created: true };
}

/**
 * Get notifications for a user, newest first.
 */
export async function getNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {}
): Promise<any[]> {
  const { unreadOnly = false, limit = 20 } = options;

  return prisma.tbl_Notifications.findMany({
    where: {
      User_Id: userId,
      ...(unreadOnly && { Is_Read: false }),
    },
    orderBy: { Created_At: "desc" },
    take: limit,
  });
}

/**
 * Get unread count for badge.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.tbl_Notifications.count({
    where: {
      User_Id: userId,
      Is_Read: false,
    },
  });
}

/**
 * Mark single notification as read.
 */
export async function markAsRead(
  notificationId: number,
  userId: string
): Promise<boolean> {
  const result = await prisma.tbl_Notifications.updateMany({
    where: {
      Id: notificationId,
      User_Id: userId,
    },
    data: {
      Is_Read: true,
      Read_At: new Date(),
    },
  });

  return result.count > 0;
}

/**
 * Mark all notifications as read for user.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.tbl_Notifications.updateMany({
    where: {
      User_Id: userId,
      Is_Read: false,
    },
    data: {
      Is_Read: true,
      Read_At: new Date(),
    },
  });

  return result.count;
}

// ==================== PREFERENCES ====================

export interface NotificationPreferences {
  emailDocExpiry: boolean;
  emailComplianceAlerts: boolean;
  emailDisputes: boolean;
  emailRiskCritical: boolean;
  emailLeaveUpdates: boolean;
  inAppEnabled: boolean;
  alertDaysBefore: number;
}

/**
 * Get or create default preferences for user.
 */
export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  let prefs = await prisma.tbl_Notification_Preferences.findUnique({
    where: { User_Id: userId },
  });

  if (!prefs) {
    // Create default preferences
    prefs = await prisma.tbl_Notification_Preferences.create({
      data: {
        User_Id: userId,
        Email_Doc_Expiry: true,
        Email_Compliance_Alerts: true,
        Email_Disputes: true,
        Email_Risk_Critical: true,
        Email_Leave_Updates: true,
        In_App_Enabled: true,
        Alert_Days_Before: 30,
      },
    });
  }

  return {
    emailDocExpiry: prefs.Email_Doc_Expiry,
    emailComplianceAlerts: prefs.Email_Compliance_Alerts,
    emailDisputes: prefs.Email_Disputes,
    emailRiskCritical: prefs.Email_Risk_Critical,
    emailLeaveUpdates: prefs.Email_Leave_Updates,
    inAppEnabled: prefs.In_App_Enabled,
    alertDaysBefore: prefs.Alert_Days_Before,
  };
}

/**
 * Update user preferences.
 */
export async function updatePreferences(
  userId: string,
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  await prisma.tbl_Notification_Preferences.upsert({
    where: { User_Id: userId },
    update: {
      ...(updates.emailDocExpiry !== undefined && { Email_Doc_Expiry: updates.emailDocExpiry }),
      ...(updates.emailComplianceAlerts !== undefined && { Email_Compliance_Alerts: updates.emailComplianceAlerts }),
      ...(updates.emailDisputes !== undefined && { Email_Disputes: updates.emailDisputes }),
      ...(updates.emailRiskCritical !== undefined && { Email_Risk_Critical: updates.emailRiskCritical }),
      ...(updates.emailLeaveUpdates !== undefined && { Email_Leave_Updates: updates.emailLeaveUpdates }),
      ...(updates.inAppEnabled !== undefined && { In_App_Enabled: updates.inAppEnabled }),
      ...(updates.alertDaysBefore !== undefined && { Alert_Days_Before: updates.alertDaysBefore }),
      Updated_At: new Date(),
    },
    create: {
      User_Id: userId,
      Email_Doc_Expiry: updates.emailDocExpiry ?? true,
      Email_Compliance_Alerts: updates.emailComplianceAlerts ?? true,
      Email_Disputes: updates.emailDisputes ?? true,
      Email_Risk_Critical: updates.emailRiskCritical ?? true,
      Email_Leave_Updates: updates.emailLeaveUpdates ?? true,
      In_App_Enabled: updates.inAppEnabled ?? true,
      Alert_Days_Before: updates.alertDaysBefore ?? 30,
    },
  });

  return getPreferences(userId);
}

// ==================== HELPERS ====================

function extractReferenceId(message: string): string | undefined {
  // Extract worker/employer ID from message if present
  // Pattern: [ID: xxx] or just look for common ID patterns
  const match = message.match(/\[ID:\s*([^\]]+)\]/);
  return match?.[1];
}
