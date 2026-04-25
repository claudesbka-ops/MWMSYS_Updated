import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { useOnboarding } from "@/contexts/OnboardingContext";
import { useSignupService } from "@/services/signupService";
import { useApiClient } from "@/services/apiClient";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { Screen, Card, PrimaryButton } from "@/components/ui";
import { OnboardingProgress } from "@/components/OnboardingProgress";

type EmployerOption = { id: string; companyName?: string };

export default function OnboardingWorkerScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const signup = useSignupService();
  const api = useApiClient();
  const draft = onboarding.draft;

  const [userId, setUserId] = useState(draft?.userId ?? "");
  const [fullName, setFullName] = useState(draft?.fullName ?? "");
  const [emailId, setEmailId] = useState(draft?.emailId ?? "");
  const [passportNo, setPassportNo] = useState(draft?.passportNo ?? "");
  const [employerId, setEmployerId] = useState(draft?.employerId ?? "");
  const [password, setPassword] = useState(draft?.password ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draft) router.replace("/onboarding/start" as any);
  }, [draft]);

  const employersQuery = useQuery({
    queryKey: ["public_employers"],
    queryFn: () => api.get<EmployerOption[]>("/Api/Employers/Public"),
  });
  const employers = employersQuery.data ?? [];

  const submit = async () => {
    if (!userId.trim() || !emailId.trim() || !password.trim()) {
      Alert.alert("Missing", "User ID, Email and Password are required");
      return;
    }
    if (!passportNo.trim()) {
      Alert.alert("Missing", "Passport number is required");
      return;
    }

    onboarding.patch({ userId, emailId, password, fullName, passportNo, employerId });
    setBusy(true);
    try {
      const res = await signup.signup({
        userId: userId.trim(),
        emailId: emailId.trim(),
        passportNo: passportNo.trim(),
        password,
        role: "worker",
        name: fullName.trim() || undefined,
        employerId: employerId || undefined,
      });
      onboarding.clear();
      const qs = new URLSearchParams();
      qs.set("userId", res?.userId ?? userId.trim());
      if (res?.emailId || emailId) qs.set("email", res?.emailId ?? emailId.trim());
      router.replace((`/verify-email?${qs.toString()}`) as any);
    } catch (e: any) {
      Alert.alert("Signup failed", e?.error ?? "Unable to signup");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Worker registration" subtitle="Register as a migrant worker on MWMSYS" gradient={["#10b981", "#06b6d4", "#6366f1"]}>
      <OnboardingProgress step={1} total={1} label="Worker · Account" />
      <Card>
        <Text style={styles.label}>User Id</Text>
        <ThemedTextInput value={userId} onChangeText={setUserId} style={styles.input} autoCapitalize="none" editable={!busy} placeholder="worker123" />

        <Text style={styles.label}>Full Name</Text>
        <ThemedTextInput value={fullName} onChangeText={setFullName} style={styles.input} editable={!busy} placeholder="Full name as per passport" />

        <Text style={styles.label}>Email</Text>
        <ThemedTextInput value={emailId} onChangeText={setEmailId} style={styles.input} autoCapitalize="none" keyboardType="email-address" editable={!busy} placeholder="worker@example.com" />

        <Text style={styles.label}>Passport Number</Text>
        <ThemedTextInput value={passportNo} onChangeText={setPassportNo} style={styles.input} autoCapitalize="characters" editable={!busy} placeholder="A12345678" />

        <Text style={styles.label}>Employer (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="No employer yet" active={!employerId} onPress={() => setEmployerId("")} />
          {employers.map((e) => (
            <Chip key={e.id} label={e.companyName || e.id} active={employerId === e.id} onPress={() => setEmployerId(e.id)} />
          ))}
        </ScrollView>
        <Text style={styles.help}>You will appear under this employer immediately after registration.</Text>

        <Text style={styles.label}>Password</Text>
        <ThemedTextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry autoCapitalize="none" editable={!busy} placeholder="••••••••" />

        <PrimaryButton title={busy ? "Creating…" : "Create Account"} loading={busy} onPress={submit} style={{ marginTop: 18 }} />
      </Card>
      <Text style={styles.cancel} onPress={() => !busy && router.back()}>Back to roles</Text>
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 12, fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: "rgba(79,70,229,0.15)",
    paddingHorizontal: 14, marginTop: 8, backgroundColor: "#ffffff", color: "#0f172a",
  },
  help: { marginTop: 6, fontSize: 11, color: "rgba(15,23,42,0.55)" },
  chipRow: { gap: 8, paddingVertical: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: "rgba(79,70,229,0.15)", backgroundColor: "#ffffff", maxWidth: 220 },
  chipActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  chipText: { fontSize: 12, fontWeight: "700", color: "rgba(15,23,42,0.7)" },
  chipTextActive: { color: "#ffffff" },
  cancel: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
