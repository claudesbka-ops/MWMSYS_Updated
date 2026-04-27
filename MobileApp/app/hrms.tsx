import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Card, Screen, SectionTitle } from "@/components/ui";

type Tile = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  gradient: readonly [string, string];
  href: string;
  badge?: string | null;
  hidden?: boolean;
};

type OvertimeRow = { id: number; status: string; hours?: number | null };
type ExpenseRow = { id: number; status: string; amount?: number | null };
type ContractsExpiring = { rows?: Array<unknown> };

export default function HrmsHubScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? session.claims?.role ?? "worker").toString();

  const isWorker = appRole === "worker";
  const isManager = appRole === "employer" || appRole === "agency";

  const [loading, setLoading] = useState(false);
  const [overtime, setOvertime] = useState<OvertimeRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [contracts, setContracts] = useState<unknown[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const otPath = isWorker ? "/Api/HRMS/Overtime/me" : "/Api/HRMS/Overtime";
      const expPath = isWorker ? "/Api/HRMS/Expenses/me" : "/Api/HRMS/Expenses";
      const tasks: Array<Promise<unknown>> = [
        api.get<OvertimeRow[]>(otPath).then((res) => setOvertime(Array.isArray(res) ? res : [])).catch(() => undefined),
        api.get<ExpenseRow[]>(expPath).then((res) => setExpenses(Array.isArray(res) ? res : [])).catch(() => undefined),
      ];
      if (isManager) {
        tasks.push(
          api.get<ContractsExpiring>("/Api/HRMS/Contracts/Expiring?days=90")
            .then((res) => setContracts(Array.isArray(res?.rows) ? (res.rows as unknown[]) : []))
            .catch(() => undefined)
        );
      }
      await Promise.all(tasks);
    } finally {
      setLoading(false);
    }
  }, [api, isWorker, isManager]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const pendingOvertime = overtime.filter((r) => String(r.status) === "Pending").length;
  const pendingExpenses = expenses.filter((r) => String(r.status) === "Pending").length;
  const approvedOvertimeHours = overtime
    .filter((r) => String(r.status) === "Approved")
    .reduce((acc, r) => acc + Number(r.hours ?? 0), 0);
  const approvedExpenseAmount = expenses
    .filter((r) => String(r.status) === "Approved")
    .reduce((acc, r) => acc + Number(r.amount ?? 0), 0);

  const tiles: Tile[] = useMemo(() => [
    {
      key: "attendance",
      title: "Attendance",
      description: "Clock-in/out, worked hours, late and early flags",
      icon: "clock-o",
      gradient: ["#10b981", "#06b6d4"],
      href: "/(tabs)/attendance",
      hidden: !isManager && !isWorker,
    },
    {
      key: "requests",
      title: isWorker ? "My Requests" : "Requests",
      description: isWorker ? "Submit overtime and expense claims" : "Approve overtime and expense claims",
      icon: "check-circle",
      gradient: ["#6366f1", "#8b5cf6"],
      href: "/(tabs)/requests",
      badge: String(pendingOvertime + pendingExpenses),
    },
    {
      key: "leave",
      title: "Leave",
      description: isWorker ? "Apply for leave" : "Approve leave requests",
      icon: "calendar",
      gradient: ["#f59e0b", "#fb923c"],
      href: "/(tabs)/leave",
    },
    {
      key: "roster",
      title: "Roster",
      description: "Shift templates and assignments",
      icon: "calendar-o",
      gradient: ["#6366f1", "#ec4899"],
      href: "/roster",
      hidden: !isManager,
    },
    {
      key: "timesheets",
      title: "Timesheets",
      description: "Planned vs actual hours and overtime",
      icon: "table",
      gradient: ["#0ea5e9", "#6366f1"],
      href: "/timesheets",
      hidden: !isManager,
    },
    {
      key: "payroll",
      title: "Payroll",
      description: "Upload vouchers and track payments",
      icon: "money",
      gradient: ["#059669", "#10b981"],
      href: "/(tabs)/payroll",
      hidden: !isManager,
    },
    {
      key: "contracts",
      title: "Contracts",
      description: "Expiring contracts in the next 90 days",
      icon: "file-text",
      gradient: ["#f59e0b", "#fb7185"],
      href: "/(tabs)/contracts",
      hidden: !isManager,
      badge: isManager ? String(contracts.length) : null,
    },
    {
      key: "report",
      title: "HRMS Report",
      description: "Consolidated attendance, overtime and expenses",
      icon: "bar-chart",
      gradient: ["#4f46e5", "#06b6d4"],
      href: "/(tabs)/hrms-report",
      hidden: !isManager,
    },
  ], [isWorker, isManager, pendingOvertime, pendingExpenses, contracts.length]);

  const visible = tiles.filter((t) => !t.hidden);

  return (
    <Screen
      title="HRMS"
      subtitle={isWorker ? "Your attendance, requests and documents" : "Operations dashboard for attendance, approvals and reporting"}
      gradient={["#6366f1", "#8b5cf6", "#06b6d4"]}
      refreshing={loading}
      onRefresh={load}
    >
      {/* KPI strip */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>{isWorker ? "Pending (yours)" : "Pending approvals"}</Text>
          <Text style={styles.kpiValue}>{pendingOvertime + pendingExpenses}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Approved overtime</Text>
          <Text style={styles.kpiValue}>{approvedOvertimeHours.toFixed(1)}h</Text>
        </View>
      </View>
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Approved expenses</Text>
          <Text style={styles.kpiValue}>{approvedExpenseAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Contracts expiring (90d)</Text>
          <Text style={styles.kpiValue}>{isManager ? String(contracts.length) : "—"}</Text>
        </View>
      </View>

      <SectionTitle title={`${visible.length} tools`} />

      {loading && overtime.length === 0 && expenses.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : (
        <View style={styles.grid}>
          {visible.map((t) => (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.88}
              onPress={() => router.push(t.href as any)}
              style={styles.tile}
            >
              <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tileIcon}>
                <FontAwesome name={t.icon} size={16} color="white" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <View style={styles.tileTitleRow}>
                  <Text style={styles.tileTitle}>{t.title}</Text>
                  {t.badge && t.badge !== "0" ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{t.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.tileDesc}>{t.description}</Text>
              </View>
              <FontAwesome name="chevron-right" size={12} color="rgba(15,23,42,0.3)" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.back} onPress={() => router.back()}>Back</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  kpiCard: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(99,102,241,0.12)",
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    marginBottom: 10,
  },
  kpiLabel: { fontSize: 10, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.3, textTransform: "uppercase" },
  kpiValue: { marginTop: 4, fontSize: 22, fontWeight: "900", color: "#0f172a" },

  grid: { gap: 10 },
  tile: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 14, borderRadius: 18,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(99,102,241,0.1)",
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  tileIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tileTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tileTitle: { fontSize: 14, fontWeight: "900", color: "#0f172a" },
  tileDesc: { marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.6)", fontWeight: "600" },

  badge: {
    minWidth: 22, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999, backgroundColor: "#ef4444",
    alignItems: "center", justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "900", color: "white" },

  back: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
