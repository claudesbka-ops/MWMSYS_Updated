import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TextInput, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";

export default function ReportsScreen() {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<"entry" | "visa" | "insurance">("entry");
  const [days, setDays] = useState("90");
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      if (report === "entry") {
        const res = await api.get<any[]>("/api/reports/entry");
        setRows(Array.isArray(res) ? res : []);
      } else if (report === "visa") {
        const res = await api.get<any>(`/api/reports/visa-expire?days=${encodeURIComponent(days)}`);
        setRows(Array.isArray(res?.rows) ? res.rows : []);
      } else {
        const res = await api.get<any>(`/api/reports/insurance-expire?days=${encodeURIComponent(days)}`);
        setRows(Array.isArray(res?.rows) ? res.rows : []);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [report]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reports</Text>
      <Text style={styles.subtitle}>Entry / Visa / Insurance</Text>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.pill, report === "entry" && styles.pillActive]} onPress={() => setReport("entry")}>
          <Text style={styles.pillText}>Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pill, report === "visa" && styles.pillActive]} onPress={() => setReport("visa")}>
          <Text style={styles.pillText}>Visa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pill, report === "insurance" && styles.pillActive]} onPress={() => setReport("insurance")}>
          <Text style={styles.pillText}>Insurance</Text>
        </TouchableOpacity>
      </View>

      {report !== "entry" && (
        <View style={styles.row}>
          <TextInput value={days} onChangeText={setDays} style={styles.input} keyboardType="numeric" />
          <TouchableOpacity style={styles.loadBtn} onPress={load}>
            <Text style={styles.loadText}>Load</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, idx) => String(item?.Worker_Id ?? idx)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{String(item?.Worker_Id ?? "")}</Text>
              <Text style={styles.cardDesc}>Passport: {String(item?.Passport_Number ?? "—")}</Text>
              <Text style={styles.cardDesc}>Company: {String(item?.Company_Name ?? "—")}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No rows</Text>
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
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  row: { marginTop: 12, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  pill: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  pillActive: { backgroundColor: "rgba(37,99,235,0.15)", borderColor: "rgba(37,99,235,0.35)" },
  pillText: { fontWeight: "800", opacity: 0.8 },
  input: { width: 90, height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", paddingHorizontal: 12, color: "inherit" as any },
  loadBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#2563eb" },
  loadText: { color: "white", fontWeight: "800" },
  loadingWrap: { padding: 18 },
  list: { paddingVertical: 14, gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardDesc: { marginTop: 6, fontSize: 12, opacity: 0.75 },
  emptyWrap: { paddingVertical: 30, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
