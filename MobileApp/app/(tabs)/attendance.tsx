import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Text, View } from "@/components/Themed";
import type { AttendanceRow } from "@/services/hrmsService";
import { useSession } from "@/contexts/SessionContext";
import { useApiClient } from "@/services/apiClient";
import { useAttendance } from "@/hooks/useAttendance";
import { useGeoFix } from "@/hooks/useGeoFix";
import { captureSelfie } from "@/services/mediaService";

export default function AttendanceScreen() {
  const session = useSession();
  const appRole = (session.claims?.appRole ?? "").toString();
  const isWorker = appRole === "worker";

  return isWorker ? <WorkerView /> : <SupervisorView />;
}

function WorkerView() {
  const attendance = useAttendance();
  const geo = useGeoFix();
  const [busy, setBusy] = useState(false);

  const rows = (attendance.query.data ?? []) as AttendanceRow[];
  const loading = attendance.query.isLoading;
  const openExists = useMemo(() => rows.some((r) => r && r.checkIn && !r.checkOut), [rows]);
  const queueCount = attendance.queue.entries.length;

  const handleClockIn = useCallback(async () => {
    setBusy(true);
    try {
      const fix = await geo.acquire({ timeoutMs: 12000 });
      // Photo is optional — user can skip if camera denied or cancelled.
      const photo = await captureSelfie().catch(() => null);

      const result = await attendance.clockIn.mutateAsync({
        lat: fix?.lat ?? null,
        lng: fix?.lng ?? null,
        photo,
      });

      if ((result as any)?.queued) {
        Alert.alert("Saved offline", "Clock-in queued — will sync when connection returns.");
      }
    } catch (e: any) {
      Alert.alert("Clock-in failed", e?.error ?? e?.message ?? "Unexpected error");
    } finally {
      setBusy(false);
    }
  }, [attendance, geo]);

  const handleClockOut = useCallback(async () => {
    setBusy(true);
    try {
      await attendance.clockOut.mutateAsync();
    } catch (e: any) {
      Alert.alert("Clock-out failed", e?.error ?? e?.message ?? "Unexpected error");
    } finally {
      setBusy(false);
    }
  }, [attendance]);

  const handleDrainQueue = useCallback(async () => {
    const r = await attendance.queue.drain();
    Alert.alert("Sync", `Processed ${r.processed}, remaining ${r.remaining}.`);
  }, [attendance.queue]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance</Text>
      <Text style={styles.subtitle}>
        {geo.loading
          ? "Acquiring location..."
          : geo.fix
          ? `Location ready (±${Math.round(geo.fix.accuracy ?? 0)}m)`
          : "Clock in/out and view your records"}
      </Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.primaryBtn, (busy || openExists) && styles.disabledBtn]}
          onPress={handleClockIn}
          disabled={busy || openExists}
        >
          <Text style={styles.primaryBtnText}>{busy ? "Working..." : "Clock In"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, (busy || !openExists) && styles.disabledBtn]}
          onPress={handleClockOut}
          disabled={busy || !openExists}
        >
          <Text style={styles.secondaryBtnText}>Clock Out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ghostBtn, busy && styles.disabledBtn]}
          onPress={() => attendance.query.refetch()}
          disabled={busy}
        >
          <Text style={styles.ghostBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {queueCount > 0 && (
        <TouchableOpacity style={styles.queueBanner} onPress={handleDrainQueue}>
          <Text style={styles.queueBannerText}>
            {queueCount} pending clock-in{queueCount > 1 ? "s" : ""} — tap to retry sync
          </Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <AttendanceList rows={rows} />
      )}
    </View>
  );
}

function SupervisorView() {
  const api = useApiClient();
  const query = useQuery<AttendanceRow[]>({
    queryKey: ["attendance", "scope"],
    queryFn: () => api.get<AttendanceRow[]>("/Api/HRMS/Attendance"),
    staleTime: 30_000,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance</Text>
      <Text style={styles.subtitle}>Team attendance records</Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => query.refetch()}>
          <Text style={styles.ghostBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {query.isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <AttendanceList rows={query.data ?? []} />
      )}
    </View>
  );
}

function AttendanceList({ rows }: { rows: AttendanceRow[] }) {
  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => String(item?.id ?? Math.random())}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const checkIn = item?.checkIn ? new Date(String(item.checkIn)).toLocaleString() : "";
        const checkOut = item?.checkOut ? new Date(String(item.checkOut)).toLocaleString() : "—";
        const coords =
          item?.lat != null && item?.lng != null
            ? `${Number(item.lat).toFixed(5)}, ${Number(item.lng).toFixed(5)}`
            : null;
        return (
          <View style={styles.card}>
            <Text style={styles.cardLine}>In: {checkIn}</Text>
            <Text style={styles.cardLine}>Out: {checkOut}</Text>
            {coords && <Text style={styles.cardMeta}>Geo: {coords}</Text>}
            {item?.photoUrl && <Text style={styles.cardMeta}>Photo: yes</Text>}
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No attendance records</Text>
        </View>
      }
    />
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
  cardMeta: { marginTop: 4, fontSize: 11, opacity: 0.6 },
  emptyWrap: { paddingVertical: 40, alignItems: "center" },
  emptyText: { opacity: 0.7 },
  queueBanner: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
  },
  queueBannerText: { fontSize: 12, fontWeight: "700", color: "#92400e" },
});
