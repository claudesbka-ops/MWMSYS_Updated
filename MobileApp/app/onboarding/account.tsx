import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useOnboarding } from "@/contexts/OnboardingContext";

export default function OnboardingAccountScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const draft = onboarding.draft;

  const roleLabel = useMemo(() => {
    if (draft?.role === "agency") return "Agency";
    if (draft?.role === "worker") return "Worker";
    return "Employer";
  }, [draft?.role]);

  const [userId, setUserId] = useState(draft?.userId ?? "");
  const [emailId, setEmailId] = useState(draft?.emailId ?? "");
  const [password, setPassword] = useState(draft?.password ?? "");

  useEffect(() => {
    if (!draft) router.replace("/onboarding/start" as any);
  }, [draft]);

  const next = async () => {
    if (!userId.trim() || !emailId.trim() || !password.trim()) {
      Alert.alert("Missing", "User ID, Email and Password are required");
      return;
    }

    onboarding.patch({ userId: userId.trim(), emailId: emailId.trim(), password });
    if (draft?.role === "worker") {
      router.push("/onboarding/passport" as any);
    } else {
      router.push("/onboarding/company" as any);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{roleLabel} onboarding</Text>
      <Text style={styles.subtitle}>Step 1 of 3 • Account</Text>

      <View style={styles.card}>
        <Text style={styles.label}>User ID</Text>
        <TextInput value={userId} onChangeText={setUserId} style={styles.input} autoCapitalize="none" />

        <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
        <TextInput value={emailId} onChangeText={setEmailId} style={styles.input} autoCapitalize="none" />

        <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry autoCapitalize="none" />

        <TouchableOpacity style={styles.primaryBtn} onPress={next}>
          <Text style={styles.primaryText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  backText: { fontWeight: "800", opacity: 0.8 },
  title: { marginTop: 6, fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 6, fontSize: 13, opacity: 0.7 },
  card: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  label: { fontSize: 12, opacity: 0.7, fontWeight: "700" },
  input: { marginTop: 6, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", borderRadius: 12, padding: 10 },
  primaryBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 14, alignItems: "center", backgroundColor: "#111" },
  primaryText: { color: "#fff", fontWeight: "900" },
});
