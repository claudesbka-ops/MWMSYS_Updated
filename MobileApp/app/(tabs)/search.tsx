import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { Screen, ListItemCard, SectionTitle } from "@/components/ui";

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
    <Screen title="Search" subtitle="Global lookup across workers and employers" gradient={["#6366f1", "#06b6d4", "#10b981"]}>
      <View style={styles.searchWrap}>
        <FontAwesome name="search" size={14} color="rgba(15,23,42,0.5)" />
        <TextInput
          value={q}
          onChangeText={setQ}
          style={styles.input}
          placeholder="Search by name, passport, company…"
          placeholderTextColor="rgba(15,23,42,0.4)"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={run}
        />
      </View>

      <SectionTitle title={q.trim() ? `Results (${rows.length})` : "Recent"} />

      {loading ? (
        <ActivityIndicator color="#6366f1" />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="search" size={28} color="rgba(15,23,42,0.2)" />
          <Text style={styles.emptyText}>{q.trim() ? "No results found." : "Start typing to search."}</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item, idx) => (
            <ListItemCard
              key={`${item.kind}:${idx}`}
              title={item.title}
              subtitle={item.sub || undefined}
              meta={item.kind === 'worker' ? 'Worker' : 'Employer'}
              icon={item.kind === 'worker' ? 'user' : 'building'}
              iconGradient={item.kind === 'worker' ? ['#6366f1', '#8b5cf6'] : ['#f59e0b', '#ef4444']}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 50, paddingHorizontal: 16, borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: 'rgba(79,70,229,0.15)',
    shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 1,
  },
  input: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { color: 'rgba(15,23,42,0.55)', fontSize: 13 },
});
