import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { useApiClient } from "@/services/apiClient";
import { Screen, ListItemCard, SectionTitle } from "@/components/ui";

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
    <Screen
      title="Employers"
      subtitle="Companies registered in MWMSYS"
      gradient={["#0ea5e9", "#6366f1", "#a855f7"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      <SectionTitle title={`Directory (${rows.length})`} />
      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 16 }} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No employers yet.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item, idx) => (
            <ListItemCard
              key={String(item?.User_Id ?? idx)}
              title={String(item?.Employer_Name ?? item?.User_Id ?? "Employer")}
              subtitle={`Contact: ${String(item?.Employer_ContactPerson ?? "—")}`}
              meta={`Phone: ${String(item?.Employer_PIC_MobileNumber ?? item?.Employer_OfficeNumber ?? "—")}`}
              icon="building"
              iconGradient={["#0ea5e9", "#6366f1"]}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13 },
});
