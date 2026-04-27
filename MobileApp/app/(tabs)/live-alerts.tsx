import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { io, type Socket } from "socket.io-client";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Screen, GhostButton, PrimaryButton, Card, SectionTitle } from "@/components/ui";

type AlertRow = {
  id: number;
  kind: "new_trigger" | "panic_forwarded";
  title: string;
  description: string;
  workerId?: string | null;
  companyName?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export default function LiveAlertsScreen() {
  const router = useRouter();
  const session = useSession();
  const api = useApiClient();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const roleId = useMemo(() => Number((session.claims as any)?.roleId ?? 0), [session.claims]);

  const socketUrl = useMemo(() => {
    return session.apiBaseUrl.replace(/\/+$/, "");
  }, [session.apiBaseUrl]);

  useEffect(() => {
    if (!session.token) return;

    api
      .get<{ rows: AlertRow[] }>("/Api/Alerts/Recent?limit=50")
      .then((res) => {
        const incoming = Array.isArray((res as any)?.rows) ? ((res as any).rows as AlertRow[]) : [];
        if (incoming.length) {
          setRows((prev) => {
            const seen = new Set(prev.map((r) => `${r.kind}:${r.id}`));
            const merged = [...incoming.filter((r) => !seen.has(`${r.kind}:${r.id}`)), ...prev];
            return merged;
          });
        }
      })
      .catch(() => undefined);

    const s = io(socketUrl, {
      transports: ["websocket"],
      auth: {
        token: `Bearer ${session.token}`,
      },
    });

    socketRef.current = s;

    const onNewTrigger = (payload: any) => {
      const id = Number(payload?.id ?? payload?.ID ?? Date.now());
      setRows((prev) => [
        {
          id,
          kind: "new_trigger",
          title: String(payload?.title ?? payload?.Title ?? "Alert"),
          description: String(payload?.description ?? payload?.Description ?? ""),
          workerId: payload?.workerId ?? payload?.worker_ID ?? null,
          companyName: payload?.companyName ?? payload?.Company_Name ?? null,
          status: (payload?.status ?? payload?.ProbStatus ?? null) as any,
          createdAt: payload?.createdAt ?? null,
        },
        ...prev,
      ]);
    };

    const onForwarded = (payload: any) => {
      const id = Number(payload?.id ?? payload?.ID ?? Date.now());
      setRows((prev) => [
        {
          id,
          kind: "panic_forwarded",
          title: String(payload?.title ?? payload?.Title ?? "Forwarded"),
          description: String(payload?.description ?? payload?.Description ?? ""),
          workerId: payload?.workerId ?? payload?.worker_ID ?? null,
          companyName: payload?.companyName ?? payload?.Company_Name ?? null,
          status: (payload?.status ?? payload?.ProbStatus ?? null) as any,
          createdAt: payload?.createdOn ?? payload?.Updated_On ?? null,
        },
        ...prev,
      ]);
    };

    const onApproved = (payload: any) => {
      const id = Number(payload?.id ?? payload?.ID ?? 0);
      if (!id) return;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Approved" } : r)));
    };

    s.on("connect_error", () => {
      // silent; user can inspect API base URL/token
    });

    s.on("new_trigger", onNewTrigger);
    s.on("panic_forwarded", onForwarded);
    s.on("incident_approved", onApproved);

    return () => {
      try {
        s.off("new_trigger", onNewTrigger);
        s.off("panic_forwarded", onForwarded);
        s.off("incident_approved", onApproved);
        s.disconnect();
      } catch {
        // ignore
      }
      socketRef.current = null;
    };
  }, [api, socketUrl, session.token]);

  const approveIncident = async (id: number) => {
    try {
      await api.post("/Api/Incidents/Approve", { id });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Approved" } : r)));
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Unable to approve");
    }
  };

  return (
    <Screen
      title="🔔 Live Alerts"
      subtitle="📡 Real-time panic and incident feed"
      gradient={["#ef4444", "#f97316", "#a855f7"]}
    >
      <View style={styles.actionsRow}>
        <PrimaryButton
          title="🗺️ Open Live Map"
          onPress={() => router.push("/(tabs)/live-map" as any)}
          style={{ flex: 1 }}
        />
        <GhostButton
          title="🧹 Clear all"
          onPress={() => {
            Alert.alert("🧹 Clear", "Clear all alerts?", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", style: "destructive", onPress: () => setRows([]) },
            ]);
          }}
        />
      </View>

      <SectionTitle title={`📡 Feed (${rows.length})`} />

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="bell-o" size={36} color="rgba(239,68,68,0.35)" />
          <Text style={styles.emptyText}>⏳ Waiting for incoming alerts…</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item) => {
            const kindLabel = item.kind === 'new_trigger' ? '🚨 New trigger' : '↪️ Forwarded';
            const status = String(item.status ?? '');
            const canApprove = roleId === 1 && status.toLowerCase() === 'pending';
            const wid = item.workerId ? String(item.workerId) : '';
            const showMap = !!wid;
            return (
              <Card key={`${item.kind}:${item.id}`} tight>
                <View style={styles.kindRow}>
                  <View style={[styles.kindPill, item.kind === 'new_trigger' ? styles.kindPillTrigger : styles.kindPillForward]}>
                    <Text style={styles.kindText}>{kindLabel}</Text>
                  </View>
                  {status ? (
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>{status}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
                {wid ? <Text style={styles.meta}>👷 Worker: {wid}</Text> : null}
                {item.companyName ? <Text style={styles.meta}>🏢 Company: {String(item.companyName)}</Text> : null}

                <View style={styles.cardActions}>
                  {showMap ? (
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: "/(tabs)/live-map", params: { focus: wid } } as any)}
                      style={styles.mapBtn}
                      activeOpacity={0.85}
                    >
                      <FontAwesome name="map-marker" size={12} color="#4f46e5" />
                      <Text style={styles.mapBtnText}>🗺️ View on map</Text>
                    </TouchableOpacity>
                  ) : null}
                  {canApprove ? (
                    <PrimaryButton
                      title="✅ Approve incident"
                      variant="success"
                      style={{ flex: 1 }}
                      onPress={() => approveIncident(item.id)}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kindPill: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
  kindPillTrigger: { backgroundColor: 'rgba(239,68,68,0.14)' },
  kindPillForward: { backgroundColor: 'rgba(14,165,233,0.14)' },
  kindText: { fontSize: 10, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.3 },
  statusPill: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(245,158,11,0.14)' },
  statusText: { fontSize: 10, fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.3 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  cardDesc: { marginTop: 4, fontSize: 12, color: 'rgba(15,23,42,0.7)' },
  meta: { marginTop: 4, fontSize: 11, color: 'rgba(15,23,42,0.5)' },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { color: 'rgba(15,23,42,0.55)', fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  cardActions: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(79,70,229,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.22)',
  },
  mapBtnText: { fontSize: 12, fontWeight: '800', color: '#4f46e5' },
});
