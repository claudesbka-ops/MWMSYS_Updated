import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TextInput, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";

type SearchResponse = {
  workers: Array<{ Worker_Id: string; Name?: string | null; Passport_Number?: string | null; Created_On?: string | null }>;
  employers: Array<{ User_Id: string; Employer_Name: string; Employer_ContactPerson?: string | null; Employer_EmailID?: string | null; Created_On?: string | null }>;
};

export default function SearchScreen() {
  const api = useApiClient();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse>({ workers: [], employers: [] });

  const run = async () => {
    const query = q.trim();
    if (!query) {
      setData({ workers: [], employers: [] });
      return;
    }

    setLoading(true);
    try {
      const res = await api.get<SearchResponse>(`/api/search/global?q=${encodeURIComponent(query)}`);
      setData(res ?? { workers: [], employers: [] });
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      run().catch(() => undefined);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const rows = useMemo(() => {
    const w = (data.workers ?? []).map((x) => ({
      kind: "worker" as const,
      title: x.Worker_Id,
      sub: x.Passport_Number ? `Passport: ${x.Passport_Number}` : "",
    }));
    const e = (data.employers ?? []).map((x) => ({
      kind: "employer" as const,
      title: x.Employer_Name ?? x.User_Id,
      sub: x.Employer_ContactPerson ? `Contact: ${x.Employer_ContactPerson}` : "",
    }));
    return [...w, ...e];
  }, [data]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <Text style={styles.subtitle}>Global lookup (workers & employers)</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          style={styles.input}
          placeholder="Search by name, passport, company..."
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.btn} onPress={run}>
          <Text style={styles.btnText}>Go</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(_, idx) => String(idx)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.sub || item.kind}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{q.trim() ? "No results" : "Type to search"}</Text>
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
  searchRow: { marginTop: 14, flexDirection: "row", gap: 10, alignItems: "center" },
  input: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", paddingHorizontal: 12, color: "inherit" as any },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#2563eb" },
  btnText: { color: "white", fontWeight: "800" },
  loadingWrap: { padding: 18 },
  list: { paddingVertical: 14, gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  cardTitle: { fontSize: 14, fontWeight: "800" },
  cardDesc: { marginTop: 6, fontSize: 12, opacity: 0.75 },
  emptyWrap: { paddingVertical: 30, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
