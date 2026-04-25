import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useOnboarding } from "@/contexts/OnboardingContext";
import { useSignupService } from "@/services/signupService";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { Screen, Card, PrimaryButton, GhostButton } from "@/components/ui";
import { OnboardingProgress } from "@/components/OnboardingProgress";

const SECTORS = ["Construction", "Manufacturing", "Services", "Agriculture", "Domestic"];

export default function OnboardingEmployerScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const signup = useSignupService();
  const draft = onboarding.draft;

  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [employerName, setEmployerName] = useState(draft?.employerName ?? "");
  const [ssmRocRobNo, setSsmRocRobNo] = useState(draft?.ssmRocRobNo ?? "");
  const [sector, setSector] = useState(draft?.sector ?? "");
  const [telephoneNo, setTelephoneNo] = useState(draft?.telephoneNo ?? "");
  const [address, setAddress] = useState(draft?.address ?? "");

  // Step 2
  const [contactPerson, setContactPerson] = useState(draft?.contactPerson ?? "");
  const [contactPersonIcNo, setContactPersonIcNo] = useState(draft?.contactPersonIcNo ?? "");
  const [hpNumber, setHpNumber] = useState(draft?.hpNumber ?? "");
  const [position, setPosition] = useState(draft?.position ?? "");
  const [emailId, setEmailId] = useState(draft?.emailId ?? "");
  const [phoneNo, setPhoneNo] = useState(draft?.phoneNo ?? "");
  const [password, setPassword] = useState(draft?.password ?? "");

  useEffect(() => {
    if (!draft) router.replace("/onboarding/start" as any);
  }, [draft]);

  const canNext1 = !!employerName.trim() && !!ssmRocRobNo.trim() && !!sector && !!telephoneNo.trim() && !!address.trim();
  const canNext2 = !!contactPerson.trim() && !!contactPersonIcNo.trim() && !!hpNumber.trim() && !!emailId.trim() && !!phoneNo.trim() && !!password.trim();

  const submit = async () => {
    if (!canNext1 || !canNext2) {
      Alert.alert("Missing", "Please fill all required (*) fields");
      return;
    }
    onboarding.patch({
      employerName, ssmRocRobNo, sector, telephoneNo, address,
      contactPerson, contactPersonIcNo, hpNumber, position, emailId, phoneNo, password,
    });
    setBusy(true);
    try {
      await signup.signup({
        userId: ssmRocRobNo.trim(),
        emailId: emailId.trim(),
        password,
        role: "employer",
        employerName: employerName.trim(),
        address: address.trim(),
        companyPhone: telephoneNo.trim() || phoneNo.trim(),
        ssmNumber: ssmRocRobNo.trim(),
        sector,
        contactPersonName: contactPerson.trim(),
        contactPersonPosition: position.trim(),
        contactPersonIc: contactPersonIcNo.trim(),
        contactPersonEmail: emailId.trim(),
        contactPersonPhone: hpNumber.trim() || phoneNo.trim(),
      });
      onboarding.clear();
      const qs = new URLSearchParams();
      qs.set("userId", ssmRocRobNo.trim());
      qs.set("email", emailId.trim());
      router.replace((`/verify-email?${qs.toString()}`) as any);
    } catch (e: any) {
      Alert.alert("Signup failed", e?.error ?? "Unable to signup");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Employer Onboarding" subtitle={`Step ${step} of 2 · Create your employer account`} gradient={["#6366f1", "#8b5cf6", "#ec4899"]}>
      <OnboardingProgress step={step} total={2} label={step === 1 ? "Step 1 · Company" : "Step 2 · Contact"} />

      {step === 1 ? (
        <Card>
          <Text style={styles.label}>Company Name *</Text>
          <ThemedTextInput value={employerName} onChangeText={setEmployerName} style={styles.input} editable={!busy} placeholder="Company Name" />

          <Text style={styles.label}>SSM / ROC / ROB No *</Text>
          <ThemedTextInput value={ssmRocRobNo} onChangeText={setSsmRocRobNo} style={styles.input} autoCapitalize="characters" editable={!busy} placeholder="SSM / ROC / ROB No" />

          <Text style={styles.label}>Sector *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SECTORS.map((s) => (
              <Chip key={s} label={s} active={sector === s} onPress={() => setSector(s)} />
            ))}
          </ScrollView>

          <Text style={styles.label}>Company Phone *</Text>
          <ThemedTextInput value={telephoneNo} onChangeText={setTelephoneNo} style={styles.input} keyboardType="phone-pad" editable={!busy} placeholder="Company Phone" />

          <Text style={styles.label}>Company Address *</Text>
          <ThemedTextInput value={address} onChangeText={setAddress} style={[styles.input, styles.multiline]} multiline editable={!busy} placeholder="Address" />

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
          <Text style={styles.label}>Contact Person Name *</Text>
          <ThemedTextInput value={contactPerson} onChangeText={setContactPerson} style={styles.input} editable={!busy} placeholder="Contact Person" />

          <Text style={styles.label}>Contact Person IC / Passport *</Text>
          <ThemedTextInput value={contactPersonIcNo} onChangeText={setContactPersonIcNo} style={styles.input} autoCapitalize="characters" editable={!busy} placeholder="IC / Passport" />

          <Text style={styles.label}>Contact Person Phone *</Text>
          <ThemedTextInput value={hpNumber} onChangeText={setHpNumber} style={styles.input} keyboardType="phone-pad" editable={!busy} placeholder="Phone" />

          <Text style={styles.label}>Position</Text>
          <ThemedTextInput value={position} onChangeText={setPosition} style={styles.input} editable={!busy} placeholder="Position" />

          <Text style={styles.label}>Email *</Text>
          <ThemedTextInput value={emailId} onChangeText={setEmailId} style={styles.input} autoCapitalize="none" keyboardType="email-address" editable={!busy} placeholder="Email Address" />

          <Text style={styles.label}>Alternate Phone *</Text>
          <ThemedTextInput value={phoneNo} onChangeText={setPhoneNo} style={styles.input} keyboardType="phone-pad" editable={!busy} placeholder="Phone" />

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
  multiline: { minHeight: 90, height: undefined, textAlignVertical: "top", paddingVertical: 12 },
  chipRow: { gap: 8, paddingVertical: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "rgba(79,70,229,0.15)", backgroundColor: "#ffffff" },
  chipActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  chipText: { fontSize: 12, fontWeight: "700", color: "rgba(15,23,42,0.7)" },
  chipTextActive: { color: "#ffffff" },
  row: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancel: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
