import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Card, Screen, SectionTitle } from "@/components/ui";

type HrmsSummaryRow = {
  workerId: string;
  name: string | null;
  daysPresent: number;
  workedHours: number;
  lateCount: number;
  earlyLeaveCount: number;
  overtimeRequestedHours: number;
  overtimeApprovedHours: number;
  expenseClaimed: number;
  expenseApproved: number;
};

type HrmsSummaryResponse = {
  from: string;
  to: string;
  rows: HrmsSummaryRow[];
};

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function HrmsReportScreen() {
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? session.claims?.role ?? "").toString();
  const isManager = appRole === "employer" || appRole === "agency" || appRole === "admin";

  const [from, setFrom] = useState<Date>(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 29);
    return d;
  });
  const [to, setTo] = useState<Date>(() => startOfDay(new Date()));
  const [picker, setPicker] = useState<null | "from" | "to">(null);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<HrmsSummaryRow[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!isManager) return;
    setLoading(true);
    try {
      const search = `?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
      const res = await api.get<HrmsSummaryResponse>(`/Api/HRMS/Reports/Summary${search}`);
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Unable to load HRMS report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, from, to, isManager]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.workerId ?? "").toLowerCase().includes(s) || (r.name ?? "").toLowerCase().includes(s));
  }, [q, rows]);

  const kpis = useMemo(() => {
    const workerCount = filtered.length;
    const totalDays = filtered.reduce((acc, r) => acc + Number(r.daysPresent ?? 0), 0);
    const totalHours = filtered.reduce((acc, r) => acc + Number(r.workedHours ?? 0), 0);
    const totalOtApproved = filtered.reduce((acc, r) => acc + Number(r.overtimeApprovedHours ?? 0), 0);
    const totalExpApproved = filtered.reduce((acc, r) => acc + Number(r.expenseApproved ?? 0), 0);
    return { workerCount, totalDays, totalHours, totalOtApproved, totalExpApproved };
  }, [filtered]);

  const onPickerChange = (which: "from" | "to") => (event: DateTimePickerEvent, date?: Date) => {
    setPicker(null);
    if (event.type !== "set" || !date) return;
    const day = startOfDay(date);
    if (which === "from") {
      setFrom(day);
      if (to < day) setTo(day);
    } else {
      setTo(day < from ? from : day);
    }
  };

  if (!isManager) {
    return (
      <Screen title="📈 HRMS Report" subtitle="Not available for this role" gradient={["#4f46e5", "#06b6d4", "#10b981"]}>
        <Card>
          <Text style={styles.muted}>ℹ️ The consolidated HRMS report is available to employers, agencies and admins.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="📈 HRMS Report"
      subtitle="Consolidated attendance, overtime and expenses"
      gradient={["#4f46e5", "#06b6d4", "#10b981"]}
      refreshing={loading}
      onRefresh={load}
    >
      <Card>
        <Text style={styles.label}>📅 Date range</Text>
        <View style={styles.dateRow}>
          <Pressable style={styles.dateField} onPress={() => setPicker("from")}>
            <Text style={styles.dateLabel}>From</Text>
            <Text style={styles.dateValue}>{formatDate(from)}</Text>
          </Pressable>
          <FontAwesome name="long-arrow-right" size={16} color="rgba(15,23,42,0.45)" style={{ marginHorizontal: 4 }} />
          <Pressable style={styles.dateField} onPress={() => setPicker("to")}>
            <Text style={styles.dateLabel}>To</Text>
            <Text style={styles.dateValue}>{formatDate(to)}</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { marginTop: 14 }]}>🔍 Search worker</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Worker ID or name"
          placeholderTextColor="rgba(15,23,42,0.4)"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {picker !== null && (
          <DateTimePicker
            value={picker === "from" ? from : to}
            mode="date"
            minimumDate={picker === "to" ? from : undefined}
            maximumDate={picker === "from" ? to : undefined}
            onChange={onPickerChange(picker)}
          />
        )}
      </Card>

      <View style={styles.kpiRow}>
        <KpiPill label="👥 Workers" value={String(kpis.workerCount)} gradient={["#0ea5e9", "#6366f1"]} />
        <KpiPill label="📅 Days" value={String(kpis.totalDays)} gradient={["#10b981", "#06b6d4"]} />
        <KpiPill label="⏱️ Hours" value={`${kpis.totalHours.toFixed(1)}h`} gradient={["#f59e0b", "#fb7185"]} />
      </View>
      <View style={styles.kpiRow}>
        <KpiPill label="🔥 OT" value={`${kpis.totalOtApproved.toFixed(1)}h`} gradient={["#ef4444", "#f97316"]} />
        <KpiPill label="💵 Exp" value={kpis.totalExpApproved.toFixed(2)} gradient={["#a855f7", "#ec4899"]} />
      </View>

      <SectionTitle title={`📜 Workers (${filtered.length})`} />

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="bar-chart" size={36} color="rgba(99,102,241,0.35)" />
          <Text style={styles.emptyText}>📭 No data for this range and filter.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((r) => (
            <WorkerRow key={r.workerId} row={r} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function KpiPill({ label, value, gradient }: { label: string; value: string; gradient: readonly [string, string] }) {
  return (
    <View style={styles.kpiPill}>
      <LinearGradient colors={gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function WorkerRow({ row }: { row: HrmsSummaryRow }) {
  const name = row.name ?? row.workerId;
  return (
    <Card tight>
      <View style={styles.rowHeader}>
        <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rowBadge}>
          <FontAwesome name="user" size={14} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{row.workerId}</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <Metric label="Days" value={String(row.daysPresent ?? 0)} />
        <Metric label="Hours" value={Number(row.workedHours ?? 0).toFixed(1)} />
        <Metric label="Late" value={String(row.lateCount ?? 0)} tone={Number(row.lateCount) > 0 ? "warn" : undefined} />
        <Metric label="Early" value={String(row.earlyLeaveCount ?? 0)} tone={Number(row.earlyLeaveCount) > 0 ? "warn" : undefined} />
        <Metric label="OT req" value={Number(row.overtimeRequestedHours ?? 0).toFixed(1)} />
        <Metric label="OT app" value={Number(row.overtimeApprovedHours ?? 0).toFixed(1)} tone="ok" />
        <Metric label="Exp" value={Number(row.expenseClaimed ?? 0).toFixed(2)} />
        <Metric label="Exp app" value={Number(row.expenseApproved ?? 0).toFixed(2)} tone="ok" />
      </View>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone === "ok" && styles.metricOk, tone === "warn" && styles.metricWarn]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: "rgba(15,23,42,0.65)", lineHeight: 19 },
  label: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },

  dateRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  dateField: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.18)",
    backgroundColor: "#ffffff",
  },
  dateLabel: { fontSize: 10, fontWeight: "800", color: "rgba(15,23,42,0.5)", textTransform: "uppercase", letterSpacing: 0.4 },
  dateValue: { marginTop: 4, fontSize: 13, fontWeight: "800", color: "#0f172a" },

  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.15)",
    paddingHorizontal: 14,
    marginTop: 8,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },

  kpiRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  kpiPill: {
    flex: 1,
    overflow: "hidden",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    minHeight: 70,
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  kpiLabel: { fontSize: 10, fontWeight: "900", color: "rgba(255,255,255,0.92)", letterSpacing: 0.6 },
  kpiValue: { marginTop: 4, fontSize: 16, fontWeight: "900", color: "#fff" },

  rowHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowBadge: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  rowSub: { marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.5)" },

  metricGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: {
    width: "23%",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "rgba(79,70,229,0.06)",
    alignItems: "center",
  },
  metricLabel: { fontSize: 10, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.3 },
  metricValue: { marginTop: 2, fontSize: 13, fontWeight: "900", color: "#0f172a" },
  metricOk: { color: "#047857" },
  metricWarn: { color: "#b45309" },

  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13, textAlign: "center" },
});
