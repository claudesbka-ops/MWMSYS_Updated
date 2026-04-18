import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { io, type Socket } from "socket.io-client";

import { Text, View } from "@/components/Themed";
import { useSession } from "@/contexts/SessionContext";

type AlertRow = {
  id: number;
  kind: "new_trigger" | "panic_forwarded";
  title: string;
  description: string;
  workerId?: string | null;
  companyName?: string | null;
  createdAt?: string | null;
};

export default function LiveAlertsScreen() {
  const session = useSession();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const socketUrl = useMemo(() => {
    return session.apiBaseUrl.replace(/\/+$/, "");
  }, [session.apiBaseUrl]);

  useEffect(() => {
    if (!session.token) return;

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
          createdAt: payload?.createdOn ?? payload?.Updated_On ?? null,
        },
        ...prev,
      ]);
    };

    s.on("connect_error", () => {
      // silent; user can inspect API base URL/token
    });

    s.on("new_trigger", onNewTrigger);
    s.on("panic_forwarded", onForwarded);

    return () => {
      try {
        s.off("new_trigger", onNewTrigger);
        s.off("panic_forwarded", onForwarded);
        s.disconnect();
      } catch {
        // ignore
      }
      socketRef.current = null;
    };
  }, [socketUrl, session.token]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Alerts</Text>
      <Text style={styles.subtitle}>Real-time panic/incident feed</Text>

      <TouchableOpacity
        style={styles.clearBtn}
        onPress={() => {
          Alert.alert("Clear", "Clear all alerts?", [
            { text: "Cancel", style: "cancel" },
            { text: "Clear", style: "destructive", onPress: () => setRows([]) },
          ]);
        }}
      >
        <Text style={styles.clearText}>Clear</Text>
      </TouchableOpacity>

      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>[{item.kind}] {item.title}</Text>
            <Text style={styles.cardDesc}>{item.description || "—"}</Text>
            {item.workerId ? <Text style={styles.meta}>Worker: {String(item.workerId)}</Text> : null}
            {item.companyName ? <Text style={styles.meta}>Company: {String(item.companyName)}</Text> : null}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No alerts yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  clearBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
  },
  clearText: { fontWeight: "800", opacity: 0.8 },
  list: { paddingVertical: 14, gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  cardTitle: { fontSize: 13, fontWeight: "800" },
  cardDesc: { marginTop: 6, fontSize: 12, opacity: 0.8 },
  meta: { marginTop: 6, fontSize: 11, opacity: 0.65 },
  emptyWrap: { paddingVertical: 30, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
