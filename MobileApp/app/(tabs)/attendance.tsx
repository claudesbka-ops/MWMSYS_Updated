import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import { useHrmsService } from "@/services/hrmsService";
import { useSession } from "@/contexts/SessionContext";
import { useApiClient } from "@/services/apiClient";

export default function AttendanceScreen() {
  const hrms = useHrmsService();
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? "").toString();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = appRole === "worker" ? await hrms.getMyAttendance() : await api.get<any[]>("/Api/HRMS/Attendance");
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const openExists = useMemo(() => {
    return (rows ?? []).some((r) => r && r.checkIn && !r.checkOut);
  }, [rows]);

  const handleClockIn = async () => {
    if (appRole !== "worker") return;
    setBusy(true);
    try {
      await hrms.clockIn({});
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Clock-in failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClockOut = async () => {
    if (appRole !== "worker") return;
    setBusy(true);
    try {
      await hrms.clockOut();
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Clock-out failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance</Text>
      <Text style={styles.subtitle}>Clock in/out and view your records</Text>

      <View style={styles.actionsRow}>
        {appRole === "worker" ? (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, (busy || openExists) && styles.disabledBtn]}
              onPress={handleClockIn}
              disabled={busy || openExists}
            >
              <Text style={styles.primaryBtnText}>Clock In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, (busy || !openExists) && styles.disabledBtn]}
              onPress={handleClockOut}
              disabled={busy || !openExists}
            >
              <Text style={styles.secondaryBtnText}>Clock Out</Text>
            </TouchableOpacity>
          </>
        ) : null}
        <TouchableOpacity style={[styles.ghostBtn, busy && styles.disabledBtn]} onPress={refresh} disabled={busy}>
          <Text style={styles.ghostBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

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
            const checkIn = item?.checkIn ? new Date(String(item.checkIn)).toLocaleString() : "";
            const checkOut = item?.checkOut ? new Date(String(item.checkOut)).toLocaleString() : "—";
            return (
              <View style={styles.card}>
                <Text style={styles.cardLine}>In: {checkIn}</Text>
                <Text style={styles.cardLine}>Out: {checkOut}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No attendance records</Text>
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
  actionsRow: { marginTop: 14, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  primaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#2563eb",
  },
  primaryBtnText: { color: "white", fontWeight: "700" },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(37,99,235,0.15)",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.25)",
  },
  secondaryBtnText: { fontWeight: "700" },
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
  emptyWrap: { paddingVertical: 40, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
