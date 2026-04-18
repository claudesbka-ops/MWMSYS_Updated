import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TextInput, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";

export default function ContractsScreen() {
  const api = useApiClient();
  const [days, setDays] = useState("90");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/Api/HRMS/Contracts/Expiring?days=${encodeURIComponent(days)}`);
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contracts</Text>
      <Text style={styles.subtitle}>Expiring window</Text>

      <View style={styles.row}>
        <TextInput value={days} onChangeText={setDays} style={styles.input} keyboardType="numeric" />
        <TouchableOpacity style={styles.btn} onPress={load}>
          <Text style={styles.btnText}>Load</Text>
        </TouchableOpacity>
      </View>

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
              <Text style={styles.cardDesc}>Employer: {String(item?.Employer_Name ?? "—")}</Text>
              <Text style={styles.cardDesc}>Issue: {item?.Contract_issue_Date ? String(item.Contract_issue_Date).slice(0, 10) : "—"}</Text>
              <Text style={styles.cardDesc}>Expiry: {item?.Contract_Expiry_Date ? String(item.Contract_Expiry_Date).slice(0, 10) : "—"}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No expiring contracts</Text>
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
  row: { marginTop: 14, flexDirection: "row", gap: 10, alignItems: "center" },
  input: { width: 90, height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", paddingHorizontal: 12, color: "inherit" as any },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#2563eb" },
  btnText: { color: "white", fontWeight: "800" },
  loadingWrap: { padding: 18 },
  list: { paddingVertical: 14, gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  cardTitle: { fontSize: 13, fontWeight: "800" },
  cardDesc: { marginTop: 6, fontSize: 12, opacity: 0.75 },
  emptyWrap: { paddingVertical: 30, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
