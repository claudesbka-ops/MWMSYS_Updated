import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { useSession } from "@/contexts/SessionContext";
import { isBackgroundLocationRunning, startBackgroundLocation, stopBackgroundLocation } from "@/services/backgroundLocation";
import { Screen, Card, PrimaryButton, GhostButton, SectionTitle } from "@/components/ui";

export default function SettingsScreen() {
  const router = useRouter();
  const session = useSession();
  const [locRunning, setLocRunning] = useState(false);
  const [baseOverride, setBaseOverride] = useState(session.apiBaseUrl);

  const appRole = useMemo(() => (session.claims?.appRole ?? session.claims?.role ?? "worker").toString(), [session.claims]);
  const userName = (session.claims?.userName ?? session.claims?.emailId ?? "User").toString();
  const isWorker = appRole === "worker";

  useEffect(() => {
    isBackgroundLocationRunning()
      .then(setLocRunning)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setBaseOverride(session.apiBaseUrl);
  }, [session.apiBaseUrl]);

  const handleStartLoc = async () => {
    const r = await startBackgroundLocation();
    if (!r.ok) {
      Alert.alert("Location", r.error ?? "Unable to start background location");
      return;
    }
    setLocRunning(true);
    Alert.alert("Location", "Background live location started");
  };

  const handleStopLoc = async () => {
    await stopBackgroundLocation();
    setLocRunning(false);
    Alert.alert("Location", "Background live location stopped");
  };

  const saveBaseUrl = async () => {
    const next = baseOverride.trim();
    try {
      session.setApiBaseUrl(next);
      Alert.alert("API", next.length ? "Using custom API base URL" : "Reverted to default API base URL");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Unable to save");
    }
  };

  const signOut = async () => {
    Alert.alert("Sign out", "Sign out of your account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await session.clear();
          router.replace("/login" as any);
        },
      },
    ]);
  };

  return (
    <Screen title="Settings" subtitle="Preferences, location and account" gradient={["#64748b", "#0f172a", "#6366f1"]}>
      <Card tight>
        <Text style={styles.sectionLabel}>Signed in as</Text>
        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.userRole}>Role: {appRole}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <PrimaryButton title="Edit profile" onPress={() => router.push("/account" as any)} style={{ flex: 1 }} />
          <PrimaryButton title="Sign out" variant="danger" onPress={signOut} style={{ flex: 1 }} />
        </View>
      </Card>

      {isWorker ? (
        <>
          <SectionTitle title="Background location" />
          <Card tight>
            <Text style={styles.hint}>
              Required for Live Map. Your employer and MWMSYS can see your position while this is on.
            </Text>
            <View style={styles.actions}>
              {!locRunning ? (
                <PrimaryButton title="Start sharing location" variant="success" onPress={handleStartLoc} style={{ flex: 1 }} />
              ) : (
                <PrimaryButton title="Stop sharing location" variant="danger" onPress={handleStopLoc} style={{ flex: 1 }} />
              )}
            </View>
            <Text style={[styles.status, locRunning ? styles.statusOn : styles.statusOff]}>
              {locRunning ? "●  Live sharing is ON" : "○  Live sharing is OFF"}
            </Text>
          </Card>
        </>
      ) : null}

      <SectionTitle title="Advanced" />
      <Card tight>
        <Text style={styles.sectionLabel}>API base URL</Text>
        <Text style={styles.hint}>
          Point the app at a different backend (for QA). Leave blank to use the default.
        </Text>
        <TextInput
          value={baseOverride}
          onChangeText={setBaseOverride}
          placeholder="https://api.example.com"
          placeholderTextColor="rgba(15,23,42,0.4)"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.actions}>
          <PrimaryButton title="Save" onPress={saveBaseUrl} style={{ flex: 1 }} />
          <GhostButton
            title="Reset"
            onPress={() => {
              setBaseOverride("");
            }}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 11, fontWeight: '800', color: 'rgba(15,23,42,0.55)', letterSpacing: 0.4, textTransform: 'uppercase' },
  userName: { marginTop: 8, fontSize: 20, fontWeight: '900', color: '#0f172a' },
  userRole: { marginTop: 4, fontSize: 13, color: 'rgba(15,23,42,0.6)', fontWeight: '600' },
  hint: { marginTop: 8, fontSize: 12, color: 'rgba(15,23,42,0.65)', lineHeight: 17 },
  actions: { marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  input: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(79,70,229,0.15)',
    paddingHorizontal: 14, marginTop: 10, backgroundColor: '#ffffff', color: '#0f172a',
  },
  status: { marginTop: 12, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  statusOn: { color: '#047857' },
  statusOff: { color: 'rgba(15,23,42,0.45)' },
});
