import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { Screen, ListItemCard, PrimaryButton, SectionTitle } from "@/components/ui";

type ReportKind = "entry" | "visa" | "insurance" | "hrms";

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

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return { from: isoDate(from), to: isoDate(to) };
}

export default function ReportsScreen() {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportKind>("entry");
  const [days, setDays] = useState("90");
  const [rows, setRows] = useState<any[]>([]);
  const [hrmsRange, setHrmsRange] = useState(defaultRange());

  const load = async () => {
    setLoading(true);
    try {
      if (report === "entry") {
        const res = await api.get<any[]>("/api/reports/entry");
        setRows(Array.isArray(res) ? res : []);
      } else if (report === "visa") {
        const res = await api.get<any>(`/api/reports/visa-expire?days=${encodeURIComponent(days)}`);
        setRows(Array.isArray(res?.rows) ? res.rows : []);
      } else if (report === "insurance") {
        const res = await api.get<any>(`/api/reports/insurance-expire?days=${encodeURIComponent(days)}`);
        setRows(Array.isArray(res?.rows) ? res.rows : []);
      } else {
        const url = `/Api/HRMS/Reports/Summary?from=${encodeURIComponent(hrmsRange.from)}&to=${encodeURIComponent(hrmsRange.to)}`;
        const res = await api.get<{ rows: HrmsSummaryRow[] }>(url);
        setRows(Array.isArray(res?.rows) ? res.rows : []);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [report, hrmsRange.from, hrmsRange.to]);

  const tabs: Array<{ key: ReportKind; label: string; icon: 'plane' | 'id-card' | 'shield' | 'bar-chart' }> = [
    { key: "entry", label: "Entry", icon: "plane" },
    { key: "visa", label: "Visa", icon: "id-card" },
    { key: "insurance", label: "Insurance", icon: "shield" },
    { key: "hrms", label: "HRMS", icon: "bar-chart" },
  ];

  const hrmsKpis = report === "hrms" ? (() => {
    const list = rows as HrmsSummaryRow[];
    const days = list.reduce((acc, r) => acc + Number(r.daysPresent ?? 0), 0);
    const hours = list.reduce((acc, r) => acc + Number(r.workedHours ?? 0), 0);
    const ot = list.reduce((acc, r) => acc + Number(r.overtimeApprovedHours ?? 0), 0);
    const exp = list.reduce((acc, r) => acc + Number(r.expenseApproved ?? 0), 0);
    return { days, hours, ot, exp };
  })() : null;

  return (
    <Screen
      title="Reports"
      subtitle="Entry, visa expiry and insurance expiry"
      gradient={["#4f46e5", "#06b6d4", "#10b981"]}
      refreshing={loading}
      onRefresh={load}
    >
      <View style={styles.tabs}>
        {tabs.map((t) => {
          const selected = report === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setReport(t.key)} activeOpacity={0.85} style={[styles.pill, selected && styles.pillActive]}>
              {selected && (
                <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
              )}
              <FontAwesome name={t.icon} size={12} color={selected ? 'white' : 'rgba(15,23,42,0.55)'} />
              <Text style={[styles.pillText, selected && styles.pillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {(report === "visa" || report === "insurance") && (
        <View style={styles.daysRow}>
          <View style={styles.daysInputWrap}>
            <Text style={styles.daysLabel}>Expiring within</Text>
            <TextInput
              value={days}
              onChangeText={setDays}
              style={styles.daysInput}
              keyboardType="numeric"
              placeholder="days"
              placeholderTextColor="rgba(15,23,42,0.4)"
            />
            <Text style={styles.daysLabel}>days</Text>
          </View>
          <PrimaryButton title="Load" onPress={load} />
        </View>
      )}

      {report === "hrms" && (
        <>
          <View style={styles.rangeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rangeLabel}>From</Text>
              <TextInput
                value={hrmsRange.from}
                onChangeText={(v) => setHrmsRange((r) => ({ ...r, from: v }))}
                style={styles.rangeInput}
                autoCapitalize="none"
                placeholder="YYYY-MM-DD"
                placeholderTextColor="rgba(15,23,42,0.4)"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rangeLabel}>To</Text>
              <TextInput
                value={hrmsRange.to}
                onChangeText={(v) => setHrmsRange((r) => ({ ...r, to: v }))}
                style={styles.rangeInput}
                autoCapitalize="none"
                placeholder="YYYY-MM-DD"
                placeholderTextColor="rgba(15,23,42,0.4)"
              />
            </View>
          </View>

          {hrmsKpis ? (
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{hrmsKpis.days}</Text>
                <Text style={styles.kpiLabel}>Days present</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{hrmsKpis.hours.toFixed(1)}h</Text>
                <Text style={styles.kpiLabel}>Worked</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, hrmsKpis.ot > 0 ? { color: '#f59e0b' } : null]}>{hrmsKpis.ot.toFixed(1)}h</Text>
                <Text style={styles.kpiLabel}>OT approved</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{hrmsKpis.exp.toFixed(0)}</Text>
                <Text style={styles.kpiLabel}>Exp approved</Text>
              </View>
            </View>
          ) : null}
        </>
      )}

      <SectionTitle title={`Results (${rows.length})`} />

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No rows for this report.</Text>
        </View>
      ) : report === "hrms" ? (
        <View style={{ gap: 10 }}>
          {(rows as HrmsSummaryRow[]).map((r) => (
            <View key={r.workerId} style={styles.hrmsCard}>
              <View style={styles.hrmsHeader}>
                <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hrmsAvatar}>
                  <FontAwesome name="user" size={14} color="white" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hrmsName}>{r.name ?? r.workerId}</Text>
                  <Text style={styles.hrmsSub}>{r.workerId}</Text>
                </View>
              </View>
              <View style={styles.hrmsGrid}>
                <HrmsCell label="Days" value={String(r.daysPresent ?? 0)} />
                <HrmsCell label="Hours" value={`${Number(r.workedHours ?? 0).toFixed(1)}h`} />
                <HrmsCell label="Late" value={String(r.lateCount ?? 0)} warn={Number(r.lateCount ?? 0) > 0} />
                <HrmsCell label="Early" value={String(r.earlyLeaveCount ?? 0)} warn={Number(r.earlyLeaveCount ?? 0) > 0} />
                <HrmsCell label="OT req" value={`${Number(r.overtimeRequestedHours ?? 0).toFixed(1)}h`} />
                <HrmsCell label="OT ok" value={`${Number(r.overtimeApprovedHours ?? 0).toFixed(1)}h`} good={Number(r.overtimeApprovedHours ?? 0) > 0} />
                <HrmsCell label="Exp req" value={Number(r.expenseClaimed ?? 0).toFixed(2)} />
                <HrmsCell label="Exp ok" value={Number(r.expenseApproved ?? 0).toFixed(2)} good={Number(r.expenseApproved ?? 0) > 0} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item, idx) => (
            <ListItemCard
              key={String(item?.Worker_Id ?? idx)}
              title={String(item?.Name ?? item?.Worker_Id ?? "Worker")}
              subtitle={`Passport: ${String(item?.Passport_Number ?? "—")}`}
              meta={`Company: ${String(item?.Company_Name ?? "—")}`}
              icon={report === 'entry' ? 'plane' : report === 'visa' ? 'id-card' : 'shield'}
              iconGradient={report === 'entry' ? ['#6366f1', '#8b5cf6'] : report === 'visa' ? ['#f59e0b', '#ef4444'] : ['#10b981', '#06b6d4']}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function HrmsCell({ label, value, warn, good }: { label: string; value: string; warn?: boolean; good?: boolean }) {
  const color = warn ? '#ef4444' : good ? '#10b981' : '#0f172a';
  return (
    <View style={styles.hrmsCell}>
      <Text style={styles.hrmsCellLabel}>{label}</Text>
      <Text style={[styles.hrmsCellValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.15)',
  },
  pillActive: { borderColor: 'transparent' },
  pillText: { fontSize: 12, fontWeight: '800', color: 'rgba(15,23,42,0.6)' },
  pillTextActive: { color: 'white' },
  daysRow: { marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  daysInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.15)',
  },
  daysLabel: { fontSize: 12, color: 'rgba(15,23,42,0.55)', fontWeight: '600' },
  daysInput: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: 'rgba(15,23,42,0.55)', fontSize: 13 },

  rangeRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  rangeLabel: { fontSize: 11, fontWeight: '800', color: 'rgba(15,23,42,0.6)', letterSpacing: 0.4, textTransform: 'uppercase' },
  rangeInput: {
    marginTop: 8, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.18)',
    backgroundColor: '#ffffff', color: '#0f172a',
  },

  kpiRow: { marginTop: 14, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  kpiCard: {
    flexBasis: '48%', flexGrow: 1,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: 'rgba(99,102,241,0.12)',
    shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
  },
  kpiValue: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  kpiLabel: { marginTop: 2, fontSize: 10, fontWeight: '800', color: 'rgba(15,23,42,0.55)', letterSpacing: 0.3, textTransform: 'uppercase' },

  hrmsCard: {
    padding: 14, borderRadius: 18,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: 'rgba(99,102,241,0.12)',
    shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  hrmsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hrmsAvatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hrmsName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  hrmsSub: { marginTop: 2, fontSize: 11, color: 'rgba(15,23,42,0.6)', fontWeight: '600' },
  hrmsGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hrmsCell: {
    flexBasis: '23%', flexGrow: 1, minWidth: 70,
    padding: 8, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.06)',
  },
  hrmsCellLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(15,23,42,0.55)', letterSpacing: 0.3, textTransform: 'uppercase' },
  hrmsCellValue: { marginTop: 2, fontSize: 13, fontWeight: '900' },
});
