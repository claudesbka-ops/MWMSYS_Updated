import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";

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

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Incident Detail</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : !row ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.subtitle}>No data</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{String(row?.Title ?? row?.Type ?? "Incident")}</Text>
          <Text style={styles.line}>Type: {String(row?.Type ?? "—")}</Text>
          <Text style={styles.line}>Worker: {String(row?.worker_ID ?? "—")}</Text>
          <Text style={styles.line}>Company: {String(row?.Company_Name ?? "—")}</Text>
          <Text style={styles.line}>Status: {String(row?.ProbStatus ?? "—")}</Text>
          <Text style={styles.desc}>{String(row?.Description ?? "")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
  },
  backText: { fontWeight: "800", opacity: 0.8 },
  title: { marginTop: 12, fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  loadingWrap: { padding: 18 },
  card: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  line: { marginTop: 8, fontSize: 12, opacity: 0.8 },
  desc: { marginTop: 12, fontSize: 13, opacity: 0.9 },
});
