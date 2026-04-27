import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useOnboarding } from "@/contexts/OnboardingContext";
import { Screen } from "@/components/ui";

type Role = "employer" | "agency" | "worker";

type RoleDef = {
  key: Role;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  gradient: readonly [string, string, ...string[]];
};

const ROLES: RoleDef[] = [
  { key: "employer", title: "🏢 Employer", description: "Hire and manage your migrant workforce", icon: "building", gradient: ["#6366f1", "#8b5cf6"] },
  { key: "agency",   title: "💼 Agency",   description: "Place workers with employers you work with", icon: "briefcase", gradient: ["#f59e0b", "#ef4444"] },
  { key: "worker",   title: "👷 Worker",   description: "Create your worker account", icon: "user", gradient: ["#10b981", "#06b6d4"] },
];

export default function OnboardingStartScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();

  const choose = (role: Role) => {
    onboarding.start(role);
    router.push((`/onboarding/${role}`) as any);
  };

  return (
    <Screen title="Create account" subtitle="Choose your role to begin onboarding" gradient={["#6366f1", "#8b5cf6", "#ec4899"]}>
      <View style={{ gap: 12 }}>
        {ROLES.map((r) => (
          <TouchableOpacity key={r.key} activeOpacity={0.88} onPress={() => choose(r.key)} style={styles.card}>
            <LinearGradient colors={r.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBadge}>
              <FontAwesome name={r.icon} size={18} color="white" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{r.title}</Text>
              <Text style={styles.cardDesc}>{r.description}</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="rgba(15,23,42,0.3)" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.back} onPress={() => router.replace("/login" as any)}>
        <Text style={styles.backText}>Back to sign in</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.1)",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  iconBadge: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  cardDesc: { marginTop: 4, fontSize: 12, color: "rgba(15,23,42,0.6)", fontWeight: "600" },
  back: { marginTop: 18, alignItems: "center", paddingVertical: 12 },
  backText: { fontWeight: "800", color: "rgba(15,23,42,0.55)", fontSize: 13 },
});
