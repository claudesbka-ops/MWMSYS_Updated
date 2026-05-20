import { useEffect, useRef } from "react";
import { Check, CheckCheck, ExternalLink, Clock, AlertTriangle, FileWarning, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Notification {
  Id: number;
  Type: string;
  Title: string;
  Message: string;
  Is_Read: boolean;
  Action_Url?: string;
  Created_At: string;
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
}

const notificationIcons: Record<string, React.ReactNode> = {
  doc_expiry: <Clock className="w-4 h-4 text-amber-500" />,
  risk_critical: <AlertTriangle className="w-4 h-4 text-red-500" />,
  dispute_reminder: <FileWarning className="w-4 h-4 text-orange-500" />,
  compliance_low: <ShieldAlert className="w-4 h-4 text-purple-500" />,
};

export function NotificationDropdown({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.Is_Read) {
      onMarkAsRead(notification.Id);
    }
    if (notification.Action_Url) {
      navigate(notification.Action_Url);
    }
    onClose();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter((n) => !n.Is_Read).length;

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-96 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-sm">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            No notifications yet
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <div
                key={notification.Id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors group",
                  !notification.Is_Read && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    {notificationIcons[notification.Type] || (
                      <div className="w-4 h-4 rounded-full bg-primary/20" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        !notification.Is_Read && "text-foreground"
                      )}
                    >
                      {notification.Title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.Message}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(notification.Created_At)}
                      </span>
                      {notification.Action_Url && (
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!notification.Is_Read && (
                    <div className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                  )}

                  {/* Mark as read button */}
                  {!notification.Is_Read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkAsRead(notification.Id);
                      }}
                      className="mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-muted/30">
        <button
          onClick={() => {
            navigate("/notification-settings");
            onClose();
          }}
          className="text-xs text-primary hover:text-primary/80 transition-colors w-full text-center"
        >
          Notification Settings
        </button>
      </div>
    </div>
  );
}
