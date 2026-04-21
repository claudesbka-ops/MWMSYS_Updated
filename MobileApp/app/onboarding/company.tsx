import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useOnboarding } from "@/contexts/OnboardingContext";
import Colors from "@/constants/Colors";
import { ThemedTextInput } from "@/components/ThemedTextInput";

export default function OnboardingCompanyScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const draft = onboarding.draft;

  const roleLabel = useMemo(() => (draft?.role === "agency" ? "Agency" : "Employer"), [draft?.role]);

  const [organizationName, setOrganizationName] = useState(draft?.organizationName ?? "");
  const [address, setAddress] = useState(draft?.address ?? "");
  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [ssmNumber, setSsmNumber] = useState(draft?.ssmNumber ?? "");

  useEffect(() => {
    if (!draft) router.replace("/onboarding/start" as any);
  }, [draft]);

  const next = async () => {
    if (!organizationName.trim() || !address.trim() || !phone.trim()) {
      Alert.alert("Missing", "Organization name, address and phone are required");
      return;
    }

    onboarding.patch({
      organizationName: organizationName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      ssmNumber: ssmNumber.trim(),
    });

    router.push("/onboarding/contact" as any);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{roleLabel} onboarding</Text>
      <Text style={styles.subtitle}>Step 2 of 3 • Company</Text>

      <View style={styles.card}>
        <Text style={styles.label}>{draft?.role === "agency" ? "Agency / Organization Name" : "Company Name"}</Text>
        <ThemedTextInput value={organizationName} onChangeText={setOrganizationName} style={styles.input} />

        <Text style={[styles.label, { marginTop: 12 }]}>Address</Text>
        <ThemedTextInput value={address} onChangeText={setAddress} style={[styles.input, styles.multiline]} multiline />

        <Text style={[styles.label, { marginTop: 12 }]}>Phone</Text>
        <ThemedTextInput value={phone} onChangeText={setPhone} style={styles.input} autoCapitalize="none" />

        <Text style={[styles.label, { marginTop: 12 }]}>SSM / License No (optional)</Text>
        <ThemedTextInput value={ssmNumber} onChangeText={setSsmNumber} style={styles.input} autoCapitalize="none" />

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
  card: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border },
  label: { fontSize: 12, opacity: 0.7, fontWeight: "700" },
  input: { marginTop: 6, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 12, padding: 10 },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  primaryBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 14, alignItems: "center", backgroundColor: Colors.light.tint },
  primaryText: { color: "#fff", fontWeight: "900" },
});
