import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import { useSession } from "@/contexts/SessionContext";
import { isBackgroundLocationRunning, startBackgroundLocation, stopBackgroundLocation } from "@/services/backgroundLocation";

export default function SettingsScreen() {
  const session = useSession();
  const [locRunning, setLocRunning] = useState(false);

  const appRole = useMemo(() => (session.claims?.appRole ?? session.claims?.role ?? "worker").toString(), [session.claims]);
  const isWorker = appRole === "worker";

  useEffect(() => {
    isBackgroundLocationRunning()
      .then(setLocRunning)
      .catch(() => undefined);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>App preferences</Text>

      <View style={styles.card}>
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
  hint: { marginTop: 12, fontSize: 12, opacity: 0.7 },
  ghostBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  ghostText: { fontWeight: "800", opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
