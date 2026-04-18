import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";

const PLANS = ["Free", "Pro", "Enterprise"];

export default function PricingScreen() {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<string>("Free");

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/Api/subscription/me");
      setPlan((res?.planType ?? "Free").toString());
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  };

  const choose = async (p: string) => {
    setLoading(true);
    try {
      await api.post("/Api/subscription/purchase", { planType: p });
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to purchase");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pricing</Text>
      <Text style={styles.subtitle}>Current plan: {plan}</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={PLANS}
          keyExtractor={(p) => p}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isCurrent = item === plan;
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item}</Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, isCurrent && styles.disabled]}
                  disabled={isCurrent}
                  onPress={() => choose(item)}
                >
                  <Text style={styles.primaryBtnText}>{isCurrent ? "Current" : "Choose"}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
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
  primaryBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: "#2563eb", alignItems: "center" },
  primaryBtnText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },
});
