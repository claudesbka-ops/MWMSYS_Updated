import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listNotifications,
  getUnreadCountHandler,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTestEmail,
} from "../controllers/notificationController";

const router = Router();

// Pattern 1: Full explicit paths (mounted in index.ts)

// List notifications
router.get("/Api/Notifications/List", requireAuth, listNotifications);

// Get unread count
router.get("/Api/Notifications/UnreadCount", requireAuth, getUnreadCountHandler);

// Mark single notification as read
router.patch("/Api/Notifications/:id/Read", requireAuth, markNotificationRead);

// Mark all notifications as read
router.patch("/Api/Notifications/ReadAll", requireAuth, markAllNotificationsRead);

// Get notification preferences
router.get("/Api/Notifications/Preferences", requireAuth, getNotificationPreferences);

// Update notification preferences
router.put("/Api/Notifications/Preferences", requireAuth, updateNotificationPreferences);

// Send test email (admin only)
router.post("/Api/Notifications/TestEmail", requireAuth, sendTestEmail);

export { router as notificationRouter };
