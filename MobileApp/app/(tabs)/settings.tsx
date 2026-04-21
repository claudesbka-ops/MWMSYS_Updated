import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TextInput, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import { useSession } from "@/contexts/SessionContext";
import { isBackgroundLocationRunning, startBackgroundLocation, stopBackgroundLocation } from "@/services/backgroundLocation";

export default function SettingsScreen() {
  const session = useSession();
  const [apiBaseUrl, setApiBaseUrl] = useState(session.apiBaseUrl);
  const [token, setToken] = useState(session.token);
  const [locRunning, setLocRunning] = useState(false);

  const appRole = useMemo(() => (session.claims?.appRole ?? session.claims?.role ?? "worker").toString(), [session.claims]);
  const isWorker = appRole === "worker";

  useEffect(() => {
    isBackgroundLocationRunning()
      .then(setLocRunning)
      .catch(() => undefined);
  }, []);

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

        {isWorker ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.label}>Live Location (Background)</Text>
            <Text style={styles.hint}>Used for the Live Map feature. Requires background location permission.</Text>

            <View style={{ marginTop: 10, flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <TouchableOpacity
                style={[styles.ghostBtn, locRunning && styles.disabled]}
                disabled={locRunning}
                onPress={async () => {
                  const r = await startBackgroundLocation();
                  if (!r.ok) {
                    Alert.alert("Location", r.error ?? "Unable to start background location");
                    return;
                  }
                  setLocRunning(true);
                  Alert.alert("Location", "Background live location started");
                }}
              >
                <Text style={styles.ghostText}>Start</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ghostBtn, !locRunning && styles.disabled]}
                disabled={!locRunning}
                onPress={async () => {
                  await stopBackgroundLocation();
                  setLocRunning(false);
                  Alert.alert("Location", "Background live location stopped");
                }}
              >
                <Text style={styles.ghostText}>Stop</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

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
  ghostBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  ghostText: { fontWeight: "800", opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
