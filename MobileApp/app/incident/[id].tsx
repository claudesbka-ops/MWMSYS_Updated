import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useApiClient } from "@/services/apiClient";
import { Screen, Card } from "@/components/ui";

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApiClient();

  const [loading, setLoading] = useState(false);
  const [row, setRow] = useState<any>(null);

  const load = async () => {
    const n = Number(id ?? 0);
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert("Invalid", "Invalid incident id");
      return;
    }

    setLoading(true);
    try {
      const res = await api.get<any>(`/Api/Incidents/${n}`);
      setRow(res);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load incident");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [id]);

  const status = String(row?.ProbStatus ?? "").toLowerCase();
  const type = String(row?.Type ?? "").toLowerCase();
  const gradient = (type === "panic" ? ["#ef4444", "#f59e0b", "#ec4899"] : ["#6366f1", "#8b5cf6", "#ec4899"]) as [string, string, ...string[]];

  return (
    <Screen title="Incident" subtitle={row ? String(row?.Title ?? row?.Type ?? `Incident #${id}`) : `Incident #${id}`} gradient={gradient} refreshing={loading} onRefresh={load}>
      {loading && !row ? (
        <ActivityIndicator color="#6366f1" />
      ) : !row ? (
        <Card>
          <Text style={styles.muted}>No data for this incident.</Text>
        </Card>
      ) : (
        <Card>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{String(row?.Title ?? row?.Type ?? "Incident")}</Text>
            {row?.ProbStatus ? (
              <View style={[styles.statusPill, status === "approved" ? styles.statusApproved : status === "rejected" ? styles.statusRejected : styles.statusPending]}>
                <Text style={styles.statusText}>{String(row.ProbStatus)}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}><Text style={styles.label}>Type</Text><Text style={styles.value}>{String(row?.Type ?? "—")}</Text></View>
          <View style={styles.metaRow}><Text style={styles.label}>Worker</Text><Text style={styles.value}>{String(row?.worker_ID ?? "—")}</Text></View>
          <View style={styles.metaRow}><Text style={styles.label}>Company</Text><Text style={styles.value}>{String(row?.Company_Name ?? "—")}</Text></View>
          {row?.Description ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.descLabel}>Description</Text>
              <Text style={styles.desc}>{String(row.Description)}</Text>
            </>
          ) : null}
        </Card>
      )}
      <Text style={styles.back} onPress={() => router.back()}>Back</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: "rgba(15,23,42,0.55)", fontSize: 13 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: "900", color: "#0f172a" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPending: { backgroundColor: "rgba(245,158,11,0.14)" },
  statusApproved: { backgroundColor: "rgba(16,185,129,0.14)" },
  statusRejected: { backgroundColor: "rgba(239,68,68,0.14)" },
  statusText: { fontSize: 10, fontWeight: "900", color: "#0f172a", letterSpacing: 0.3, textTransform: "uppercase" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  label: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.4, textTransform: "uppercase" },
  value: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  divider: { marginTop: 14, height: 1, backgroundColor: "rgba(15,23,42,0.08)" },
  descLabel: { marginTop: 14, fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.4, textTransform: "uppercase" },
  desc: { marginTop: 8, fontSize: 13, color: "rgba(15,23,42,0.8)", lineHeight: 19 },
  back: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
