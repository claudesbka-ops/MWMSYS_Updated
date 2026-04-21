import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { io, type Socket } from "socket.io-client";
import MapView, { Callout, Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";

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
  const socketRef = useRef<Socket | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const [rows, setRows] = useState<WorkerLocationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        Alert.alert("Map", e?.error ?? "Unable to load locations");
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

  useEffect(() => {
    if (!mapRef.current) return;
    if (selectedId) return;
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
  }, [markers, selectedId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Map</Text>
      <Text style={styles.subtitle}>Live worker locations (real-time)</Text>

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
            const title = r.name ? `${r.name}` : r.workerId;
            const subtitle = r.name ? r.workerId : "";
            return (
              <Marker
                key={r.workerId}
                coordinate={{ latitude: r.lat as number, longitude: r.lng as number }}
                pinColor={stale ? "#94a3b8" : "#22c55e"}
                onPress={() => setSelectedId(r.workerId)}
              >
                <Callout>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{title}</Text>
                    {subtitle ? <Text style={styles.calloutMeta}>{subtitle}</Text> : null}
                    <Text style={styles.calloutMeta}>{stale ? "Stale" : "Live"}</Text>
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
            <Text style={styles.empty}>No locations yet</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  empty: { opacity: 0.7 },
  mapCard: { marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", overflow: "hidden", flex: 1 },
  map: { flex: 1 },
  emptyOverlay: { position: "absolute", top: 16, left: 16, right: 16, padding: 12, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.35)" },
  callout: { width: 220, paddingVertical: 6 },
  calloutTitle: { fontSize: 14, fontWeight: "800" },
  calloutMeta: { marginTop: 4, fontSize: 12, opacity: 0.8 },
});
