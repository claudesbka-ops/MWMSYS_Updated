import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useApiClient } from "../services/apiClient";

type Notification = {
  Id: number;
  Title: string;
  Message: string;
  Type: string;
  Is_Read: boolean;
  Created_At: string;
  Action_Url?: string | null;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const api = useApiClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Notification[] }>(
        "/Api/Notifications/List?limit=50"
      );
      setNotifications(res?.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await api.patch("/Api/Notifications/ReadAll", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, Is_Read: true })));
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const markOne = async (id: number) => {
    try {
      await api.patch(`/Api/Notifications/${id}/Read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.Id === id ? { ...n, Is_Read: true } : n))
      );
    } catch {
      // ignore
    }
  };

  const getTypeColor = (type: string): string => {
    if (type === "risk_critical") return "#ef4444";
    if (type === "compliance_low") return "#f59e0b";
    if (type === "leave_approved") return "#22c55e";
    if (type === "dispute_reminder") return "#8b5cf6";
    return "#6366f1";
  };

  const getTypeIcon = (type: string): string => {
    if (type === "risk_critical") return "exclamation-triangle";
    if (type === "compliance_low") return "shield";
    if (type === "leave_approved") return "calendar-check-o";
    if (type === "dispute_reminder") return "balance-scale";
    return "bell";
  };

  const formatTime = (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  };

  const unreadCount = notifications.filter((n) => !n.Is_Read).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="arrow-left" size={16} color="#6366f1" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAll}
            disabled={markingAll}
            style={styles.markAllBtn}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.Id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366f1"
              colors={["#6366f1"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="bell-o" size={48} color="rgba(15,23,42,0.2)" />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = getTypeColor(item.Type);
            const icon = getTypeIcon(item.Type);
            return (
              <TouchableOpacity
                style={[styles.card, !item.Is_Read && styles.cardUnread]}
                onPress={() => markOne(item.Id)}
                activeOpacity={0.85}
              >
                <View style={[styles.iconBadge, { backgroundColor: color + "1a" }]}>
                  <FontAwesome name={icon as any} size={16} color={color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>{item.Title}</Text>
                  <Text style={styles.cardMessage}>{item.Message}</Text>
                  <Text style={styles.cardTime}>{formatTime(item.Created_At)}</Text>
                </View>
                {!item.Is_Read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.07)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(99,102,241,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  headerSub: { fontSize: 12, color: "rgba(15,23,42,0.5)", marginTop: 1 },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(99,102,241,0.1)",
    minWidth: 80,
    alignItems: "center",
  },
  markAllText: { fontSize: 12, fontWeight: "700", color: "#6366f1" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: "rgba(15,23,42,0.4)", fontWeight: "600" },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: "#6366f1",
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 2 },
  cardMessage: { fontSize: 13, color: "rgba(15,23,42,0.65)", lineHeight: 18 },
  cardTime: { fontSize: 11, color: "rgba(15,23,42,0.4)", marginTop: 4, fontWeight: "600" },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366f1",
    marginTop: 4,
    flexShrink: 0,
  },
});
