import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import type { AttendanceRow } from "@/services/hrmsService";
import { useSession } from "@/contexts/SessionContext";
import { useApiClient } from "@/services/apiClient";
import { useAttendance } from "@/hooks/useAttendance";
import { useGeoFix } from "@/hooks/useGeoFix";
import { captureSelfie } from "@/services/mediaService";
import { Screen, SectionTitle, ListItemCard } from "@/components/ui";

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
  const [now, setNow] = useState(() => new Date());

  // tick every 30s so the live "elapsed" clock keeps fresh
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const rows = (attendance.query.data ?? []) as AttendanceRow[];
  const loading = attendance.query.isLoading;
  const openRow = useMemo(() => rows.find((r) => r && r.checkIn && !r.checkOut), [rows]);
  const openExists = !!openRow;
  const queueCount = attendance.queue.entries.length;

  const todayHoursMinutes = useMemo(() => computeTodayMinutes(rows, now, openRow), [rows, now, openRow]);
  const streakDays = useMemo(() => computeStreak(rows), [rows]);

  const handleClockIn = useCallback(async () => {
    setBusy(true);
    try {
      const fix = await geo.acquire({ timeoutMs: 12000 });
      const photo = await captureSelfie().catch(() => null);
      const result = await attendance.clockIn.mutateAsync({
        lat: fix?.lat ?? null,
        lng: fix?.lng ?? null,
        photo,
      });
      if ((result as any)?.queued) {
        Alert.alert("📥 Saved offline", "Clock-in queued — will sync when connection returns.");
      }
    } catch (e: any) {
      Alert.alert("⚠️ Clock-in failed", e?.error ?? e?.message ?? "Unexpected error");
    } finally {
      setBusy(false);
    }
  }, [attendance, geo]);

  const handleClockOut = useCallback(async () => {
    setBusy(true);
    try {
      const fix = await geo.acquire({ timeoutMs: 12000 });
      await attendance.clockOut.mutateAsync({
        lat: fix?.lat ?? null,
        lng: fix?.lng ?? null,
      });
    } catch (e: any) {
      Alert.alert("⚠️ Clock-out failed", e?.error ?? e?.message ?? "Unexpected error");
    } finally {
      setBusy(false);
    }
  }, [attendance, geo]);

  const handleDrainQueue = useCallback(async () => {
    const r = await attendance.queue.drain();
    Alert.alert("☁️ Sync", `Processed ${r.processed}, remaining ${r.remaining}.`);
  }, [attendance.queue]);

  const subtitle = geo.loading
    ? "📜 Acquiring location…"
    : geo.fix
    ? `📍 Location ready (±${Math.round(geo.fix.accuracy ?? 0)}m)`
    : "Clock in/out and view your records";

  const elapsedLabel = openRow?.checkIn
    ? formatElapsed(new Date(String(openRow.checkIn)), now)
    : "—";

  return (
    <Screen
      title="⏰ Attendance"
      subtitle={subtitle}
      gradient={["#10b981", "#22d3ee", "#6366f1"]}
      refreshing={loading}
      onRefresh={() => attendance.query.refetch()}
    >
      <ClockHero
        clockedIn={openExists}
        elapsed={elapsedLabel}
        loading={busy}
        onPress={openExists ? handleClockOut : handleClockIn}
      />

      <View style={styles.statRow}>
        <StatPill icon="hourglass-half" label="⏳ Today" value={formatHM(todayHoursMinutes)} gradient={["#0ea5e9", "#6366f1"]} />
        <StatPill icon="fire" label="🔥 Streak" value={`${streakDays}d`} gradient={["#f97316", "#ef4444"]} />
        <StatPill icon="map-marker" label="📍 Geo" value={geo.fix ? "✅" : "—"} gradient={["#10b981", "#06b6d4"]} />
      </View>

      {queueCount > 0 && (
        <TouchableOpacity onPress={handleDrainQueue} style={styles.queueBanner} activeOpacity={0.85}>
          <FontAwesome name="cloud-upload" size={14} color="#92400e" />
          <Text style={styles.queueBannerText}>
            ☁️ {queueCount} pending clock-in{queueCount > 1 ? "s" : ""} — tap to retry sync
          </Text>
        </TouchableOpacity>
      )}

      <SectionTitle title={`📜 Recent records (${rows.length})`} />
      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : (
        <AttendanceList rows={rows} />
      )}
    </Screen>
  );
}

