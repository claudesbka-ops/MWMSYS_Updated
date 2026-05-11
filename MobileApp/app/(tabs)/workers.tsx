import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Screen, ListItemCard, PrimaryButton, SectionTitle } from "@/components/ui";

export default function WorkersScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState("");

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

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) =>
        [r?.Worker_Id, r?.Passport_Number, r?.Company_Name, r?.Name]
          .map((x) => String(x ?? "").toLowerCase())
          .some((x) => x.includes(q))
      )
    : rows;

  return (
    <Screen
      title="Workers"
      subtitle={`${rows.length} in your scope`}
      gradient={["#6366f1", "#8b5cf6", "#ec4899"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      {canCreate ? (
        <PrimaryButton title="+ Add new worker" onPress={() => router.push('/(tabs)/new-worker' as any)} testID="link-worker-btn" />
      ) : null}

      <View style={styles.searchWrap}>
        <FontAwesome name="search" size={13} color="rgba(15,23,42,0.4)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by ID, passport, company…"
          placeholderTextColor="rgba(15,23,42,0.35)"
          style={styles.searchInput}
          autoCapitalize="none"
        />
      </View>

      <SectionTitle title={`Results (${filtered.length})`} />

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 16 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No workers match your filter.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((item, idx) => {
            const wid = String(item?.Worker_Id ?? "").trim();
            return (
              <ListItemCard
                key={wid || idx}
                title={String(item?.Name ?? item?.Worker_Id ?? "Worker")}
                subtitle={`Passport: ${String(item?.Passport_Number ?? "—")}`}
                meta={`Company: ${String(item?.Company_Name ?? item?.Employer_Name ?? "—")}`}
                icon="user"
                iconGradient={["#6366f1", "#8b5cf6"]}
                onPress={() => {
                  if (wid) router.push(`/worker/${encodeURIComponent(wid)}` as any);
                }}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.12)",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#0f172a" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13 },
});
