import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { Screen, PrimaryButton } from "@/components/ui";

type PlanDef = {
  key: string;
  price: string;
  gradient: readonly [string, string, ...string[]];
  features: string[];
  tagline: string;
};

const PLANS: PlanDef[] = [
  {
    key: "Free",
    price: "$0",
    gradient: ["#64748b", "#334155"],
    tagline: "Basic access",
    features: ["View scoped workers", "Receive panic alerts", "No write actions"],
  },
  {
    key: "Pro",
    price: "$49/mo",
    gradient: ["#6366f1", "#8b5cf6", "#ec4899"],
    tagline: "Everything a growing team needs",
    features: ["All Free features", "Approve leave & attendance", "Create incidents", "Live map + alerts", "Priority support"],
  },
  {
    key: "Enterprise",
    price: "Contact us",
    gradient: ["#0f172a", "#6366f1"],
    tagline: "Custom SLAs and integrations",
    features: ["All Pro features", "Multi-branch scoping", "API access", "Dedicated onboarding", "Custom reports"],
  },
];

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
    <Screen
      title="Pricing"
      subtitle={`Your current plan: ${plan}`}
      gradient={["#a855f7", "#ec4899", "#f97316"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      {loading && plan === "Free" ? (
        <ActivityIndicator color="#6366f1" />
      ) : (
        <View style={{ gap: 14 }}>
          {PLANS.map((p) => {
            const active = p.key === plan;
            return (
              <View key={p.key} style={[styles.planCard, active && styles.planCardActive]}>
                <LinearGradient colors={p.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.planHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{p.key}</Text>
                    <Text style={styles.planTagline}>{p.tagline}</Text>
                  </View>
                  <View style={styles.priceWrap}>
                    <Text style={styles.priceText}>{p.price}</Text>
                  </View>
                </LinearGradient>
                <View style={styles.planBody}>
                  {p.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <FontAwesome name="check-circle" size={14} color="#10b981" />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                  {active ? (
                    <View style={styles.currentBadge}>
                      <FontAwesome name="star" size={12} color="#047857" />
                      <Text style={styles.currentText}>Current plan</Text>
                    </View>
                  ) : (
                    <PrimaryButton
                      title={p.key === 'Enterprise' ? 'Contact sales' : `Choose ${p.key}`}
                      onPress={() => choose(p.key)}
                      style={{ marginTop: 14 }}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  planCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.1)',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  planCardActive: {
    borderColor: 'rgba(99,102,241,0.55)',
    shadowOpacity: 0.18,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 10,
  },
  planName: { fontSize: 22, fontWeight: '900', color: 'white', letterSpacing: 0.3 },
  planTagline: { marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  priceWrap: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)' },
  priceText: { color: 'white', fontSize: 14, fontWeight: '800' },
  planBody: { padding: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  featureText: { fontSize: 13, color: 'rgba(15,23,42,0.78)', fontWeight: '600' },
  currentBadge: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  currentText: { fontSize: 12, fontWeight: '800', color: '#047857', letterSpacing: 0.3 },
});
