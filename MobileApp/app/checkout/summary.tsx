import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Screen, Card, PrimaryButton, GhostButton } from "@/components/ui";

type Cycle = "monthly" | "yearly";

const PLAN_INFO: Record<string, { emoji: string; name: string; tagline: string; monthly: number; yearly: number; gradient: readonly [string, string, ...string[]]; contact?: boolean }> = {
  pro: {
    emoji: "🚀",
    name: "Pro",
    tagline: "Full HR + safety for growing teams",
    monthly: 29,
    yearly: 23,
    gradient: ["#6366f1", "#8b5cf6", "#ec4899"],
  },
  enterprise: {
    emoji: "🏛️",
    name: "Enterprise",
    tagline: "Custom limits, SSO and account manager",
    monthly: 0,
    yearly: 0,
    gradient: ["#f59e0b", "#ef4444"],
    contact: true,
  },
};

export default function CheckoutSummaryScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const params = useLocalSearchParams<{ plan?: string; cycle?: string }>();

  const plan = useMemo(() => (params.plan ?? "").toString(), [params.plan]);
  const cycle = useMemo<Cycle>(() => ((params.cycle ?? "yearly").toString().toLowerCase() === "monthly" ? "monthly" : "yearly"), [params.cycle]);
  const info = PLAN_INFO[plan.toLowerCase()];
  const monthly = info ? (cycle === "yearly" ? info.yearly : info.monthly) : 0;
  const totalToday = info && !info.contact ? (cycle === "yearly" ? monthly * 12 : monthly) : 0;
  const [busy, setBusy] = useState(false);

  const startCheckout = async () => {
    if (!plan || plan.toLowerCase() === "free") {
      Alert.alert("⚠️ Error", "Invalid plan");
      return;
    }

    if (info?.contact) {
      contactSales();
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
        cycle,
        successUrl,
        cancelUrl,
      });
      const url = (res?.url ?? "").toString();
      if (!url) {
        Alert.alert("⚠️ Error", "No checkout URL received");
        return;
      }

      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Unable to start checkout");
    } finally {
      setBusy(false);
    }
  };

  const contactSales = () => {
    Linking.openURL("mailto:sales@mwmsys.com?subject=Enterprise%20plan%20inquiry").catch(() =>
      Alert.alert("✉️ Contact us", "Email sales@mwmsys.com to discuss Enterprise pricing.")
    );
  };

  return (
    <Screen title="🛍️ Checkout" subtitle="Review your plan before payment" gradient={["#6366f1", "#8b5cf6", "#ec4899"]}>
      {info ? (
        <View style={styles.heroCard}>
          <LinearGradient colors={info.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroRow}>
            <Text style={styles.heroEmoji}>{info.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>SELECTED PLAN</Text>
              <Text style={styles.heroName}>{info.name}</Text>
              <Text style={styles.heroTag}>{info.tagline}</Text>
            </View>
          </View>
        </View>
      ) : (
        <Card>
          <Text style={styles.errorTitle}>⚠️ Unknown plan</Text>
          <Text style={styles.errorText}>We couldn't load details for “{plan || "—"}”. Go back and pick a plan.</Text>
          <GhostButton title="🔙 Back to pricing" onPress={() => router.replace("/(tabs)/pricing" as any)} style={{ marginTop: 12 }} />
        </Card>
      )}

      {info && !info.contact ? (
        <Card style={{ marginTop: 14 } as any}>
          <View style={styles.row}>
            <Text style={styles.label}>Billing cycle</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{cycle === "yearly" ? "🎁 Yearly (save 20%)" : "🗓️ Monthly"}</Text>
            </View>
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <Text style={styles.label}>Price</Text>
            <Text style={styles.value}>${monthly}/mo</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.row, { marginTop: 14 }]}>
            <Text style={styles.totalLabel}>💳 Total today</Text>
            <Text style={styles.totalValue}>${totalToday}</Text>
          </View>
          <Text style={styles.totalHint}>
            {cycle === "yearly" ? "Billed once for 12 months" : "Billed every 30 days"}
          </Text>
          <View style={styles.infoRow}>
            <FontAwesome name="lock" size={14} color="#6366f1" />
            <Text style={styles.hint}>
              🔒 You'll be redirected to Stripe. After paying, you'll return to the app and your plan will activate.
            </Text>
          </View>
          <PrimaryButton title={busy ? "⏳ Opening Stripe…" : `💨 Pay $${totalToday} · Proceed`} loading={busy} onPress={startCheckout} style={{ marginTop: 18 }} />
        </Card>
      ) : info?.contact ? (
        <Card style={{ marginTop: 14 } as any}>
          <Text style={styles.label}>Custom pricing</Text>
          <Text style={styles.contactText}>
            Enterprise plans include unlimited workers, SSO, dedicated success manager and a 99.9% SLA. Pricing is tailored to your team.
          </Text>
          <PrimaryButton title="📧 Email sales@mwmsys.com" onPress={contactSales} style={{ marginTop: 14 }} />
        </Card>
      ) : null}

      <Text style={styles.cancel} onPress={() => !busy && router.back()}>Cancel</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 22,
    overflow: "hidden",
    paddingVertical: 18,
    paddingHorizontal: 18,
    shadowColor: "#6366f1",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.12)" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroEmoji: { fontSize: 38 },
  heroLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, color: "rgba(255,255,255,0.85)" },
  heroName: { marginTop: 2, fontSize: 24, fontWeight: "900", color: "#fff" },
  heroTag: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.92)" },
  errorTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  errorText: { marginTop: 6, fontSize: 13, color: "rgba(15,23,42,0.65)", lineHeight: 18 },
  contactText: { marginTop: 8, fontSize: 13, color: "rgba(15,23,42,0.7)", lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.4, textTransform: "uppercase" },
  value: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(99,102,241,0.12)" },
  pillText: { fontSize: 13, fontWeight: "900", color: "#4f46e5", letterSpacing: 0.3 },
  divider: { marginTop: 14, height: 1, backgroundColor: "rgba(15,23,42,0.08)" },
  totalLabel: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  totalValue: { fontSize: 22, fontWeight: "900", color: "#0f172a" },
  totalHint: { marginTop: 4, fontSize: 11, fontWeight: "700", color: "rgba(15,23,42,0.5)" },
  infoRow: { marginTop: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  hint: { flex: 1, fontSize: 12, color: "rgba(15,23,42,0.65)", lineHeight: 17 },
  cancel: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
