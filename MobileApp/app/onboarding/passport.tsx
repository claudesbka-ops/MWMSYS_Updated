import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useSignupService } from "@/services/signupService";
import Colors from "@/constants/Colors";
import { ThemedTextInput } from "@/components/ThemedTextInput";

export default function OnboardingPassportScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const signup = useSignupService();
  const draft = onboarding.draft;

  const roleLabel = useMemo(() => (draft?.role === "worker" ? "Worker" : "Onboarding"), [draft?.role]);

  const [passportNo, setPassportNo] = useState(draft?.passportNo ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draft) router.replace("/onboarding/start" as any);
    if (draft && draft.role !== "worker") router.replace("/onboarding/company" as any);
  }, [draft]);

  const finish = async () => {
    if (!draft) return;

    if (!passportNo.trim()) {
      Alert.alert("Missing", "Passport number is required");
      return;
    }

    const payload: Record<string, any> = {
      role: "worker",
      userId: draft.userId,
      emailId: draft.emailId,
      password: draft.password,
      passportNo: passportNo.trim(),
    };

    setBusy(true);
    try {
      await signup.signup(payload);
      Alert.alert("Account created", "Please login to continue");
      onboarding.clear();
      router.replace("/login" as any);
    } catch (e: any) {
      Alert.alert("Signup failed", e?.error ?? "Unable to signup");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={busy}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{roleLabel} onboarding</Text>
      <Text style={styles.subtitle}>Step 2 of 2 • Passport</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Passport number</Text>
        <ThemedTextInput value={passportNo} onChangeText={setPassportNo} style={styles.input} autoCapitalize="none" editable={!busy} />

        <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={finish} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create account</Text>}
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
  card: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border },
  label: { fontSize: 12, opacity: 0.7, fontWeight: "700" },
  input: { marginTop: 6, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 12, padding: 10 },
  primaryBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 14, alignItems: "center", backgroundColor: Colors.light.tint },
  primaryText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.6 },
});
