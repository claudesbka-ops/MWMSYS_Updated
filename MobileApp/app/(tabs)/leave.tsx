import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { useHrmsService } from "@/services/hrmsService";
import { useSession } from "@/contexts/SessionContext";
import { useApiClient } from "@/services/apiClient";
import { usePlanGate } from "@/hooks/usePlanGate";
import { Screen, Card, PrimaryButton, SectionTitle } from "@/components/ui";

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

  const [leaveType, setLeaveType] = useState("Annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await hrms.getMyLeaves();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load leave");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const apply = async () => {
    if (appRole !== "worker") return;
    if (!leaveType.trim() || !startDate.trim() || !endDate.trim()) {
      Alert.alert("Missing fields", "leaveType, startDate and endDate are required (YYYY-MM-DD)");
      return;
    }

    setBusy(true);
    try {
      await hrms.applyLeave({ leaveType, startDate, endDate });
      setStartDate("");
      setEndDate("");
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Leave apply failed");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: number, status: 'Approved' | 'Rejected') => {
    if ((appRole === "employer" || appRole === "agency") && !gate.hasPlan) {
      Alert.alert("Subscription required", `Please purchase a plan to ${status.toLowerCase()} leave.`);
      return;
    }
    setBusy(true);
    try {
      await api.post("/Api/HRMS/Leave/Decision", { id, status });
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? `${status} failed`);
    } finally {
      setBusy(false);
    }
  };

  const badgeTone = (s: string) => {
    const x = s.toLowerCase();
    if (x.includes('approv')) return { label: 'Approved', tone: 'emerald' as const };
    if (x.includes('reject')) return { label: 'Rejected', tone: 'rose' as const };
    return { label: 'Pending', tone: 'amber' as const };
  };

  return (
    <Screen
      title="Leave"
      subtitle={appRole === 'worker' ? 'Apply and track your leave' : 'Approve or reject pending leave'}
      gradient={["#f59e0b", "#fb7185", "#a855f7"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      {appRole === "worker" ? (
        <Card>
          <Text style={styles.formTitle}>Apply Leave</Text>
          <TextInput value={leaveType} onChangeText={setLeaveType} placeholder="Leave type (Annual / Sick / Emergency)" placeholderTextColor="rgba(15,23,42,0.4)" style={styles.input} autoCapitalize="words" />
          <TextInput value={startDate} onChangeText={setStartDate} placeholder="Start date (YYYY-MM-DD)" placeholderTextColor="rgba(15,23,42,0.4)" style={styles.input} autoCapitalize="none" />
          <TextInput value={endDate} onChangeText={setEndDate} placeholder="End date (YYYY-MM-DD)" placeholderTextColor="rgba(15,23,42,0.4)" style={styles.input} autoCapitalize="none" />
          <PrimaryButton title="Submit request" loading={busy} onPress={apply} style={{ marginTop: 14 }} />
        </Card>
      ) : null}

      {!gate.hasPlan && (appRole === "employer" || appRole === "agency") ? (
        <Card style={{ borderColor: 'rgba(239,68,68,0.25)', marginTop: 12 } as any}>
          <Text style={styles.paywallTitle}>Subscription required</Text>
          <Text style={styles.paywallSub}>Upgrade to approve or reject leave requests.</Text>
          <PrimaryButton title="View pricing" variant="danger" style={{ marginTop: 12 }} onPress={() => router.push("/(tabs)/pricing" as any)} />
        </Card>
      ) : null}

      <SectionTitle title={`Records (${rows.length})`} />

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No leave records yet.</Text>
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
            return (
              <Card key={String(item?.id ?? idx)} tight>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{String(item?.leaveType ?? "Leave")}</Text>
                    <Text style={styles.cardSub}>{sd} → {ed}</Text>
                  </View>
                  <View style={[styles.badge, styles[`badge_${tone.tone}` as 'badge_emerald']]}>
                    <Text style={[styles.badgeText, styles[`badgeText_${tone.tone}` as 'badgeText_emerald']]}>{tone.label}</Text>
                  </View>
                </View>
                {canDecide ? (
                  <View style={styles.decideRow}>
                    <PrimaryButton title="Approve" variant="success" onPress={() => decide(id, 'Approved')} disabled={busy} style={{ flex: 1 }} />
                    <PrimaryButton title="Reject" variant="danger" onPress={() => decide(id, 'Rejected')} disabled={busy} style={{ flex: 1 }} />
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

const styles = StyleSheet.create({
  formTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.15)',
    paddingHorizontal: 14,
    marginTop: 10,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  paywallTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  paywallSub: { marginTop: 4, fontSize: 12, color: 'rgba(15,23,42,0.6)' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: 'rgba(15,23,42,0.55)', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  cardSub: { marginTop: 2, fontSize: 12, color: 'rgba(15,23,42,0.6)' },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  badge_emerald: { backgroundColor: 'rgba(16,185,129,0.14)' },
  badge_rose: { backgroundColor: 'rgba(244,63,94,0.14)' },
  badge_amber: { backgroundColor: 'rgba(245,158,11,0.15)' },
  badgeText_emerald: { color: '#047857' },
  badgeText_rose: { color: '#be123c' },
  badgeText_amber: { color: '#b45309' },
  decideRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
});
