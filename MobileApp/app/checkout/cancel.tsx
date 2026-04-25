import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { Screen, PrimaryButton, GhostButton } from "@/components/ui";

export default function CheckoutCancelScreen() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/(tabs)/pricing" as any);
    }, 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <Screen title="Payment cancelled" subtitle="No charges were made" gradient={["#64748b", "#0f172a", "#6366f1"]}>
      <View style={styles.center}>
        <LinearGradient colors={["#64748b", "#0f172a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <FontAwesome name="times" size={48} color="#ffffff" />
        </LinearGradient>
        <Text style={styles.h1}>Checkout cancelled</Text>
        <Text style={styles.sub}>You can try again anytime. No charges were made to your card.</Text>
        <PrimaryButton title="Back to pricing" style={{ marginTop: 18, alignSelf: "stretch" }} onPress={() => router.replace("/(tabs)/pricing" as any)} />
        <GhostButton title="Go to dashboard" style={{ marginTop: 10, alignSelf: "stretch" }} onPress={() => router.replace("/(tabs)" as any)} />
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
