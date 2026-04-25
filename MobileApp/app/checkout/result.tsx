import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useSubscriptionService } from "@/services/subscriptionService";
import { Screen, PrimaryButton, GhostButton } from "@/components/ui";

export default function CheckoutResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const sub = useSubscriptionService();

  const status = useMemo(() => (params.status ?? "").toString().toLowerCase(), [params.status]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      await sub.me();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to refresh subscription");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const success = status === "success";
  const gradient = (success ? ["#10b981", "#06b6d4", "#6366f1"] : ["#64748b", "#0f172a", "#6366f1"]) as [string, string, ...string[]];
  const iconGradient = (success ? ["#10b981", "#06b6d4"] : ["#64748b", "#0f172a"]) as [string, string];

  return (
    <Screen title={success ? "Payment complete" : "Payment cancelled"} subtitle={success ? "We're activating your plan" : "No charges were made"} gradient={gradient}>
      <View style={styles.center}>
        <LinearGradient colors={iconGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <FontAwesome name={success ? "check" : "times"} size={48} color="#ffffff" />
        </LinearGradient>
        <Text style={styles.h1}>{success ? "Thank you!" : "Checkout cancelled"}</Text>
        <Text style={styles.sub}>
          {success
            ? "Your plan will unlock shortly. Tap Refresh if it does not activate within a minute."
            : "You can try again anytime. No charges were made to your card."}
        </Text>
        <PrimaryButton
          title={busy ? "Refreshing…" : success ? "Refresh subscription" : "Back to pricing"}
          loading={busy}
          variant={success ? "success" : "primary"}
          style={{ marginTop: 18, alignSelf: "stretch" }}
          onPress={success ? refresh : () => router.replace("/(tabs)/pricing" as any)}
        />
        {success ? (
          <GhostButton title="Back to pricing" style={{ marginTop: 10, alignSelf: "stretch" }} onPress={() => router.replace("/(tabs)/pricing" as any)} />
        ) : (
          <GhostButton title="Go to dashboard" style={{ marginTop: 10, alignSelf: "stretch" }} onPress={() => router.replace("/(tabs)" as any)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", paddingVertical: 30 },
  badge: {
    width: 110, height: 110, borderRadius: 55, alignItems: "center", justifyContent: "center",
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.25, shadowRadius: 22, elevation: 8,
  },
  h1: { marginTop: 22, fontSize: 24, fontWeight: "900", color: "#0f172a" },
  sub: { marginTop: 8, fontSize: 13, color: "rgba(15,23,42,0.65)", textAlign: "center", paddingHorizontal: 20, lineHeight: 18 },
});
