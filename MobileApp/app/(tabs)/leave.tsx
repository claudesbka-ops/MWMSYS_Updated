import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useHrmsService } from "@/services/hrmsService";
import { useSession } from "@/contexts/SessionContext";
import { useApiClient } from "@/services/apiClient";
import { usePlanGate } from "@/hooks/usePlanGate";

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leave</Text>
      <Text style={styles.subtitle}>Apply and track approvals</Text>

      {appRole === "worker" ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Apply Leave</Text>

          <TextInput
            value={leaveType}
            onChangeText={setLeaveType}
            placeholder="Leave type (Annual/Sick)"
            style={styles.input}
            autoCapitalize="words"
          />
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="Start date (YYYY-MM-DD)"
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="End date (YYYY-MM-DD)"
            style={styles.input}
            autoCapitalize="none"
          />

          <View style={styles.formActions}>
            <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabledBtn]} onPress={apply} disabled={busy}>
              <Text style={styles.primaryBtnText}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ghostBtn, busy && styles.disabledBtn]} onPress={refresh} disabled={busy}>
              <Text style={styles.ghostBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Approvals</Text>
          {!gate.hasPlan && (appRole === "employer" || appRole === "agency") ? (
            <View style={styles.paywall}>
              <Text style={styles.paywallText}>Subscription required to approve/reject leave.</Text>
              <TouchableOpacity style={styles.paywallBtn} onPress={() => router.push("/(tabs)/pricing" as any)}>
                <Text style={styles.paywallBtnText}>Go to Pricing</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.formActions}>
            <TouchableOpacity style={[styles.ghostBtn, busy && styles.disabledBtn]} onPress={refresh} disabled={busy}>
              <Text style={styles.ghostBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item?.id ?? Math.random())}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const sd = item?.startDate ? new Date(String(item.startDate)).toLocaleDateString() : "";
            const ed = item?.endDate ? new Date(String(item.endDate)).toLocaleDateString() : "";
            return (
              <View style={styles.card}>
                <Text style={styles.cardLine}>Type: {String(item?.leaveType ?? "")}</Text>
                <Text style={styles.cardLine}>From: {sd}</Text>
                <Text style={styles.cardLine}>To: {ed}</Text>
                <Text style={styles.cardLine}>Status: {String(item?.status ?? "Pending")}</Text>
                {appRole !== "worker" && String(item?.status ?? "").toLowerCase() === "pending" ? (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.okBtn, busy && styles.disabledBtn]}
                      disabled={busy || ((appRole === "employer" || appRole === "agency") && !gate.hasPlan)}
                      onPress={async () => {
                        if ((appRole === "employer" || appRole === "agency") && !gate.hasPlan) {
                          Alert.alert("Subscription required", "Please purchase a plan to approve leave.");
                          return;
                        }
                        setBusy(true);
                        try {
                          await api.post("/Api/HRMS/Leave/Decision", { id: Number(item?.id ?? 0), status: "Approved" });
                          await refresh();
                        } catch (e: any) {
                          Alert.alert("Error", e?.error ?? "Approve failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Text style={styles.okText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.noBtn, busy && styles.disabledBtn]}
                      disabled={busy || ((appRole === "employer" || appRole === "agency") && !gate.hasPlan)}
                      onPress={async () => {
                        if ((appRole === "employer" || appRole === "agency") && !gate.hasPlan) {
                          Alert.alert("Subscription required", "Please purchase a plan to reject leave.");
                          return;
                        }
                        setBusy(true);
                        try {
                          await api.post("/Api/HRMS/Leave/Decision", { id: Number(item?.id ?? 0), status: "Rejected" });
                          await refresh();
                        } catch (e: any) {
                          Alert.alert("Error", e?.error ?? "Reject failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Text style={styles.noText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No leave records</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  formCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
  },
  paywall: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
  },
  paywallText: { fontSize: 12, opacity: 0.8, fontWeight: "800" },
  paywallBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: "#111" },
  paywallBtnText: { color: "#fff", fontWeight: "900" },
  formTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
    paddingHorizontal: 12,
    marginTop: 10,
    color: "inherit" as any,
  },
  formActions: { marginTop: 12, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  primaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#2563eb",
  },
  primaryBtnText: { color: "white", fontWeight: "700" },
  ghostBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
  },
  ghostBtnText: { fontWeight: "600", opacity: 0.8 },
  disabledBtn: { opacity: 0.5 },
  loadingWrap: { padding: 18 },
  list: { paddingVertical: 14, gap: 10 },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
  },
  cardLine: { fontSize: 13, opacity: 0.85 },
  actionsRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  okBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: "rgba(16,185,129,0.25)" },
  noBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(220,38,38,0.12)", borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" },
  okText: { fontWeight: "800" },
  noText: { fontWeight: "800" },
  emptyWrap: { paddingVertical: 24, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
