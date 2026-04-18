import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";

export default function WorkersScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const appRole = (session.claims?.appRole ?? "").toString();
  const canCreate = appRole === "admin" || appRole === "agency" || appRole === "employer";

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.get<any[]>("/Api/Workers/List");
      setRows(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load workers");
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
      <Text style={styles.title}>Workers</Text>
      <Text style={styles.subtitle}>Scoped worker list</Text>

      {canCreate ? (
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/(tabs)/new-worker' as any)}>
          <Text style={styles.createText}>Create Worker</Text>
        </TouchableOpacity>
      ) : null}

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
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                const wid = String(item?.Worker_Id ?? "").trim();
                if (wid) router.push(`/worker/${encodeURIComponent(wid)}` as any);
              }}
            >
              <Text style={styles.cardTitle}>{String(item?.Worker_Id ?? "")}</Text>
              <Text style={styles.cardDesc}>Passport: {String(item?.Passport_Number ?? "—")}</Text>
              <Text style={styles.cardDesc}>Company: {String(item?.Company_Name ?? "—")}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No workers</Text>
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
  createBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  createText: { color: 'white', fontWeight: '800' },
  loadingWrap: { padding: 18 },
  list: { paddingVertical: 14, gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardDesc: { marginTop: 6, fontSize: 12, opacity: 0.75 },
  emptyWrap: { paddingVertical: 30, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
