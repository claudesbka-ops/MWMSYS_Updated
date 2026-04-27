import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { ThemedTextInput } from "@/components/ThemedTextInput";
import { useAuthService } from "@/services/authService";
import { useSession } from "@/contexts/SessionContext";
import { GradientBackground, PrimaryButton, GhostButton } from "@/components/ui";

const ROLES = [
  { key: "worker", label: "👷 Worker", icon: "user" as const },
  { key: "employer", label: "🏢 Employer", icon: "building" as const },
  { key: "agency", label: "💼 Agency", icon: "briefcase" as const },
] as const;

type Role = (typeof ROLES)[number]["key"];

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuthService();
  const session = useSession();

  const [role, setRole] = useState<Role>("worker");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [serverUrl, setServerUrl] = useState(session.apiBaseUrl);

  // ⚠️ DEV BYPASS: tapping Sign In drops you straight into the selected
  // role's dashboard with a synthetic local-only JWT. No backend call.
  // Remove this block (and restore the real `auth.login(...)` flow below)
  // once signin is working end-to-end.
  const doLogin = async () => {
    setBusy(true);
    try {
      const fakeUser = userName.trim() || `${role}-dev`;
      const token = mintDevToken({
        appRole: role,
        roleId: role === "worker" ? 2 : role === "employer" ? 3 : 4,
        userName: fakeUser,
        userKey: fakeUser,
        emailId: `${fakeUser}@dev.local`,
      });
      session.setToken(token);
      router.replace("/(tabs)" as any);
    } finally {
      setBusy(false);
    }
  };

  // Real login (kept for when we re-enable it).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _doRealLogin = async () => {
    const u = userName.trim();
    const p = password;
    const passport = passportNo.trim();
    const missing: string[] = [];
    if (!u) missing.push("Username/email");
    if (!p) missing.push("Password");
    if (role === "worker" && !passport) missing.push("Passport No");
    if (missing.length) {
      Alert.alert("Missing fields", `Please fill: ${missing.join(", ")}.`);
      return;
    }

    setBusy(true);
    try {
      const res = await auth.login({
        userName: u,
        password: p,
        passportNo: role === "worker" ? passport || undefined : undefined,
      });
      if (!res?.access_token) {
        Alert.alert("Login failed", "No token received");
        return;
      }
      session.setToken(res.access_token);
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      const detail = e?.error ?? e?.message ?? "Unable to login";
      const where = session.apiBaseUrl ? `\n\nServer: ${session.apiBaseUrl}` : "";
      Alert.alert("Login failed", `${detail}${where}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo mark */}
          <View style={styles.logoRow}>
            <LinearGradient colors={["#6366f1", "#8b5cf6", "#ec4899"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoBadge}>
              <FontAwesome name="shield" color="white" size={22} />
            </LinearGradient>
            <View>
              <Text style={styles.brand}>MWMSYS</Text>
              <Text style={styles.brandSub}>Migrant Worker Management</Text>
            </View>
          </View>

          <Text style={styles.hero}>Welcome back</Text>
          <Text style={styles.heroSub}>Sign in to your account to continue</Text>

          {/* Glass card */}
          <View style={styles.card}>
            <LinearGradient colors={["#ffffff", "#f8faff"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.cardInner}>
              <Text style={styles.label}>I am a…</Text>
              <View style={styles.roleRow}>
                {ROLES.map((r) => {
                  const selected = role === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      onPress={() => setRole(r.key)}
                      disabled={busy}
                      activeOpacity={0.85}
                      style={[styles.rolePill, selected && styles.rolePillActive]}
                    >
                      {selected ? (
                        <LinearGradient
                          colors={["#6366f1", "#8b5cf6"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.roleBg}
                        />
                      ) : null}
                      <FontAwesome name={r.icon} size={11} color={selected ? "white" : "rgba(15,23,42,0.55)"} />
                      <Text style={[styles.rolePillText, selected && styles.rolePillTextActive]}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.label, { marginTop: 18 }]}>User name or email</Text>
              <ThemedTextInput
                value={userName}
                onChangeText={setUserName}
                style={styles.input}
                autoCapitalize="none"
                editable={!busy}
                placeholder="you@example.com"
              />

              <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
              <ThemedTextInput
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                editable={!busy}
                placeholder="••••••••"
              />

              {role === "worker" && (
                <>
                  <Text style={[styles.label, { marginTop: 14 }]}>Passport no</Text>
                  <ThemedTextInput
                    value={passportNo}
                    onChangeText={setPassportNo}
                    style={styles.input}
                    autoCapitalize="characters"
                    editable={!busy}
                    placeholder="A1234567"
                  />
                </>
              )}

              <PrimaryButton
                title={`✨ Continue as ${role}`}
                loading={busy}
                onPress={doLogin}
                style={{ marginTop: 20 }}
              />
              <Text style={styles.devHint}>
                🛠️ Dev mode: tap above to enter the {role} dashboard (no auth).
              </Text>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <GhostButton
                title="📝 Create new account"
                onPress={() => router.push("/onboarding/start" as any)}
                disabled={busy}
              />

              <TouchableOpacity
                onPress={() => router.push("/verify-email" as any)}
                disabled={busy}
                style={{ alignSelf: "center", marginTop: 14, paddingVertical: 6 }}
              >
                <Text style={styles.verifyLink}>✉️ Have a verification code? Verify email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowServer((v) => !v)}
                disabled={busy}
                style={{ alignSelf: "center", marginTop: 8, paddingVertical: 6 }}
              >
                <Text style={styles.serverToggle}>
                  {showServer ? "Hide server URL" : `Server: ${session.apiBaseUrl}`}
                </Text>
              </TouchableOpacity>

              {showServer && (
                <>
                  <Text style={[styles.label, { marginTop: 6 }]}>Server URL</Text>
                  <ThemedTextInput
                    value={serverUrl}
                    onChangeText={setServerUrl}
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="url"
                    editable={!busy}
                    placeholder="http://192.168.x.x:3000"
                  />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <GhostButton
                        title="Reset"
                        disabled={busy}
                        onPress={() => {
                          session.setApiBaseUrl("");
                          setServerUrl(session.apiBaseUrl);
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        title="Save"
                        disabled={busy}
                        onPress={() => {
                          session.setApiBaseUrl(serverUrl.trim());
                        }}
                      />
                    </View>
                  </View>
                </>
              )}
            </LinearGradient>
          </View>

          <Text style={styles.footer}>
            By signing in you agree to our Terms & Privacy Policy.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 22, justifyContent: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 26 },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  brand: { fontSize: 20, fontWeight: "900", color: "#0f172a", letterSpacing: 1.2 },
  brandSub: { fontSize: 11, color: "rgba(15,23,42,0.55)", fontWeight: "600", marginTop: 2 },

  hero: { fontSize: 28, fontWeight: "800", color: "#0f172a", letterSpacing: 0.3 },
  heroSub: { marginTop: 6, fontSize: 14, color: "rgba(15,23,42,0.6)" },

  card: {
    marginTop: 22,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.1)",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  cardInner: { padding: 20 },

  label: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.5, textTransform: "uppercase" },

  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  rolePill: {
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.15)",
    backgroundColor: "#ffffff",
  },
  rolePillActive: { borderColor: "transparent" },
  roleBg: { position: "absolute", inset: 0 as any, left: 0, right: 0, top: 0, bottom: 0 },
  rolePillText: { fontSize: 12, fontWeight: "700", color: "rgba(15,23,42,0.65)" },
  rolePillTextActive: { color: "white" },

  input: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.15)",
  },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(15,23,42,0.08)" },
  dividerText: { fontSize: 11, color: "rgba(15,23,42,0.45)", fontWeight: "700" },

  footer: { marginTop: 26, textAlign: "center", fontSize: 11, color: "rgba(15,23,42,0.5)" },
  verifyLink: { fontSize: 12, fontWeight: "800", color: "#4f46e5" },
  serverToggle: { fontSize: 11, fontWeight: "700", color: "rgba(15,23,42,0.55)" },
  devHint: { marginTop: 8, textAlign: "center", fontSize: 11, fontWeight: "700", color: "rgba(220,38,38,0.85)" },
});

// ---------- DEV-ONLY: synthetic JWT for the bypass login ----------
// Mints a fake JWT (header.payload.sig) whose payload is decoded by
// SessionContext to populate `claims.appRole`, `claims.userName`, etc.
// The signature is junk; protected backend routes will 401, but that's
// fine while we're just exploring screens.
function mintDevToken(claims: {
  appRole: "worker" | "employer" | "agency";
  roleId: number;
  userName: string;
  userKey: string;
  emailId: string;
}): string {
  const header = { alg: "none", typ: "JWT" };
  const payload = {
    ...claims,
    userId: 0,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  };
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.dev`;
}

function b64url(input: string): string {
  // base64-encode, then make it URL-safe and strip padding.
  const b64 = typeof (globalThis as any).btoa === "function"
    ? (globalThis as any).btoa(unescape(encodeURIComponent(input)))
    : base64Encode(input);
  return b64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64Encode(input: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  const bytes = unescape(encodeURIComponent(input));
  while (i < bytes.length) {
    const c1 = bytes.charCodeAt(i++);
    const c2 = i < bytes.length ? bytes.charCodeAt(i++) : NaN;
    const c3 = i < bytes.length ? bytes.charCodeAt(i++) : NaN;
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | ((isNaN(c2) ? 0 : c2) >> 4);
    const e3 = isNaN(c2) ? 64 : (((c2 & 15) << 2) | ((isNaN(c3) ? 0 : c3) >> 6));
    const e4 = isNaN(c3) ? 64 : (c3 & 63);
    out += chars.charAt(e1) + chars.charAt(e2) + (e3 === 64 ? "=" : chars.charAt(e3)) + (e4 === 64 ? "=" : chars.charAt(e4));
  }
  return out;
}
