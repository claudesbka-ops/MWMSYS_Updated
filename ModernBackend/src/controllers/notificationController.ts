import { Request, Response } from "express";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
} from "../services/notificationService";
import { sendNotificationEmail } from "../services/emailService";

/**
 * GET /Api/Notifications/List
 * Get notifications for the authenticated user.
 */
export async function listNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const unreadOnly = req.query.unread === "true";
    const limit = parseInt(req.query.limit as string) || 20;

    const notifications = await getNotifications(userId, { unreadOnly, limit });

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("[notificationController] listNotifications error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
}

/**
 * GET /Api/Notifications/UnreadCount
 * Get unread notification count for badge.
 */
export async function getUnreadCountHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const count = await getUnreadCount(userId);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("[notificationController] getUnreadCount error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch unread count" });
  }
}

/**
 * PATCH /Api/Notifications/:id/Read
 * Mark a single notification as read.
 */
export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const notificationId = parseInt(req.params.id);
    if (isNaN(notificationId)) {
      res.status(400).json({ success: false, error: "Invalid notification ID" });
      return;
    }

    const success = await markAsRead(notificationId, userId);

    if (!success) {
      res.status(404).json({ success: false, error: "Notification not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[notificationController] markNotificationRead error:", error);
    res.status(500).json({ success: false, error: "Failed to mark notification as read" });
  }
}

/**
 * PATCH /Api/Notifications/ReadAll
 * Mark all notifications as read.
 */
export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const count = await markAllAsRead(userId);

    res.json({
      success: true,
      markedRead: count,
    });
  } catch (error) {
    console.error("[notificationController] markAllNotificationsRead error:", error);
    res.status(500).json({ success: false, error: "Failed to mark notifications as read" });
  }
}

/**
 * GET /Api/Notifications/Preferences
 * Get notification preferences for the user.
 */
export async function getNotificationPreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const prefs = await getPreferences(userId);

    res.json({
      success: true,
      data: prefs,
    });
  } catch (error) {
    console.error("[notificationController] getNotificationPreferences error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch preferences" });
  }
}

/**
 * PUT /Api/Notifications/Preferences
 * Update notification preferences.
 */
export async function updateNotificationPreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const updates = req.body;
    const prefs = await updatePreferences(userId, updates);

    res.json({
      success: true,
      data: prefs,
    });
  } catch (error) {
    console.error("[notificationController] updateNotificationPreferences error:", error);
    res.status(500).json({ success: false, error: "Failed to update preferences" });
  }
}

/**
 * POST /Api/Notifications/TestEmail
 * Send a test email (admin only).
 */
export async function sendTestEmail(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.appRole;

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // Only admin can send test emails
    if (userRole !== "admin" && userRole !== 1) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: "Email required" });
      return;
    }

    const result = await sendNotificationEmail(email, "doc_expiry", {
      workerName: "Test Worker",
      docType: "Passport",
      daysRemaining: 7,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toDateString(),
    });

    res.json({
      success: true,
      sent: result.sent,
      fallback: result.fallback,
    });
  } catch (error) {
    console.error("[notificationController] sendTestEmail error:", error);
    res.status(500).json({ success: false, error: "Failed to send test email" });
  }
}
