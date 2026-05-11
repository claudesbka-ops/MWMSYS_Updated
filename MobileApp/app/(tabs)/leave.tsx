import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";

import { useHrmsService } from "@/services/hrmsService";
import { useSession } from "@/contexts/SessionContext";
import { useApiClient } from "@/services/apiClient";
import { usePlanGate } from "@/hooks/usePlanGate";
import { Screen, Card, PrimaryButton, SectionTitle } from "@/components/ui";

type LeaveTypeKey = "Annual" | "Sick" | "Emergency" | "Unpaid";

const LEAVE_TYPES: { key: LeaveTypeKey; label: string; icon: keyof typeof FontAwesome.glyphMap; gradient: readonly [string, string] }[] = [
  { key: "Annual", label: "🏖️ Annual", icon: "sun-o", gradient: ["#0ea5e9", "#6366f1"] },
  { key: "Sick", label: "🤒 Sick", icon: "medkit", gradient: ["#10b981", "#22d3ee"] },
  { key: "Emergency", label: "🚨 Emergency", icon: "exclamation-triangle", gradient: ["#ef4444", "#f97316"] },
  { key: "Unpaid", label: "⏳ Unpaid", icon: "clock-o", gradient: ["#64748b", "#94a3b8"] },
];

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromIsoDate(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function diffDays(start: string, end: string): number {
  const a = fromIsoDate(start);
  const b = fromIsoDate(end);
  if (!a || !b) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

export default function LeaveScreen() {
  const router = useRouter();
  const hrms = useHrmsService();
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? "").toString();
  const gate = usePlanGate();

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const [leaveType, setLeaveType] = useState<LeaveTypeKey>("Annual");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [picker, setPicker] = useState<null | "start" | "end">(null);

  const days = useMemo(() => (startDate && endDate ? diffDays(startDate, endDate) : 0), [startDate, endDate]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await hrms.getMyLeaves();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Failed to load leave");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const onPickerChange = (which: "start" | "end") => (event: DateTimePickerEvent, date?: Date) => {
    // On Android the picker dismisses itself; on iOS keep the inline view open.
    if (Platform.OS !== "ios") setPicker(null);
    if (event.type === "dismissed" || !date) return;
    const iso = toIsoDate(date);
    if (which === "start") {
      setStartDate(iso);
      // If end is empty or now before start, snap end to start.
      if (!endDate || (endDate && new Date(endDate) < date)) setEndDate(iso);
    } else {
      setEndDate(iso);
    }
  };

  const apply = async () => {
    if (appRole !== "worker") return;
    if (!startDate || !endDate) {
      Alert.alert("📅 Missing dates", "Please select both start and end dates.");
      return;
    }
    setBusy(true);
    try {
      await hrms.applyLeave({ leaveType, startDate, endDate });
      setStartDate("");
      setEndDate("");
      setLeaveType("Annual");
      await refresh();
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Leave apply failed");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: number, status: "Approved" | "Rejected") => {
    if ((appRole === "employer" || appRole === "agency") && !gate.hasPlan) {
      Alert.alert("💎 Subscription required", `Please purchase a plan to ${status.toLowerCase()} leave.`);
      return;
    }
    setBusy(true);
    try {
      await api.post("/Api/HRMS/Leave/Decision", { id, status });
      await refresh();
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? `${status} failed`);
    } finally {
      setBusy(false);
    }
  };

  const badgeTone = (s: string) => {
    const x = s.toLowerCase();
    if (x.includes("approv")) return { label: "✅ Approved", tone: "emerald" as const };
    if (x.includes("reject")) return { label: "❌ Rejected", tone: "rose" as const };
    return { label: "⏳ Pending", tone: "amber" as const };
  };

  return (
    <Screen
      title={appRole === "worker" ? "🌴 My Leave" : "🌴 Leave Requests"}
      subtitle={appRole === "worker" ? "Apply and track your leave" : "Approve or reject pending leave"}
      gradient={["#f59e0b", "#fb7185", "#a855f7"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      {appRole === "worker" ? (
        <Card>
          <Text style={styles.sectionTitle}>📌 What kind of leave?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {LEAVE_TYPES.map((t) => (
              <LeaveTypeChip
                key={t.key}
                active={leaveType === t.key}
                label={t.label}
                icon={t.icon}
                gradient={t.gradient}
                onPress={() => setLeaveType(t.key)}
              />
            ))}
          </ScrollView>

          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>📅 When?</Text>
          <View style={styles.dateRow}>
            <DateField label="From" value={startDate} onPress={() => setPicker("start")} testID="start-date-input" />
            <FontAwesome name="long-arrow-right" size={16} color="rgba(15,23,42,0.45)" style={{ marginHorizontal: 4 }} />
            <DateField label="To" value={endDate} onPress={() => setPicker("end")} testID="end-date-input" />
          </View>

          {days > 0 ? (
            <View style={styles.daysPill}>
              <FontAwesome name="calendar-check-o" size={12} color="#4f46e5" />
              <Text style={styles.daysText}>
                {days} {days === 1 ? "day" : "days"} · {leaveType}
              </Text>
            </View>
          ) : null}

          <PrimaryButton title="📤 Submit request" loading={busy} onPress={apply} style={{ marginTop: 18 }} testID="submit-leave-btn" />

          {picker !== null && (
            <DateTimePicker
              value={
                (picker === "start" ? fromIsoDate(startDate) : fromIsoDate(endDate)) ?? new Date()
              }
              mode="date"
              minimumDate={picker === "end" && startDate ? fromIsoDate(startDate) ?? undefined : undefined}
              onChange={onPickerChange(picker)}
            />
          )}
        </Card>
      ) : null}

      {!gate.hasPlan && (appRole === "employer" || appRole === "agency") ? (
        <Card style={{ borderColor: "rgba(239,68,68,0.25)", marginTop: 12 } as any}>
          <Text style={styles.formTitle}>💎 Subscription required</Text>
          <Text style={styles.paywallSub}>Upgrade to approve or reject leave requests.</Text>
          <PrimaryButton
            title="🔓 View pricing"
            variant="danger"
            style={{ marginTop: 12 }}
            onPress={() => router.push("/(tabs)/pricing" as any)}
          />
        </Card>
      ) : null}

      <SectionTitle title={`📜 Records (${rows.length})`} />

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="calendar-o" size={36} color="rgba(99,102,241,0.35)" />
          <Text style={styles.emptyText}>No leave records yet 🌴</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item, idx) => {
            const sd = item?.startDate ? new Date(String(item.startDate)).toLocaleDateString() : "—";
            const ed = item?.endDate ? new Date(String(item.endDate)).toLocaleDateString() : "—";
            const id = Number(item?.id ?? 0);
            const status = String(item?.status ?? "Pending");
            const tone = badgeTone(status);
            const isPending = status.toLowerCase() === "pending";
            const canDecide = appRole !== "worker" && isPending;
            const typeKey = (item?.leaveType ?? "Annual").toString();
            const typeMeta = LEAVE_TYPES.find((t) => t.key === typeKey) ?? LEAVE_TYPES[0];
            return (
              <Card key={String(item?.id ?? idx)} tight>
                <View style={styles.row}>
                  <LinearGradient
                    colors={typeMeta.gradient as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.recordIcon}
                  >
                    <FontAwesome name={typeMeta.icon} size={16} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{typeMeta.label}</Text>
                    <Text style={styles.cardSub}>
                      {sd} → {ed}
                    </Text>
                  </View>
                  <View style={[styles.badge, styles[`badge_${tone.tone}` as "badge_emerald"]]}>
                    <Text style={[styles.badgeText, styles[`badgeText_${tone.tone}` as "badgeText_emerald"]]}>
                      {tone.label}
                    </Text>
                  </View>
                </View>
                {canDecide ? (
                  <View style={styles.decideRow}>
                    <PrimaryButton title="✅ Approve" variant="success" onPress={() => decide(id, "Approved")} disabled={busy} style={{ flex: 1 }} testID="approve-leave-btn" />
                    <PrimaryButton title="❌ Reject" variant="danger" onPress={() => decide(id, "Rejected")} disabled={busy} style={{ flex: 1 }} testID="reject-leave-btn" />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function LeaveTypeChip({
  active,
  label,
  icon,
  gradient,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof FontAwesome.glyphMap;
  gradient: readonly [string, string];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DateField({ label, value, onPress, testID }: { label: string; value: string; onPress: () => void; testID?: string }) {
  const display = value ? new Date(value).toLocaleDateString() : "Select date";
  return (
    <Pressable style={styles.dateField} onPress={onPress} testID={testID}>
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.dateValueRow}>
        <FontAwesome name="calendar" size={14} color="#4f46e5" />
        <Text style={[styles.dateValue, !value && styles.dateValuePlaceholder]}>{display}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  formTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  paywallSub: { marginTop: 4, fontSize: 12, color: "rgba(15,23,42,0.6)" },

  chipRow: { gap: 8, paddingTop: 10, paddingBottom: 4, paddingRight: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.15)",
    backgroundColor: "#ffffff",
  },
  chipActive: { borderColor: "rgba(79,70,229,0.6)", shadowColor: "#6366f1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3 },
  chipIcon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99,102,241,0.08)" },
  chipIconActive: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  chipText: { fontSize: 13, fontWeight: "700", color: "rgba(15,23,42,0.65)" },
  chipTextActive: { color: "#0f172a" },

  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  dateField: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.15)",
    backgroundColor: "#ffffff",
  },
  dateLabel: { fontSize: 10, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.4, textTransform: "uppercase" },
  dateValueRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  dateValue: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  dateValuePlaceholder: { color: "rgba(15,23,42,0.4)" },

  daysPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.1)",
  },
  daysText: { fontSize: 12, fontWeight: "800", color: "#4f46e5" },

  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13 },

  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  recordIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  cardSub: { marginTop: 2, fontSize: 12, color: "rgba(15,23,42,0.6)" },

  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  badge_emerald: { backgroundColor: "rgba(16,185,129,0.14)" },
  badge_rose: { backgroundColor: "rgba(244,63,94,0.14)" },
  badge_amber: { backgroundColor: "rgba(245,158,11,0.15)" },
  badgeText_emerald: { color: "#047857" },
  badgeText_rose: { color: "#be123c" },
  badgeText_amber: { color: "#b45309" },

  decideRow: { marginTop: 12, flexDirection: "row", gap: 10 },
});
