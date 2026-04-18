import React, { useState } from "react";
import { Alert, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";

export default function NewWorkerScreen() {
  const router = useRouter();
  const api = useApiClient();

  const [workerId, setWorkerId] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [fullName, setFullName] = useState("");
  const [emailId, setEmailId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!workerId.trim() || !passportNo.trim() || !password.trim()) {
      Alert.alert("Missing", "Worker ID, Passport No and Password are required");
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
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>New Worker</Text>
      <Text style={styles.subtitle}>Create worker login + profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Worker ID</Text>
        <TextInput value={workerId} onChangeText={setWorkerId} style={styles.input} autoCapitalize="none" />

        <Text style={[styles.label, { marginTop: 12 }]}>Passport No</Text>
        <TextInput value={passportNo} onChangeText={setPassportNo} style={styles.input} autoCapitalize="characters" />

        <Text style={[styles.label, { marginTop: 12 }]}>Full Name (optional)</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} />

        <Text style={[styles.label, { marginTop: 12 }]}>Email (optional)</Text>
        <TextInput value={emailId} onChangeText={setEmailId} style={styles.input} autoCapitalize="none" />

        <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry autoCapitalize="none" />

        <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={create} disabled={busy}>
          <Text style={styles.primaryBtnText}>{busy ? "Creating..." : "Create Worker"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  backText: { fontWeight: "800", opacity: 0.8 },
  title: { marginTop: 12, fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  card: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  label: { fontSize: 12, fontWeight: "700", opacity: 0.8 },
  input: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", paddingHorizontal: 12, marginTop: 8, color: "inherit" as any },
  primaryBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: "#2563eb", alignItems: "center" },
  primaryBtnText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },
});
