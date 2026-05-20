import { useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { NotificationDropdown } from "./NotificationDropdown";

interface Notification {
  Id: number;
  Type: string;
  Title: string;
  Message: string;
  Is_Read: boolean;
  Action_Url?: string;
  Created_At: string;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: async () => {
      const response = await apiClient.get("/Api/Notifications/UnreadCount");
      return response.data.count || 0;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      const response = await apiClient.get("/Api/Notifications/List?limit=10");
      return response.data.data || [];
    },
    enabled: isOpen,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/Api/Notifications/${id}/Read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch("/Api/Notifications/ReadAll");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleMarkAsRead = (id: number) => {
    markAsReadMutation.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-2xl hover:bg-muted/60 transition-colors premium-ring premium-hover"
        title="Notifications"
      >
        <Bell className="w-[18px] h-[18px] text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <NotificationDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
      />
    </div>
  );
}
