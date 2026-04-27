import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { io, type Socket } from "socket.io-client";
import MapView, { Callout, Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { Text, View } from "react-native";
import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Screen } from "@/components/ui";

type WorkerLocationRow = {
  workerId: string;
  name?: string | null;
  lat: number | null;
  lng: number | null;
  accuracy?: number | null;
  updatedAt?: string | null;
};

export default function LiveMapScreen() {
  const session = useSession();
  const api = useApiClient();
  const params = useLocalSearchParams<{ focus?: string }>();
  const focusId = useMemo(() => (params.focus ?? "").toString().trim() || null, [params.focus]);
  const socketRef = useRef<Socket | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const focusedOnceRef = useRef<boolean>(false);
  const [rows, setRows] = useState<WorkerLocationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(focusId);

  const socketUrl = useMemo(() => session.apiBaseUrl.replace(/\/+$/, ""), [session.apiBaseUrl]);

  const nowMs = Date.now();
  const isStale = (updatedAt?: string | null) => {
    if (!updatedAt) return true;
    const t = new Date(updatedAt).getTime();
    if (!Number.isFinite(t)) return true;
    return nowMs - t > 2 * 60 * 1000;
  };

  const markers = useMemo(() => {
    return (rows ?? []).filter((r) => r.lat != null && r.lng != null);
  }, [rows]);

  const initialRegion: Region = useMemo(() => {
    const first = markers[0];
    if (first?.lat != null && first?.lng != null) {
      return {
        latitude: first.lat,
        longitude: first.lng,
        latitudeDelta: 0.25,
        longitudeDelta: 0.25,
      };
    }
    return {
      latitude: 3.139,
      longitude: 101.6869,
      latitudeDelta: 0.35,
      longitudeDelta: 0.35,
    };
  }, [markers]);

  useEffect(() => {
    if (!session.token) return;

    api
      .get<{ rows: WorkerLocationRow[] }>("/Api/Workers/Locations")
      .then((res) => {
        const incoming = Array.isArray((res as any)?.rows) ? ((res as any).rows as WorkerLocationRow[]) : [];
        setRows(incoming);
      })
      .catch((e: any) => {
        Alert.alert("🗜️ Map", e?.error ?? "Unable to load locations");
      });

    const s = io(socketUrl, {
      transports: ["websocket"],
      auth: {
        token: `Bearer ${session.token}`,
      },
    });

    socketRef.current = s;

    const onUpdate = (payload: any) => {
      const workerId = (payload?.workerId ?? "").toString();
      if (!workerId) return;

      const next: WorkerLocationRow = {
        workerId,
        name: payload?.name ?? null,
        lat: typeof payload?.lat === "number" ? payload.lat : Number(payload?.lat),
        lng: typeof payload?.lng === "number" ? payload.lng : Number(payload?.lng),
        accuracy: payload?.accuracy != null ? Number(payload.accuracy) : null,
        updatedAt: payload?.updatedAt ?? null,
      };

      setRows((prev) => {
        const idx = prev.findIndex((r) => r.workerId === workerId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...next };
          return copy;
        }
        return [next, ...prev];
      });
    };

    s.on("worker_location_update", onUpdate);

    return () => {
      try {
        s.off("worker_location_update", onUpdate);
        s.disconnect();
      } catch {
        // ignore
      }
      socketRef.current = null;
    };
  }, [api, session.token, socketUrl]);

  // Focus an explicit worker passed via the `focus` route param. Runs once
  // when that worker first appears on the map.
  useEffect(() => {
    if (!mapRef.current) return;
    if (!focusId) return;
    if (focusedOnceRef.current) return;
    const target = markers.find((r) => r.workerId === focusId);
    if (!target || target.lat == null || target.lng == null) return;

    try {
      mapRef.current.animateToRegion(
        {
          latitude: target.lat,
          longitude: target.lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        650
      );
      setSelectedId(target.workerId);
      focusedOnceRef.current = true;
    } catch {
      // ignore
    }
  }, [markers, focusId]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (selectedId) return;
    if (focusId) return;
    if (!markers.length) return;

    const first = markers[0];
    if (first.lat == null || first.lng == null) return;
    try {
      mapRef.current.animateToRegion(
        {
          latitude: first.lat,
          longitude: first.lng,
          latitudeDelta: 0.25,
          longitudeDelta: 0.25,
        },
        650
      );
    } catch {
      // ignore
    }
  }, [markers, selectedId, focusId]);

  return (
    <Screen
      title="🗺️ Live Map"
      subtitle={focusId ? `🎯 Focusing worker ${focusId}` : `👥 ${markers.length} worker${markers.length === 1 ? '' : 's'} on map`}
      gradient={["#ec4899", "#8b5cf6", "#6366f1"]}
      scroll={false}
      contentStyle={{ flex: 1, paddingBottom: 18 }}
    >
      <View style={styles.mapCard}>
        <MapView
          ref={(r) => {
            mapRef.current = r;
          }}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={initialRegion}
          onPress={() => setSelectedId(null)}
        >
          {markers.map((r) => {
            const stale = isStale(r.updatedAt);
            const isFocused = focusId === r.workerId;
            const title = r.name ? `${r.name}` : r.workerId;
            const subtitle = r.name ? r.workerId : "";
            const pinColor = isFocused ? "#ef4444" : stale ? "#94a3b8" : "#22c55e";
            return (
              <Marker
                key={r.workerId}
                coordinate={{ latitude: r.lat as number, longitude: r.lng as number }}
                pinColor={pinColor}
                onPress={() => setSelectedId(r.workerId)}
              >
                <Callout>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{isFocused ? `🎯 ${title}` : title}</Text>
                    {subtitle ? <Text style={styles.calloutMeta}>{subtitle}</Text> : null}
                    <Text style={styles.calloutMeta}>{stale ? "⚫ Stale" : "🟢 Live"}</Text>
                    <Text style={styles.calloutMeta}>
                      {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>

        {!markers.length ? (
          <View style={styles.emptyOverlay}>
            <Text style={styles.empty}>⏳ Waiting for location pings…</Text>
          </View>
        ) : focusId && !markers.some((r) => r.workerId === focusId) ? (
          <View style={styles.focusBanner}>
            <Text style={styles.focusText}>🎯 Waiting for {focusId}’s next ping…</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: 'white', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  mapCard: {
    borderRadius: 22,
    overflow: 'hidden',
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.12)',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },
  map: { flex: 1 },
  emptyOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.85)',
  },
  callout: { width: 220, paddingVertical: 6 },
  calloutTitle: { fontSize: 14, fontWeight: '800' },
  calloutMeta: { marginTop: 4, fontSize: 12, color: 'rgba(15,23,42,0.7)' },
  focusBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.92)',
  },
  focusText: { color: 'white', fontSize: 12, fontWeight: '800', textAlign: 'center' },
});
