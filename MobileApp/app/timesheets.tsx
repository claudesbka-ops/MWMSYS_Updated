import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Card, Screen, SectionTitle } from "@/components/ui";

type TimesheetSummaryRow = {
  workerId: string;
  name: string | null;
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
  days: number;
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function weekRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from: isoDate(from), to: isoDate(to) };
}

export default function TimesheetsScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? session.claims?.role ?? "worker").toString();
  const isManager = appRole === "employer" || appRole === "agency" || appRole === "admin";

  const [{ from, to }, setRange] = useState(weekRange());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TimesheetSummaryRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/Api/HRMS/Timesheets?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await api.get<{ rows: TimesheetSummaryRow[] }>(url);
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to load timesheets");
    } finally {
      setLoading(false);
    }
  }, [api, from, to]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.workerId ?? "").toLowerCase().includes(s) || (r.name ?? "").toLowerCase().includes(s));
  }, [rows, q]);

  const kpis = useMemo(() => {
    const planned = rows.reduce((acc, r) => acc + Number(r.plannedHours ?? 0), 0);
    const actual = rows.reduce((acc, r) => acc + Number(r.actualHours ?? 0), 0);
    const overtime = rows.reduce((acc, r) => acc + Number(r.overtimeHours ?? 0), 0);
    return { planned, actual, overtime };
  }, [rows]);

  if (!isManager) {
    return (
      <Screen title="Timesheets" subtitle="Not available for this role" gradient={["#0ea5e9", "#6366f1"]}>
        <Card>
          <Text style={styles.muted}>Timesheets are visible to employers, agencies and admins.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="Timesheets"
      subtitle="Planned vs actual hours"
      gradient={["#0ea5e9", "#6366f1", "#8b5cf6"]}
      refreshing={loading}
      onRefresh={load}
    >
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{kpis.planned.toFixed(1)}h</Text>
          <Text style={styles.statLabel}>Planned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{kpis.actual.toFixed(1)}h</Text>
          <Text style={styles.statLabel}>Actual</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, kpis.overtime > 0 ? { color: "#f59e0b" } : null]}>{kpis.overtime.toFixed(1)}h</Text>
          <Text style={styles.statLabel}>Overtime</Text>
        </View>
      </View>

      <SectionTitle title="Date range" />
      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>From</Text>
            <TextInput value={from} onChangeText={(v) => setRange((r) => ({ ...r, from: v }))} style={styles.input} autoCapitalize="none" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>To</Text>
            <TextInput value={to} onChangeText={(v) => setRange((r) => ({ ...r, to: v }))} style={styles.input} autoCapitalize="none" />
          </View>
        </View>
        <View style={styles.quickRow}>
          {[
            { label: "This week", build: weekRange },
            { label: "Last 30d", build: () => { const t = new Date(); const f = new Date(); f.setDate(t.getDate() - 30); return { from: isoDate(f), to: isoDate(t) }; } },
            { label: "Today", build: () => { const t = new Date(); return { from: isoDate(t), to: isoDate(t) }; } },
          ].map((q) => (
            <TouchableOpacity key={q.label} activeOpacity={0.85} onPress={() => setRange(q.build())} style={styles.quickPill}>
              <Text style={styles.quickPillText}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <SectionTitle title="Filter" />
      <Card>
        <Text style={styles.label}>Search worker</Text>
        <TextInput value={q} onChangeText={setQ} style={styles.input} placeholder="ID or name" placeholderTextColor="rgba(15,23,42,0.4)" />
      </Card>

      <SectionTitle title={`${filtered.length} ${filtered.length === 1 ? "worker" : "workers"}`} />
      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No timesheet rows for this range.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((r) => (
            <Card key={`${r.workerId}-${r.days}`} tight>
              <Text style={styles.cardTitle}>{r.name ?? r.workerId}</Text>
              <Text style={styles.cardSub}>{r.workerId} · {r.days} day{r.days === 1 ? "" : "s"}</Text>
              <View style={styles.amountRow}>
                <View style={styles.amountCol}>
                  <Text style={styles.amountLabel}>Planned</Text>
                  <Text style={styles.amountValue}>{Number(r.plannedHours ?? 0).toFixed(1)}h</Text>
                </View>
                <View style={styles.amountCol}>
                  <Text style={styles.amountLabel}>Actual</Text>
                  <Text style={styles.amountValue}>{Number(r.actualHours ?? 0).toFixed(1)}h</Text>
                </View>
                <View style={styles.amountCol}>
                  <Text style={styles.amountLabel}>Overtime</Text>
                  <Text style={[styles.amountValue, Number(r.overtimeHours ?? 0) > 0 ? { color: "#f59e0b" } : null]}>{Number(r.overtimeHours ?? 0).toFixed(1)}h</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      <Text style={styles.back} onPress={() => router.back()}>Back</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: "rgba(15,23,42,0.65)", fontSize: 13, lineHeight: 19 },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(14,165,233,0.18)",
    shadowColor: "#0ea5e9", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0f172a" },
  statLabel: { marginTop: 2, fontSize: 11, fontWeight: "700", color: "rgba(15,23,42,0.55)", letterSpacing: 0.3, textTransform: "uppercase" },

  label: { marginTop: 12, fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(14,165,233,0.2)",
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 8,
    backgroundColor: "#ffffff", color: "#0f172a",
  },
  row: { flexDirection: "row", gap: 10 },
  quickRow: { marginTop: 14, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  quickPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(14,165,233,0.1)" },
  quickPillText: { fontSize: 11, fontWeight: "800", color: "#0ea5e9" },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13 },

  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  cardSub: { marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.6)", fontWeight: "600" },
  amountRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  amountCol: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: "rgba(14,165,233,0.06)" },
  amountLabel: { fontSize: 10, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.3, textTransform: "uppercase" },
  amountValue: { marginTop: 4, fontSize: 14, fontWeight: "900", color: "#0f172a" },

  back: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
