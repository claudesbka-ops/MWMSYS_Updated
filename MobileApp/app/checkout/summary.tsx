import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Screen, Card, PrimaryButton } from "@/components/ui";

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
    <Screen title="Checkout" subtitle="Review your plan before payment" gradient={["#6366f1", "#8b5cf6", "#ec4899"]}>
      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>Selected plan</Text>
          <View style={styles.pill}><Text style={styles.pillText}>{plan || "—"}</Text></View>
        </View>
        <View style={[styles.row, { marginTop: 12 }]}>
          <Text style={styles.label}>Billing</Text>
          <Text style={styles.value}>Monthly (30 days)</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <FontAwesome name="lock" size={14} color="#6366f1" />
          <Text style={styles.hint}>
            You will be redirected to Stripe to complete payment. After successful payment, you will return to the app.
          </Text>
        </View>
        <PrimaryButton title={busy ? "Opening Stripe…" : "Proceed to payment"} loading={busy} onPress={startCheckout} style={{ marginTop: 18 }} />
      </Card>
      <Text style={styles.cancel} onPress={() => !busy && router.back()}>Cancel</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.4, textTransform: "uppercase" },
  value: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(99,102,241,0.12)" },
  pillText: { fontSize: 13, fontWeight: "900", color: "#4f46e5", letterSpacing: 0.3 },
  divider: { marginTop: 14, height: 1, backgroundColor: "rgba(15,23,42,0.08)" },
  infoRow: { marginTop: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  hint: { flex: 1, fontSize: 12, color: "rgba(15,23,42,0.65)", lineHeight: 17 },
  cancel: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
