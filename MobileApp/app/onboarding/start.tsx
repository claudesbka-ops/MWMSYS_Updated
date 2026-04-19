import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useOnboarding } from "@/contexts/OnboardingContext";

export default function OnboardingStartScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Choose your role to begin onboarding</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          onboarding.start("employer");
          router.push("/onboarding/account" as any);
        }}
      >
        <Text style={styles.cardTitle}>Employer</Text>
        <Text style={styles.cardDesc}>Manage your workers and HRMS features</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          onboarding.start("agency");
          router.push("/onboarding/account" as any);
        }}
      >
        <Text style={styles.cardTitle}>Agency</Text>
        <Text style={styles.cardDesc}>Manage workers you sent and employers you work with</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          onboarding.start("worker");
          router.push("/onboarding/account" as any);
        }}
      >
        <Text style={styles.cardTitle}>Worker</Text>
        <Text style={styles.cardDesc}>Create your worker account</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.ghostBtn} onPress={() => router.replace("/login" as any)}>
        <Text style={styles.ghostText}>Back to login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "900", textAlign: "center" },
  subtitle: { marginTop: 8, fontSize: 13, opacity: 0.7, textAlign: "center" },
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
  },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  cardDesc: { marginTop: 6, fontSize: 12, opacity: 0.7 },
  ghostBtn: { marginTop: 16, alignItems: "center", paddingVertical: 12 },
  ghostText: { fontWeight: "800", opacity: 0.8 },
});
