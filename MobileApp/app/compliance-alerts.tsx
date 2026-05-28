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

type ComplianceAlert = {
  Id: number;
  Worker_Id: string;
  Worker_Name?: string | null;
  Employer_Id?: string | null;
  Alert_Type: string;
  Severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  Days_Until_Expiry?: number | null;
  Document_Type: string;
  Expiry_Date?: string | null;
  Is_Resolved: boolean;
  Created_At: string;
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  CRITICAL: { color: "#ef4444", bg: "#fef2f2", icon: "exclamation-circle", label: "Critical" },
  HIGH: { color: "#f97316", bg: "#fff7ed", icon: "exclamation-triangle", label: "High" },
  MEDIUM: { color: "#f59e0b", bg: "#fffbeb", icon: "warning", label: "Medium" },
  LOW: { color: "#3b82f6", bg: "#eff6ff", icon: "info-circle", label: "Low" },
};

const FILTER_OPTIONS: Array<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"> = [
  "ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW",
];

export default function ComplianceAlertsScreen() {
  const router = useRouter();
  const api = useApiClient();
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("ALL");

  const fetchAlerts = useCallback(
    async () => {
      try {
        const query = filter !== "ALL" ? `?severity=${filter}&isResolved=false` : "?isResolved=false";
        const res = await api.get<{ success: boolean; data: ComplianceAlert[] }>(
          `/Api/Compliance/Alerts${query}`
        );
        setAlerts(res?.data ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, filter]
  );

  useEffect(() => {
    setLoading(true);
    fetchAlerts();
  }, [fetchAlerts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAlerts();
  }, [fetchAlerts]);

  const formatExpiry = (days: number | null | undefined): string => {
    if (days == null) return "Missing";
    if (days <= 0) return `Expired ${Math.abs(days)}d ago`;
    if (days === 0) return "Expires today";
    return `${days}d remaining`;
  };

  const formatDocType = (type: string): string =>
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const criticalCount = alerts.filter((a) => a.Severity === "CRITICAL").length;
  const highCount = alerts.filter((a) => a.Severity === "HIGH").length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="arrow-left" size={16} color="#6366f1" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Compliance Alerts</Text>
          <Text style={styles.headerSub}>
            {criticalCount > 0
              ? `${criticalCount} critical · ${highCount} high`
              : `${alerts.length} active alerts`}
          </Text>
        </View>
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryRow}>
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
          const cfg = SEVERITY_CONFIG[sev];
          const count = alerts.filter((a) => a.Severity === sev).length;
          return (
            <View key={sev} style={[styles.summaryItem, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.summaryCount, { color: cfg.color }]}>{count}</Text>
              <Text style={[styles.summaryLabel, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          );
        })}
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={alerts}
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
              <FontAwesome name="check-circle" size={48} color="#22c55e" />
              <Text style={styles.emptyTitle}>All Clear</Text>
              <Text style={styles.emptyText}>No compliance alerts for the selected filter.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = SEVERITY_CONFIG[item.Severity] ?? SEVERITY_CONFIG.LOW;
            return (
              <View style={[styles.card, { borderLeftColor: cfg.color }]}>
                <View style={[styles.iconBadge, { backgroundColor: cfg.bg }]}>
                  <FontAwesome name={cfg.icon as any} size={16} color={cfg.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.docType}>{formatDocType(item.Document_Type)}</Text>
                    <View style={[styles.severityBadge, { backgroundColor: cfg.color + "1a" }]}>
                      <Text style={[styles.severityText, { color: cfg.color }]}>
                        {cfg.label}
                      </Text>
                    </View>
                  </View>
                  {item.Worker_Name ? (
                    <Text style={styles.workerName}>{item.Worker_Name}</Text>
                  ) : null}
                  <Text style={[styles.expiryText, { color: cfg.color }]}>
                    {formatExpiry(item.Days_Until_Expiry)}
                  </Text>
                </View>
              </View>
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
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.07)",
  },
  summaryItem: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  summaryCount: { fontSize: 18, fontWeight: "900" },
  summaryLabel: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(15,23,42,0.07)",
  },
  filterPillActive: { backgroundColor: "#6366f1" },
  filterText: { fontSize: 12, fontWeight: "700", color: "rgba(15,23,42,0.6)" },
  filterTextActive: { color: "#ffffff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", marginTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: "#22c55e" },
  emptyText: { fontSize: 13, color: "rgba(15,23,42,0.5)", textAlign: "center", paddingHorizontal: 32 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  docType: { fontSize: 14, fontWeight: "800", color: "#0f172a", flex: 1 },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  severityText: { fontSize: 10, fontWeight: "800" },
  workerName: { fontSize: 12, color: "rgba(15,23,42,0.6)", marginTop: 2 },
  expiryText: { fontSize: 12, fontWeight: "700", marginTop: 4 },
});
