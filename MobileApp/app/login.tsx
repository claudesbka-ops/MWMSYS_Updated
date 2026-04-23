import React, { useState } from "react";
import { Alert, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { ThemedTextInput } from "@/components/ThemedTextInput";
import { useAuthService } from "@/services/authService";
import { useSession } from "@/contexts/SessionContext";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuthService();
  const session = useSession();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const theme = Colors[scheme];

  const [role, setRole] = useState<
    "worker" | "employer" | "agency" | "admin" | "embassy_source" | "embassy_destination" | "labour"
  >("worker");

  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    if (!userName.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Username and password are required");
      return;
    }

    if (role === "worker" && !passportNo.trim()) {
      Alert.alert("Missing fields", "Passport No is required for worker login");
      return;
    }

    setBusy(true);
    try {
      const res = await auth.login({
        userName: userName.trim(),
        password,
        passportNo: role === "worker" ? passportNo.trim() || undefined : undefined,
      });
      if (!res?.access_token) {
        Alert.alert("Login failed", "No token received");
        return;
      }

      session.setToken(res.access_token);
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      Alert.alert("Login failed", e?.error ?? "Unable to login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>MWMSYS</Text>
      <Text style={[styles.subtitle, { color: theme.mutedText }]}>Sign in to continue</Text>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={styles.label}>Role</Text>
        <View style={styles.roleRow}>
          {(
            [
              { key: "worker", label: "Worker" },
              { key: "employer", label: "Employer" },
              { key: "agency", label: "Agency" },
              { key: "admin", label: "Admin" },
              { key: "embassy_source", label: "Embassy (Src)" },
              { key: "embassy_destination", label: "Embassy (Dst)" },
              { key: "labour", label: "Labour" },
            ] as const
          ).map((r) => {
            const selected = role === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                style={[styles.rolePill, selected ? styles.rolePillActive : styles.rolePillInactive]}
                onPress={() => setRole(r.key)}
                disabled={busy}
              >
                <Text style={[styles.rolePillText, selected ? styles.rolePillTextActive : styles.rolePillTextInactive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>User name or email</Text>
        <ThemedTextInput value={userName} onChangeText={setUserName} style={styles.input} autoCapitalize="none" editable={!busy} />

        <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
        <ThemedTextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry autoCapitalize="none" editable={!busy} />

        {role === "worker" && (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>Passport no (Workers only)</Text>
            <ThemedTextInput value={passportNo} onChangeText={setPassportNo} style={styles.input} autoCapitalize="none" editable={!busy} />
          </>
        )}

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }, busy && styles.disabled]} onPress={doLogin} disabled={busy}>
          <Text style={styles.primaryBtnText}>{busy ? "Signing in..." : "Sign In"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ghostBtn, busy && styles.disabled]}
          onPress={() => router.push("/onboarding/start" as any)}
          disabled={busy}
        >
          <Text style={styles.ghostBtnText}>Create account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center" },
  subtitle: { marginTop: 6, opacity: 0.75, textAlign: "center" },
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
  },
  label: { fontSize: 12, fontWeight: "700", opacity: 0.8 },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
  },
  rolePill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  rolePillActive: {
    backgroundColor: "rgba(124,58,237,0.16)",
    borderColor: "rgba(124,58,237,0.55)",
  },
  rolePillInactive: {
    backgroundColor: "transparent",
    borderColor: "rgba(120,120,120,0.25)",
  },
  rolePillText: { fontSize: 12, fontWeight: "700" },
  rolePillTextActive: { opacity: 0.95 },
  rolePillTextInactive: { opacity: 0.7 },
  input: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  primaryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#7c3aed",
    alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "800" },
  ghostBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
    alignItems: "center",
  },
  ghostBtnText: { fontWeight: "700", opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
