import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect } from "@react-navigation/native";

import { useApiClient } from "@/services/apiClient";
import { Screen, Card, PrimaryButton, GhostButton, SectionTitle } from "@/components/ui";

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
    <Screen
      title="Attestation"
      subtitle="Review and verify document requests"
      gradient={["#f59e0b", "#ef4444", "#a855f7"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      <SectionTitle title={`Pending (${rows.length})`} />

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No attestation requests.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item, idx) => {
            const id = Number(item?.AttestationId ?? 0);
            const status = String(item?.Status ?? "Pending");
            return (
              <Card key={String(item?.AttestationId ?? idx)} tight>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{String(item?.Worker_Id ?? "Worker")}</Text>
                    <Text style={styles.cardSub}>Document: {String(item?.DocumentType ?? "—")}</Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>{status}</Text>
                  </View>
                </View>

                {item?.DocumentPath ? (
                  <GhostButton
                    title="Open document"
                    onPress={() => WebBrowser.openBrowserAsync(String(item.DocumentPath))}
                    style={{ marginTop: 12 }}
                  />
                ) : null}

                <View style={styles.actions}>
                  <PrimaryButton title="Approve" variant="success" onPress={() => approve(id)} style={{ flex: 1 }} testID="verify-doc-btn" />
                  <PrimaryButton title="Reject" variant="danger" onPress={() => reject(id)} style={{ flex: 1 }} testID="reject-doc-btn" />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  cardSub: { marginTop: 2, fontSize: 12, color: 'rgba(15,23,42,0.6)' },
  statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(245,158,11,0.15)' },
  statusText: { fontSize: 10, fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.3 },
  actions: { marginTop: 12, flexDirection: 'row', gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: 'rgba(15,23,42,0.55)', fontSize: 13 },
});
