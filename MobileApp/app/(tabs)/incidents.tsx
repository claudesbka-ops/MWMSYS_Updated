import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { usePlanGate } from "@/hooks/usePlanGate";

export default function IncidentsScreen() {
  const router = useRouter();
  const session = useSession();
  const api = useApiClient();
  const gate = usePlanGate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const appRole = (session.claims?.appRole ?? "").toString();
  const canCreate = appRole === "admin" || appRole === "agency" || appRole === "employer" || appRole === "embassy_source" || appRole === "embassy_destination" || appRole === "labour";
  const isEmployerOrAgency = appRole === "employer" || appRole === "agency";
  const canCreateNow = canCreate && (!isEmployerOrAgency || gate.hasPlan);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.get<any[]>("/Api/Incidents");
      setRows(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      refresh().catch(() => undefined);
      return () => undefined;
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incidents</Text>
      <Text style={styles.subtitle}>Scoped history</Text>

      {!gate.hasPlan && isEmployerOrAgency ? (
        <View style={styles.paywall}>
          <Text style={styles.paywallText}>Subscription required to create incidents/complaints.</Text>
          <TouchableOpacity style={styles.paywallBtn} onPress={() => router.push("/(tabs)/pricing" as any)}>
            <Text style={styles.paywallBtnText}>Go to Pricing</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canCreate ? (
        <TouchableOpacity
          style={[styles.createBtn, !canCreateNow && styles.disabled]}
          onPress={() => {
            if (!canCreateNow) {
              Alert.alert("Subscription required", "Please purchase a plan to create incidents/complaints.");
              return;
            }
            router.push("/(tabs)/new-incident" as any);
          }}
          disabled={!canCreateNow}
        >
          <Text style={styles.createText}>Create Incident</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, idx) => String(item?.ID ?? idx)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                const id = Number(item?.ID ?? 0);
                if (Number.isFinite(id) && id > 0) router.push(`/incident/${id}` as any);
              }}
            >
              <Text style={styles.cardTitle}>{String(item?.Title ?? item?.Type ?? "Incident")}</Text>
              <Text style={styles.cardDesc}>Worker: {String(item?.worker_ID ?? "—")}</Text>
              <Text style={styles.cardDesc}>Company: {String(item?.Company_Name ?? "—")}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No incidents</Text>
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
  subtitle: { marginTop: 6, fontSize: 12, opacity: 0.7 },
  paywall: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
  },
  paywallText: { fontSize: 12, opacity: 0.85, fontWeight: "800" },
  paywallBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: "#111" },
  paywallBtnText: { color: "#fff", fontWeight: "900" },
  createBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  createText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },
  loadingWrap: { padding: 18 },
  list: { paddingVertical: 14, gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  cardTitle: { fontSize: 14, fontWeight: "800" },
  cardDesc: { marginTop: 4, fontSize: 12, opacity: 0.7 },
  emptyWrap: { padding: 18, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