function ClockHero({
  clockedIn,
  elapsed,
  loading,
  onPress,
}: {
  clockedIn: boolean;
  elapsed: string;
  loading: boolean;
  onPress: () => void;
}) {
  const press = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (clockedIn) {
      ring.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), -1, false);
    }
    return () => cancelAnimation(ring);
  }, [clockedIn, ring]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ring.value * 0.45 }],
    opacity: 0.4 * (1 - ring.value),
  }));
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const colors = clockedIn ? ["#ef4444", "#f97316"] : ["#10b981", "#06b6d4"];
  const label = loading ? "WORKING…" : clockedIn ? "CLOCK OUT" : "CLOCK IN";
  const icon = clockedIn ? "stop-circle" : "play-circle";

  return (
    <View style={heroStyles.wrap}>
      <View style={heroStyles.center}>
        {clockedIn && <Animated.View style={[heroStyles.ring, ringStyle]} />}
        <Pressable
          onPress={onPress}
          disabled={loading}
          onPressIn={() => {
            press.value = withTiming(0.95, { duration: 80 });
          }}
          onPressOut={() => {
            press.value = withTiming(1, { duration: 120 });
          }}
        >
          <Animated.View style={buttonStyle}>
            <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={heroStyles.button}>
              <FontAwesome name={icon} size={42} color="#fff" />
              <Text style={heroStyles.buttonText}>{label}</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </View>

      <View style={heroStyles.statusBar}>
        <View style={[heroStyles.dot, { backgroundColor: clockedIn ? "#10b981" : "#94a3b8" }]} />
        <Text style={heroStyles.statusLabel}>
          {clockedIn ? `🟢 On the clock · ${elapsed}` : "⚫ Not clocked in"}
        </Text>
      </View>
    </View>
  );
}

function StatPill({
  icon,
  label,
  value,
  gradient,
}: {
  icon: keyof typeof FontAwesome.glyphMap;
  label: string;
  value: string;
  gradient: readonly [string, string];
}) {
  return (
    <View style={styles.statPill}>
      <LinearGradient colors={gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statIcon}>
        <FontAwesome name={icon} size={14} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
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

  const rows = query.data ?? [];
  return (
    <Screen
      title="👥 Team Attendance"
      subtitle={`Team records • ${rows.length}`}
      gradient={["#6366f1", "#8b5cf6", "#ec4899"]}
      refreshing={query.isFetching}
      onRefresh={() => query.refetch()}
    >
      <SectionTitle title="📜 All entries" />
      {query.isLoading ? <ActivityIndicator color="#6366f1" /> : <AttendanceList rows={rows} />}
    </Screen>
  );
}

function AttendanceList({ rows }: { rows: AttendanceRow[] }) {
  if (!rows.length) {
    return (
      <View style={styles.empty}>
        <FontAwesome name="clock-o" size={36} color="rgba(99,102,241,0.35)" />
        <Text style={styles.emptyText}>No attendance records yet ⏳</Text>
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
            title={`In: ${checkIn || "—"}`}
            subtitle={checkOut ? `Out: ${checkOut}` : "Still clocked in"}
            meta={coords ? `Geo ${coords}${item?.photoUrl ? " • selfie attached" : ""}` : item?.photoUrl ? "Selfie attached" : undefined}
            icon="clock-o"
            iconGradient={open ? ["#10b981", "#22d3ee"] : ["#6366f1", "#8b5cf6"]}
            badge={open ? { label: "Open", tone: "emerald" } : { label: "Closed", tone: "slate" }}
          />
        );
      })}
    </View>
  );
}

// ---------- helpers ----------

function computeTodayMinutes(rows: AttendanceRow[], now: Date, openRow: AttendanceRow | undefined): number {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let total = 0;
  for (const r of rows) {
    if (!r?.checkIn) continue;
    const inT = new Date(String(r.checkIn)).getTime();
    if (inT < startOfDay) continue;
    const outT = r.checkOut ? new Date(String(r.checkOut)).getTime() : openRow && r === openRow ? now.getTime() : null;
    if (outT == null) continue;
    total += Math.max(0, outT - inT);
  }
  return Math.round(total / 60000);
}

function computeStreak(rows: AttendanceRow[]): number {
  const days = new Set<string>();
  for (const r of rows) {
    if (!r?.checkIn) continue;
    const d = new Date(String(r.checkIn));
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    days.add(k);
  }
  let streak = 0;
  const cursor = new Date();
  // Look back day-by-day until we find a missing day.
  for (let i = 0; i < 90; i++) {
    const k = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (days.has(k)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function formatHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatElapsed(start: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - start.getTime());
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const heroStyles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.08)",
    alignItems: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  center: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(16,185,129,0.5)",
  },
  button: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  buttonText: { marginTop: 8, fontSize: 22, fontWeight: "900", color: "#ffffff", letterSpacing: 2 },

  statusBar: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.08)",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: "800", color: "#0f172a" },
});

const styles = StyleSheet.create({
  statRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.08)",
  },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: 10, fontWeight: "800", color: "rgba(15,23,42,0.5)", letterSpacing: 0.4, textTransform: "uppercase" },
  statValue: { marginTop: 2, fontSize: 14, fontWeight: "800", color: "#0f172a" },

  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13 },

  queueBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
  },
  queueBannerText: { fontSize: 12, fontWeight: "800", color: "#92400e", flex: 1 },
});
