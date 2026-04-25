import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import type { AttendanceRow } from "@/services/hrmsService";
import { useSession } from "@/contexts/SessionContext";
import { useApiClient } from "@/services/apiClient";
import { useAttendance } from "@/hooks/useAttendance";
import { useGeoFix } from "@/hooks/useGeoFix";
import { captureSelfie } from "@/services/mediaService";
import { Screen, PrimaryButton, GhostButton, Card, SectionTitle, ListItemCard } from "@/components/ui";

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

  const subtitle = geo.loading
    ? "Acquiring location…"
    : geo.fix
    ? `Location ready (±${Math.round(geo.fix.accuracy ?? 0)}m)`
    : "Clock in/out and view your records";

  return (
    <Screen
      title="Attendance"
      subtitle={subtitle}
      gradient={["#10b981", "#22d3ee", "#6366f1"]}
      refreshing={loading}
      onRefresh={() => attendance.query.refetch()}
    >
      <Card tight>
        <Text style={styles.statusHint}>Today</Text>
        <Text style={styles.statusValue}>
          {openExists ? "You are clocked in" : "Not clocked in"}
        </Text>
        <View style={styles.actionsRow}>
          {!openExists ? (
            <PrimaryButton
              title={busy ? "Working…" : "Clock In"}
              variant="success"
              loading={busy}
              onPress={handleClockIn}
              style={{ flex: 1 }}
            />
          ) : (
            <PrimaryButton
              title={busy ? "Working…" : "Clock Out"}
              variant="danger"
              loading={busy}
              onPress={handleClockOut}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </Card>

      {queueCount > 0 && (
        <TouchableOpacity onPress={handleDrainQueue} style={styles.queueBanner} activeOpacity={0.85}>
          <Text style={styles.queueBannerText}>
            {queueCount} pending clock-in{queueCount > 1 ? "s" : ""} — tap to retry sync
          </Text>
        </TouchableOpacity>
      )}

      <SectionTitle title={`Recent records (${rows.length})`} />
      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : (
        <AttendanceList rows={rows} />
      )}
    </Screen>
  );
}

function SupervisorView() {
  const api = useApiClient();
  const query = useQuery<AttendanceRow[]>({
    queryKey: ["attendance", "scope"],
    queryFn: () => api.get<AttendanceRow[]>("/Api/HRMS/Attendance"),
    staleTime: 30_000,
  });

  const rows = query.data ?? [];
  return (
    <Screen
      title="Attendance"
      subtitle={`Team records • ${rows.length}`}
      gradient={["#6366f1", "#8b5cf6", "#ec4899"]}
      refreshing={query.isFetching}
      onRefresh={() => query.refetch()}
    >
      <SectionTitle title="All entries" />
      {query.isLoading ? (
        <ActivityIndicator color="#6366f1" />
      ) : (
        <AttendanceList rows={rows} />
      )}
    </Screen>
  );
}

function AttendanceList({ rows }: { rows: AttendanceRow[] }) {
  if (!rows.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No attendance records yet.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {rows.map((item, idx) => {
        const checkIn = item?.checkIn ? new Date(String(item.checkIn)).toLocaleString() : "";
        const checkOut = item?.checkOut ? new Date(String(item.checkOut)).toLocaleString() : null;
        const coords =
          item?.lat != null && item?.lng != null
            ? `${Number(item.lat).toFixed(4)}, ${Number(item.lng).toFixed(4)}`
            : null;
        const open = !!item?.checkIn && !item?.checkOut;
        return (
          <ListItemCard
            key={String(item?.id ?? idx)}
            title={`In: ${checkIn || '—'}`}
            subtitle={checkOut ? `Out: ${checkOut}` : 'Still clocked in'}
            meta={coords ? `Geo ${coords}${item?.photoUrl ? ' • selfie attached' : ''}` : item?.photoUrl ? 'Selfie attached' : undefined}
            icon="clock-o"
            iconGradient={open ? ['#10b981', '#22d3ee'] : ['#6366f1', '#8b5cf6']}
            badge={open ? { label: 'Open', tone: 'emerald' } : { label: 'Closed', tone: 'slate' }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  statusHint: { fontSize: 11, fontWeight: '800', color: 'rgba(15,23,42,0.55)', letterSpacing: 0.4, textTransform: 'uppercase' },
  statusValue: { marginTop: 6, fontSize: 20, fontWeight: '800', color: '#0f172a' },
  actionsRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { color: 'rgba(15,23,42,0.55)', fontSize: 13 },
  queueBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  queueBannerText: { fontSize: 12, fontWeight: '800', color: '#92400e' },
});
