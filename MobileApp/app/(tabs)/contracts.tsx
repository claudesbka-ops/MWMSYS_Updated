import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { useApiClient } from "@/services/apiClient";
import { Screen, PrimaryButton, SectionTitle, ListItemCard } from "@/components/ui";

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
    <Screen
      title="Contracts"
      subtitle="Contracts expiring soon"
      gradient={["#0ea5e9", "#6366f1", "#a855f7"]}
      refreshing={loading}
      onRefresh={load}
    >
      <View style={styles.row}>
        <View style={styles.inputWrap}>
          <Text style={styles.hint}>Expiring within</Text>
          <TextInput value={days} onChangeText={setDays} style={styles.input} keyboardType="numeric" />
          <Text style={styles.hint}>days</Text>
        </View>
        <PrimaryButton title="Load" onPress={load} />
      </View>

      <SectionTitle title={`Results (${rows.length})`} />

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No expiring contracts in this window.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item, idx) => (
            <ListItemCard
              key={String(item?.Worker_Id ?? idx)}
              title={String(item?.Worker_Id ?? "Contract")}
              subtitle={`Employer: ${String(item?.Employer_Name ?? "—")}`}
              meta={`Expires: ${item?.Contract_Expiry_Date ? String(item.Contract_Expiry_Date).slice(0, 10) : "—"}`}
              icon="file-text"
              iconGradient={['#f59e0b', '#fb7185']}
              badge={{ label: 'Expiring', tone: 'amber' }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  inputWrap: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 46, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: 'rgba(79,70,229,0.15)',
  },
  hint: { fontSize: 12, color: 'rgba(15,23,42,0.55)', fontWeight: '600' },
  input: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: 'rgba(15,23,42,0.55)', fontSize: 13 },
});
