import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect } from "@react-navigation/native";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";

export default function AttestationScreen() {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.get<any[]>("/Api/Attestation/List");
      setRows(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load attestation");
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: number) => {
    try {
      await api.post("/Api/Attestation/Approve", { id, remarks: "Approved" });
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Approve failed");
    }
  };

  const reject = async (id: number) => {
    try {
      await api.post("/Api/Attestation/Reject", { id, remarks: "Rejected" });
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Reject failed");
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
      <Text style={styles.title}>Attestation</Text>
      <Text style={styles.subtitle}>Approve/reject requests</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, idx) => String(item?.AttestationId ?? idx)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{String(item?.Worker_Id ?? "")}</Text>
              <Text style={styles.cardDesc}>Doc: {String(item?.DocumentType ?? "—")}</Text>
              <Text style={styles.cardDesc}>Status: {String(item?.Status ?? "")}</Text>
              {item?.DocumentPath ? (
                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => WebBrowser.openBrowserAsync(String(item.DocumentPath))}
                >
                  <Text style={styles.linkText}>Open Document</Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.okBtn} onPress={() => approve(Number(item?.AttestationId ?? 0))}>
                  <Text style={styles.okText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.noBtn} onPress={() => reject(Number(item?.AttestationId ?? 0))}>
                  <Text style={styles.noText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No attestation requests</Text>
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
  actionsRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  linkBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(37,99,235,0.35)", backgroundColor: "rgba(37,99,235,0.12)" },
  linkText: { fontWeight: "800" },
  okBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: "rgba(16,185,129,0.25)" },
  noBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(220,38,38,0.12)", borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" },
  okText: { fontWeight: "800" },
  noText: { fontWeight: "800" },
  emptyWrap: { paddingVertical: 30, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
