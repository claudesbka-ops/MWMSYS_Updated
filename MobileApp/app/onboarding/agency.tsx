import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useOnboarding } from "@/contexts/OnboardingContext";
import { useSignupService } from "@/services/signupService";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { Screen, Card, PrimaryButton, GhostButton } from "@/components/ui";
import { OnboardingProgress } from "@/components/OnboardingProgress";

const DEPARTMENTS = ["Customer Service", "Admin", "Operations"];
const COUNTRIES = ["Malaysia", "Nepal", "Bangladesh", "Myanmar", "Indonesia"];
const STATUSES = ["Active", "Inactive"];
const TITLES = ["Mr", "Ms", "Mrs"];

export default function OnboardingAgencyScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const signup = useSignupService();
  const draft = onboarding.draft;

  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState(draft?.fullName ?? "");
  const [organization, setOrganization] = useState(draft?.organization ?? "");
  const [icOrPassport, setIcOrPassport] = useState(draft?.icOrPassport ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(draft?.dateOfBirth ?? "");

  // Step 2
  const [department, setDepartment] = useState(draft?.department ?? "");
  const [country, setCountry] = useState(draft?.country ?? "");
  const [contactNo, setContactNo] = useState(draft?.contactNo ?? "");
  const [status, setStatus] = useState(draft?.status ?? "");
  const [emailId, setEmailId] = useState(draft?.emailId ?? "");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [password, setPassword] = useState(draft?.password ?? "");

  useEffect(() => {
    if (!draft) router.replace("/onboarding/start" as any);
  }, [draft]);

  const canNext1 = !!fullName.trim() && !!organization.trim() && !!icOrPassport.trim();
  const canNext2 = !!department && !!country && !!contactNo.trim() && !!status && !!emailId.trim() && !!password.trim();

  const submit = async () => {
    if (!canNext1 || !canNext2) {
      Alert.alert("Missing", "Please fill all required (*) fields");
      return;
    }
    onboarding.patch({
      fullName, organization, icOrPassport, dateOfBirth,
      department, country, contactNo, status, emailId, title, password,
    });
    setBusy(true);
    try {
      await signup.signup({
        userId: icOrPassport.trim(),
        emailId: emailId.trim(),
        password,
        role: "agency",
        fullName: fullName.trim(),
        organization: organization.trim(),
        icOrPassport: icOrPassport.trim(),
        contactNo: contactNo.trim(),
      });
      onboarding.clear();
      const qs = new URLSearchParams();
      qs.set("userId", icOrPassport.trim());
      qs.set("email", emailId.trim());
      router.replace((`/verify-email?${qs.toString()}`) as any);
    } catch (e: any) {
      Alert.alert("Signup failed", e?.error ?? "Unable to signup");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Agency Onboarding" subtitle={`Step ${step} of 2 · Create your agency account`} gradient={["#f59e0b", "#ef4444", "#6366f1"]}>
      <OnboardingProgress step={step} total={2} label={step === 1 ? "Step 1 · Profile" : "Step 2 · Details"} />

      {step === 1 ? (
        <Card>
          <Text style={styles.label}>Full Name *</Text>
          <ThemedTextInput value={fullName} onChangeText={setFullName} style={styles.input} editable={!busy} placeholder="Full Name" />

          <Text style={styles.label}>Organization *</Text>
          <ThemedTextInput value={organization} onChangeText={setOrganization} style={styles.input} editable={!busy} placeholder="Organization" />

          <Text style={styles.label}>IC / Passport *</Text>
          <ThemedTextInput value={icOrPassport} onChangeText={setIcOrPassport} style={styles.input} autoCapitalize="characters" editable={!busy} placeholder="IC / Passport" />

          <Text style={styles.label}>Date of Birth</Text>
          <ThemedTextInput value={dateOfBirth} onChangeText={setDateOfBirth} style={styles.input} editable={!busy} placeholder="YYYY-MM-DD" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <GhostButton title="Sign in" onPress={() => router.replace("/login" as any)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Next" onPress={() => setStep(2)} disabled={!canNext1} />
            </View>
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={styles.label}>Department *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {DEPARTMENTS.map((d) => (
              <Chip key={d} label={d} active={department === d} onPress={() => setDepartment(d)} />
            ))}
          </ScrollView>

          <Text style={styles.label}>Country *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {COUNTRIES.map((c) => (
              <Chip key={c} label={c} active={country === c} onPress={() => setCountry(c)} />
            ))}
          </ScrollView>

          <Text style={styles.label}>Contact No *</Text>
          <ThemedTextInput value={contactNo} onChangeText={setContactNo} style={styles.input} keyboardType="phone-pad" editable={!busy} placeholder="Contact No" />

          <Text style={styles.label}>Status *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUSES.map((s) => (
              <Chip key={s} label={s} active={status === s} onPress={() => setStatus(s)} />
            ))}
          </ScrollView>

          <Text style={styles.label}>Email Id *</Text>
          <ThemedTextInput value={emailId} onChangeText={setEmailId} style={styles.input} autoCapitalize="none" keyboardType="email-address" editable={!busy} placeholder="Email Id" />

          <Text style={styles.label}>Title</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TITLES.map((t) => (
              <Chip key={t} label={t} active={title === t} onPress={() => setTitle(t)} />
            ))}
          </ScrollView>

          <Text style={styles.label}>Password *</Text>
          <ThemedTextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry autoCapitalize="none" editable={!busy} placeholder="Password" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <GhostButton title="Back" onPress={() => setStep(1)} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title={busy ? "Creating…" : "Create Account"} loading={busy} disabled={!canNext2} onPress={submit} />
            </View>
          </View>
        </Card>
      )}

      <Text style={styles.cancel} onPress={() => !busy && router.replace("/onboarding/start" as any)}>Back to roles</Text>
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 12, fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: "rgba(79,70,229,0.15)",
    paddingHorizontal: 14, marginTop: 8, backgroundColor: "#ffffff", color: "#0f172a",
  },
  chipRow: { gap: 8, paddingVertical: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "rgba(79,70,229,0.15)", backgroundColor: "#ffffff" },
  chipActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  chipText: { fontSize: 12, fontWeight: "700", color: "rgba(15,23,42,0.7)" },
  chipTextActive: { color: "#ffffff" },
  row: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancel: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
