import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Card, PrimaryButton, Screen, SectionTitle } from "@/components/ui";

type TabKey = "overtime" | "expenses";

type Status = "Pending" | "Approved" | "Rejected" | string;

type OvertimeRow = {
  id: number;
  workerId: string;
  workerName?: string | null;
  workDate: string;
  hours: number;
  reason: string | null;
  status: Status;
  createdOn: string;
};

type ExpenseRow = {
  id: number;
  workerId: string;
  workerName?: string | null;
  claimDate: string;
  amount: number;
  category: string | null;
  description: string | null;
  status: Status;
  createdOn: string;
};

const STATUS_FILTERS: Array<{ key: "All" | "Pending" | "Approved" | "Rejected"; label: string }> = [
  { key: "All", label: "All" },
  { key: "Pending", label: "Pending" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
];

function todayIso() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function RequestsScreen() {
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? session.claims?.role ?? "worker").toString();
  const isWorker = appRole === "worker";
  const isManager = appRole === "employer" || appRole === "agency" || appRole === "admin";

  const [tab, setTab] = useState<TabKey>("overtime");
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("Pending");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [overtime, setOvertime] = useState<OvertimeRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [otDate, setOtDate] = useState(todayIso());
  const [otHours, setOtHours] = useState("1");
  const [otReason, setOtReason] = useState("");
  const [otSubmitting, setOtSubmitting] = useState(false);

  const [expDate, setExpDate] = useState(todayIso());
  const [expAmount, setExpAmount] = useState("0");
  const [expCategory, setExpCategory] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expSubmitting, setExpSubmitting] = useState(false);

  const loadOvertime = useCallback(async () => {
    try {
      const path = isWorker ? "/Api/HRMS/Overtime/me" : "/Api/HRMS/Overtime";
      const res = await api.get<OvertimeRow[]>(path);
      setOvertime(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to load overtime requests");
    }
  }, [api, isWorker]);

  const loadExpenses = useCallback(async () => {
    try {
      const path = isWorker ? "/Api/HRMS/Expenses/me" : "/Api/HRMS/Expenses";
      const res = await api.get<ExpenseRow[]>(path);
      setExpenses(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to load expense claims");
    }
  }, [api, isWorker]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadOvertime(), loadExpenses()]);
    } finally {
      setLoading(false);
    }
  }, [loadOvertime, loadExpenses]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const filteredOvertime = useMemo(() => {
    if (statusFilter === "All") return overtime;
    return overtime.filter((r) => r.status === statusFilter);
  }, [overtime, statusFilter]);

  const filteredExpenses = useMemo(() => {
    if (statusFilter === "All") return expenses;
    return expenses.filter((r) => r.status === statusFilter);
  }, [expenses, statusFilter]);

  const pendingOvertime = overtime.filter((r) => r.status === "Pending").length;
  const pendingExpenses = expenses.filter((r) => r.status === "Pending").length;

  const submitOvertime = async () => {
    const hoursNum = Number(otHours);
    if (!otDate.trim() || !Number.isFinite(hoursNum) || hoursNum <= 0) {
      Alert.alert("Missing", "Work date and positive hours are required");
      return;
    }
    setOtSubmitting(true);
    try {
      await api.post("/Api/HRMS/Overtime/Request", {
        workDate: otDate.trim(),
        hours: hoursNum,
        reason: otReason.trim() || undefined,
      });
      setOtReason("");
      setOtHours("1");
      setOtDate(todayIso());
      await loadOvertime();
      Alert.alert("Submitted", "Overtime request sent for approval");
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to submit");
    } finally {
      setOtSubmitting(false);
    }
  };

  const submitExpense = async () => {
    const amountNum = Number(expAmount);
    if (!expDate.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      Alert.alert("Missing", "Claim date and positive amount are required");
      return;
    }
    setExpSubmitting(true);
    try {
      await api.post("/Api/HRMS/Expenses/Claim", {
        claimDate: expDate.trim(),
        amount: amountNum,
        category: expCategory.trim() || undefined,
        description: expDescription.trim() || undefined,
      });
      setExpAmount("0");
      setExpCategory("");
      setExpDescription("");
      setExpDate(todayIso());
      await loadExpenses();
      Alert.alert("Submitted", "Expense claim sent for approval");
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to submit");
    } finally {
      setExpSubmitting(false);
    }
  };

  const decide = async (type: TabKey, id: number, status: "Approved" | "Rejected") => {
    setBusyId(id);
    try {
      const path = type === "overtime" ? "/Api/HRMS/Overtime/Decision" : "/Api/HRMS/Expenses/Decision";
      await api.post(path, { id, status });
      if (type === "overtime") {
        setOvertime((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      } else {
        setExpenses((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      }
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to save decision");
    } finally {
      setBusyId(null);
    }
  };

  if (!isWorker && !isManager) {
    return (
      <Screen title="Requests" subtitle="Not available for this role" gradient={["#6366f1", "#8b5cf6"]}>
        <Card>
          <Text style={styles.muted}>Overtime and expense requests are only available to workers, employers, agencies and admins.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="Requests"
      subtitle={isWorker ? "Submit and track overtime and expense claims" : "Approve overtime and expense claims"}
      gradient={["#6366f1", "#8b5cf6", "#ec4899"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      {/* Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pendingOvertime}</Text>
          <Text style={styles.statLabel}>Overtime pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pendingExpenses}</Text>
          <Text style={styles.statLabel}>Expenses pending</Text>
        </View>
      </View>

      {/* Tab switch */}
      <View style={styles.tabRow}>
        {(["overtime", "expenses"] as TabKey[]).map((t) => {
          const active = tab === t;
          return (
            <TouchableOpacity key={t} activeOpacity={0.85} onPress={() => setTab(t)} style={[styles.tab, active && styles.tabActive]}>
              {active && (
                <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
              )}
              <FontAwesome name={t === "overtime" ? "clock-o" : "credit-card"} size={14} color={active ? "white" : "rgba(15,23,42,0.6)"} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t === "overtime" ? "Overtime" : "Expenses"}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Submit forms (workers) */}
      {isWorker && tab === "overtime" ? (
        <>
          <SectionTitle title="Submit overtime" />
          <Card>
            <Text style={styles.label}>Work date (YYYY-MM-DD)</Text>
            <TextInput value={otDate} onChangeText={setOtDate} style={styles.input} autoCapitalize="none" placeholder="2025-01-31" placeholderTextColor="rgba(15,23,42,0.4)" />
            <Text style={styles.label}>Hours</Text>
            <TextInput value={otHours} onChangeText={setOtHours} style={styles.input} keyboardType="decimal-pad" />
            <Text style={styles.label}>Reason (optional)</Text>
            <TextInput
              value={otReason}
              onChangeText={setOtReason}
              style={[styles.input, styles.multiline]}
              multiline
              placeholder="Why did you work overtime?"
              placeholderTextColor="rgba(15,23,42,0.4)"
            />
            <PrimaryButton title={otSubmitting ? "Submitting…" : "Submit overtime"} loading={otSubmitting} onPress={submitOvertime} style={{ marginTop: 16 }} />
          </Card>
        </>
      ) : null}

      {isWorker && tab === "expenses" ? (
        <>
          <SectionTitle title="Submit expense claim" />
          <Card>
            <Text style={styles.label}>Claim date (YYYY-MM-DD)</Text>
            <TextInput value={expDate} onChangeText={setExpDate} style={styles.input} autoCapitalize="none" placeholder="2025-01-31" placeholderTextColor="rgba(15,23,42,0.4)" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Amount</Text>
                <TextInput value={expAmount} onChangeText={setExpAmount} style={styles.input} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Category</Text>
                <TextInput value={expCategory} onChangeText={setExpCategory} style={styles.input} placeholder="Travel, Meals…" placeholderTextColor="rgba(15,23,42,0.4)" />
              </View>
            </View>
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              value={expDescription}
              onChangeText={setExpDescription}
              style={[styles.input, styles.multiline]}
              multiline
              placeholder="What is this expense for?"
              placeholderTextColor="rgba(15,23,42,0.4)"
            />
            <PrimaryButton title={expSubmitting ? "Submitting…" : "Submit claim"} loading={expSubmitting} onPress={submitExpense} style={{ marginTop: 16 }} />
          </Card>
        </>
      ) : null}

      {/* Status filter */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((s) => {
          const active = statusFilter === s.key;
          return (
            <TouchableOpacity key={s.key} activeOpacity={0.85} onPress={() => setStatusFilter(s.key)} style={[styles.filter, active && styles.filterActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionTitle title={tab === "overtime" ? `Overtime (${filteredOvertime.length})` : `Expenses (${filteredExpenses.length})`} />

      {loading ? (
        <ActivityIndicator color="#6366f1" />
      ) : tab === "overtime" ? (
        filteredOvertime.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No overtime requests for this filter.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filteredOvertime.map((r) => (
              <OvertimeCard
                key={r.id}
                row={r}
                isManager={isManager}
                busy={busyId === r.id}
                onDecide={(status) => decide("overtime", r.id, status)}
              />
            ))}
          </View>
        )
      ) : filteredExpenses.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No expense claims for this filter.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filteredExpenses.map((r) => (
            <ExpenseCard
              key={r.id}
              row={r}
              isManager={isManager}
              busy={busyId === r.id}
              onDecide={(status) => decide("expenses", r.id, status)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function StatusPill({ status }: { status: Status }) {
  const s = String(status ?? "").toLowerCase();
  const style = s === "approved" ? styles.statusApproved : s === "rejected" ? styles.statusRejected : styles.statusPending;
  return (
    <View style={[styles.statusPill, style]}>
      <Text style={styles.statusText}>{String(status ?? "Pending")}</Text>
    </View>
  );
}

function OvertimeCard({ row, isManager, busy, onDecide }: { row: OvertimeRow; isManager: boolean; busy: boolean; onDecide: (status: "Approved" | "Rejected") => void }) {
  return (
    <Card tight>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{row.workerName ?? row.workerId}</Text>
          <Text style={styles.cardSub}>{String(row.workDate).slice(0, 10)} · {row.hours}h</Text>
        </View>
        <StatusPill status={row.status} />
      </View>
      {row.reason ? <Text style={styles.description}>{row.reason}</Text> : null}
      {isManager && row.status === "Pending" ? (
        <View style={styles.decisionRow}>
          <TouchableOpacity disabled={busy} onPress={() => onDecide("Rejected")} style={[styles.rejectBtn, busy && styles.btnDisabled]}>
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={() => onDecide("Approved")} style={[styles.approveBtn, busy && styles.btnDisabled]}>
            {busy ? <ActivityIndicator color="white" /> : <Text style={styles.approveText}>Approve</Text>}
          </TouchableOpacity>
        </View>
      ) : null}
    </Card>
  );
}

function ExpenseCard({ row, isManager, busy, onDecide }: { row: ExpenseRow; isManager: boolean; busy: boolean; onDecide: (status: "Approved" | "Rejected") => void }) {
  return (
    <Card tight>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{row.workerName ?? row.workerId}</Text>
          <Text style={styles.cardSub}>{String(row.claimDate).slice(0, 10)} · {row.category ?? "Expense"}</Text>
        </View>
        <StatusPill status={row.status} />
      </View>
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Amount</Text>
        <Text style={styles.amountValue}>{Number(row.amount ?? 0).toFixed(2)}</Text>
      </View>
      {row.description ? <Text style={styles.description}>{row.description}</Text> : null}
      {isManager && row.status === "Pending" ? (
        <View style={styles.decisionRow}>
          <TouchableOpacity disabled={busy} onPress={() => onDecide("Rejected")} style={[styles.rejectBtn, busy && styles.btnDisabled]}>
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={() => onDecide("Approved")} style={[styles.approveBtn, busy && styles.btnDisabled]}>
            {busy ? <ActivityIndicator color="white" /> : <Text style={styles.approveText}>Approve</Text>}
          </TouchableOpacity>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: { color: "rgba(15,23,42,0.65)", fontSize: 13, lineHeight: 19 },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(79,70,229,0.1)",
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  statValue: { fontSize: 26, fontWeight: "900", color: "#0f172a" },
  statLabel: { marginTop: 2, fontSize: 11, fontWeight: "700", color: "rgba(15,23,42,0.55)", letterSpacing: 0.3, textTransform: "uppercase" },

  tabRow: { marginTop: 16, flexDirection: "row", gap: 8 },
  tab: {
    overflow: "hidden", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(79,70,229,0.15)",
  },
  tabActive: { borderColor: "transparent" },
  tabText: { fontSize: 12, fontWeight: "800", color: "rgba(15,23,42,0.65)" },
  tabTextActive: { color: "white" },

  label: { marginTop: 12, fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(79,70,229,0.15)",
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 8,
    backgroundColor: "#ffffff", color: "#0f172a",
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },

  filterRow: { marginTop: 16, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  filter: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(79,70,229,0.15)",
  },
  filterActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  filterText: { fontSize: 12, fontWeight: "700", color: "rgba(15,23,42,0.65)" },
  filterTextActive: { color: "white" },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13 },

  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  cardSub: { marginTop: 2, fontSize: 12, color: "rgba(15,23,42,0.6)" },

  amountRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amountLabel: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.4, textTransform: "uppercase" },
  amountValue: { fontSize: 16, fontWeight: "900", color: "#0f172a" },

  description: { marginTop: 10, fontSize: 13, color: "rgba(15,23,42,0.75)", lineHeight: 18 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPending: { backgroundColor: "rgba(245,158,11,0.14)" },
  statusApproved: { backgroundColor: "rgba(16,185,129,0.14)" },
  statusRejected: { backgroundColor: "rgba(239,68,68,0.14)" },
  statusText: { fontSize: 10, fontWeight: "900", color: "#0f172a", letterSpacing: 0.3, textTransform: "uppercase" },

  decisionRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  approveBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "#10b981", alignItems: "center", justifyContent: "center",
  },
  approveText: { color: "white", fontWeight: "900", fontSize: 13 },
  rejectBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "#ffffff",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", alignItems: "center", justifyContent: "center",
  },
  rejectText: { color: "#ef4444", fontWeight: "900", fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
});
