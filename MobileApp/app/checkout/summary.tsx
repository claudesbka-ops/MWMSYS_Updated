import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import Colors from "@/constants/Colors";

export default function CheckoutSummaryScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const params = useLocalSearchParams<{ plan?: string }>();

  const plan = useMemo(() => (params.plan ?? "").toString(), [params.plan]);
  const [busy, setBusy] = useState(false);

  const startCheckout = async () => {
    if (!plan || plan.toLowerCase() === "free") {
      Alert.alert("Error", "Invalid plan");
      return;
    }

    setBusy(true);
    try {
      const deepSuccess = Linking.createURL("/checkout/result", { queryParams: { status: "success" } });
      const deepCancel = Linking.createURL("/checkout/result", { queryParams: { status: "cancel" } });

      const apiBase = session.apiBaseUrl.replace(/\/+$/, "");
      const successUrl = `${apiBase}/stripe/return?redirect=${encodeURIComponent(deepSuccess)}`;
      const cancelUrl = `${apiBase}/stripe/return?redirect=${encodeURIComponent(deepCancel)}`;

      const res = await api.post<any>("/Api/subscription/checkout", {
        planType: plan,
        successUrl,
        cancelUrl,
      });
      const url = (res?.url ?? "").toString();
      if (!url) {
        Alert.alert("Error", "No checkout URL received");
        return;
      }

      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to start checkout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={busy}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Checkout Summary</Text>
      <Text style={styles.subtitle}>Review your plan before payment</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Selected plan</Text>
        <Text style={styles.value}>{plan || "—"}</Text>

        <Text style={[styles.label, { marginTop: 12 }]}>Billing</Text>
        <Text style={styles.value}>Monthly (30 days)</Text>

        <Text style={[styles.hint, { marginTop: 12 }]}>
          You will be redirected to Stripe to complete payment. After successful payment, you will return to the app.
        </Text>

        <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={startCheckout} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Proceed to Payment</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  backText: { fontWeight: "800", opacity: 0.8 },
  title: { marginTop: 6, fontSize: 22, fontWeight: "800" },
  subtitle: { marginTop: 6, fontSize: 13, opacity: 0.7 },
  card: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border },
  label: { fontSize: 12, opacity: 0.7, fontWeight: "700" },
  value: { marginTop: 6, fontSize: 16, fontWeight: "900" },
  hint: { fontSize: 12, opacity: 0.7, lineHeight: 16 },
  primaryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: Colors.light.tint,
  },
  primaryText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.6 },
});
