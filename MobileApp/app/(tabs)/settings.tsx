import React, { useState } from "react";
import { Alert, StyleSheet, TextInput, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import { useSession } from "@/contexts/SessionContext";

export default function SettingsScreen() {
  const session = useSession();
  const [apiBaseUrl, setApiBaseUrl] = useState(session.apiBaseUrl);
  const [token, setToken] = useState(session.token);

  const save = () => {
    const url = apiBaseUrl.trim();
    if (!url) {
      Alert.alert("Invalid API URL", "API base URL is required");
      return;
    }

    session.setApiBaseUrl(url);
    session.setToken(token.trim());
    Alert.alert("Saved", "Session settings updated");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>API connection and auth token</Text>

      <View style={styles.card}>
        <Text style={styles.label}>API Base URL</Text>
        <TextInput
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          autoCapitalize="none"
          placeholder="http://192.168.1.10:3000"
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 12 }]}>Access Token</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          placeholder="Paste JWT access_token"
          style={[styles.input, styles.multiline]}
          multiline
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={save}>
          <Text style={styles.primaryBtnText}>Save</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Tip: normally you should login from the Login screen. This token field is for debugging/manual override.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
  },
  label: { fontSize: 12, fontWeight: "700", opacity: 0.8 },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
    paddingHorizontal: 12,
    marginTop: 8,
    color: "inherit" as any,
  },
  multiline: { height: 120, paddingTop: 10 },
  primaryBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "700" },
  hint: { marginTop: 12, fontSize: 12, opacity: 0.7 },
});
