import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";

export default function EmployersScreen() {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.get<any[]>("/Api/Employers/List");
      setRows(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load employers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Employers</Text>
      <Text style={styles.subtitle}>Directory</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, idx) => String(item?.User_Id ?? idx)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{String(item?.Employer_Name ?? item?.User_Id ?? "")}</Text>
              <Text style={styles.cardDesc}>Contact: {String(item?.Employer_ContactPerson ?? "—")}</Text>
              <Text style={styles.cardDesc}>Phone: {String(item?.Employer_PIC_MobileNumber ?? item?.Employer_OfficeNumber ?? "—")}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No employers</Text>
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
  loadingWrap: { padding: 18 },
  list: { paddingVertical: 14, gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardDesc: { marginTop: 6, fontSize: 12, opacity: 0.75 },
  emptyWrap: { paddingVertical: 30, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
