import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Screen, Card, PrimaryButton } from "@/components/ui";

export default function NewWorkerScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();

  const appRole = (session.claims?.appRole ?? "").toString();
  const needsEmployerId = appRole === "agency";
  const canSetEmployerId = appRole === "agency" || appRole === "admin";

  const [workerId, setWorkerId] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [fullName, setFullName] = useState("");
  const [emailId, setEmailId] = useState("");
  const [password, setPassword] = useState("");
  const [employerId, setEmployerId] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!workerId.trim() || !passportNo.trim() || !password.trim()) {
      Alert.alert("Missing", "Worker ID, Passport No and Password are required");
      return;
    }

    if (needsEmployerId && !employerId.trim()) {
      Alert.alert("Missing", "Employer ID is required");
      return;
    }

    setBusy(true);
    try {
      await api.post("/Api/Workers/Create", {
        workerId: workerId.trim(),
        passportNo: passportNo.trim(),
        name: fullName.trim(),
        emailId: emailId.trim() || undefined,
        password,
        ...(canSetEmployerId && employerId.trim() ? { employerId: employerId.trim() } : {}),
      });
      Alert.alert("Created", "Worker account created");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to create worker");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="New Worker" subtitle="Create worker login and profile" gradient={["#6366f1", "#8b5cf6", "#ec4899"]}>
      <Card>
        <Text style={styles.label}>Worker ID</Text>
        <TextInput value={workerId} onChangeText={setWorkerId} style={styles.input} autoCapitalize="none" placeholder="W-001" placeholderTextColor="rgba(15,23,42,0.4)" />

        <Text style={styles.label}>Passport No</Text>
        <TextInput value={passportNo} onChangeText={setPassportNo} style={styles.input} autoCapitalize="characters" placeholder="A1234567" placeholderTextColor="rgba(15,23,42,0.4)" />

        <Text style={styles.label}>Full Name (optional)</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholder="John Doe" placeholderTextColor="rgba(15,23,42,0.4)" />

        <Text style={styles.label}>Email (optional)</Text>
        <TextInput value={emailId} onChangeText={setEmailId} style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="john@example.com" placeholderTextColor="rgba(15,23,42,0.4)" />

        <Text style={styles.label}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry autoCapitalize="none" placeholder="••••••••" placeholderTextColor="rgba(15,23,42,0.4)" />

        {canSetEmployerId ? (
          <>
            <Text style={styles.label}>{needsEmployerId ? "Employer ID" : "Employer ID (optional)"}</Text>
            <TextInput value={employerId} onChangeText={setEmployerId} style={styles.input} autoCapitalize="none" placeholder="EMP-001" placeholderTextColor="rgba(15,23,42,0.4)" />
          </>
        ) : null}

        <PrimaryButton title={busy ? "Creating…" : "Create worker"} loading={busy} onPress={create} style={{ marginTop: 18 }} />
      </Card>

      <Text style={styles.cancel} onPress={() => router.back()}>Cancel</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 12, fontSize: 11, fontWeight: '800', color: 'rgba(15,23,42,0.6)', letterSpacing: 0.4, textTransform: 'uppercase' },
  input: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(79,70,229,0.15)',
    paddingHorizontal: 14, marginTop: 8, backgroundColor: '#ffffff', color: '#0f172a',
  },
  cancel: {
    marginTop: 18,
    textAlign: 'center',
    color: 'rgba(15,23,42,0.55)',
    fontSize: 13,
    fontWeight: '700',
  },
});
