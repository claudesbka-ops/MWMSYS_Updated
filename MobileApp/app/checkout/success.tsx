import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";

export default function CheckoutSuccessScreen() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/(tabs)/pricing" as any);
    }, 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Successful</Text>
      <Text style={styles.subtitle}>Your subscription will be activated shortly.</Text>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/(tabs)/pricing" as any)}>
        <Text style={styles.primaryText}>Go to Pricing</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.ghostBtn} onPress={() => router.replace("/(tabs)" as any)}>
        <Text style={styles.ghostText}>Go to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: { marginTop: 8, opacity: 0.7, textAlign: "center" },
  primaryBtn: {
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#111",
  },
  primaryText: { color: "#fff", fontWeight: "900" },
  ghostBtn: { marginTop: 10, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  ghostText: { fontWeight: "800", opacity: 0.8 },
});
