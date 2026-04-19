import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useSignupService } from "@/services/signupService";

export default function OnboardingContactScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const signup = useSignupService();
  const draft = onboarding.draft;

  const roleLabel = useMemo(() => (draft?.role === "agency" ? "Agency" : "Employer"), [draft?.role]);

  const [contactPersonName, setContactPersonName] = useState(draft?.contactPersonName ?? "");
  const [contactPersonPosition, setContactPersonPosition] = useState(draft?.contactPersonPosition ?? "");
  const [contactPersonIc, setContactPersonIc] = useState(draft?.contactPersonIc ?? "");
  const [contactPersonPhone, setContactPersonPhone] = useState(draft?.contactPersonPhone ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draft) router.replace("/onboarding/start" as any);
  }, [draft]);

  const finish = async () => {
    if (!draft) return;

    if (!contactPersonName.trim() || !contactPersonPhone.trim()) {
      Alert.alert("Missing", "Contact person name and phone are required");
      return;
    }

    const payload: Record<string, any> = {
      role: draft.role,
      userId: draft.userId,
      emailId: draft.emailId,
      password: draft.password,

      employerName: draft.organizationName,
      address: draft.address,
      companyPhone: draft.phone,
      ssmNumber: draft.ssmNumber,

      contactPersonName: contactPersonName.trim(),
      contactPersonPosition: contactPersonPosition.trim(),
      contactPersonIc: contactPersonIc.trim(),
      contactPersonPhone: contactPersonPhone.trim(),

      organization: draft.organizationName,
      fullName: contactPersonName.trim(),
      hpNumber: contactPersonPhone.trim(),
      position: contactPersonPosition.trim(),
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
      <Text style={styles.subtitle}>Step 3 of 3 • Contact person</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Contact person name</Text>
        <TextInput value={contactPersonName} onChangeText={setContactPersonName} style={styles.input} editable={!busy} />

        <Text style={[styles.label, { marginTop: 12 }]}>Position (optional)</Text>
        <TextInput value={contactPersonPosition} onChangeText={setContactPersonPosition} style={styles.input} editable={!busy} />

        <Text style={[styles.label, { marginTop: 12 }]}>IC / Passport (optional)</Text>
        <TextInput value={contactPersonIc} onChangeText={setContactPersonIc} style={styles.input} autoCapitalize="none" editable={!busy} />

        <Text style={[styles.label, { marginTop: 12 }]}>Phone</Text>
        <TextInput value={contactPersonPhone} onChangeText={setContactPersonPhone} style={styles.input} autoCapitalize="none" editable={!busy} />

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
  card: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  label: { fontSize: 12, opacity: 0.7, fontWeight: "700" },
  input: { marginTop: 6, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", borderRadius: 12, padding: 10 },
  primaryBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 14, alignItems: "center", backgroundColor: "#111" },
  primaryText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.6 },
});
