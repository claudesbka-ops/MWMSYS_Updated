import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, StyleSheet, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";

const PLANS = ["Free", "Pro", "Enterprise"];

export default function PricingScreen() {
  const router = useRouter();
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
    if (p === "Free") {
      Alert.alert("Info", "Free plan does not require checkout");
      return;
    }

    router.push(`/checkout/summary?plan=${encodeURIComponent(p)}` as any);
  };

  const legacyOpenCheckout = async (p: string) => {
    setLoading(true);
    try {
      const res = await api.post<any>("/Api/subscription/checkout", { planType: p });
      const url = (res?.url ?? "").toString();
      if (!url) {
        Alert.alert("Error", "No checkout URL received");
        return;
      }

      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert("Error", "Cannot open checkout URL");
        return;
      }

      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to purchase");
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
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.planCard} onPress={() => choose(item)}>
              <Text style={styles.planName}>{item}</Text>
              <Text style={styles.planDesc}>{item === plan ? "Active plan" : "Tap to buy"}</Text>
            </TouchableOpacity>
          )}
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
  planCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  planName: { fontSize: 16, fontWeight: "800" },
  planDesc: { marginTop: 4, fontSize: 12, opacity: 0.7 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  primaryBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: "#2563eb", alignItems: "center" },
  primaryBtnText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },
});
