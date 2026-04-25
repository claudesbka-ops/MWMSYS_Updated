import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";

type VerifyEmailResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  userName?: string;
};

type ResendOtpResponse = {
  ok: boolean;
  userId: string;
  remainingSends?: number;
  smtpFallback?: boolean;
};

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; email?: string }>();
  const api = useApiClient();
  const session = useSession();

  const initialUserId = String(params?.userId ?? "");
  const initialEmail = String(params?.email ?? "");

  const [userId, setUserId] = useState(initialUserId);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const canSubmit = useMemo(
    () => userId.trim().length > 0 && /^[0-9]{6}$/.test(otp.trim()) && !submitting,
    [userId, otp, submitting]
  );

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const resp = await api.post<VerifyEmailResponse>("/Api/Auth/VerifyEmail", {
        userId: userId.trim(),
        otp: otp.trim(),
      });
      if (!resp?.access_token) {
        Alert.alert("Verified", "Verification succeeded but no token returned. Please log in.");
        router.replace("/login" as any);
        return;
      }
      session.setToken(resp.access_token);
      Alert.alert("Verified", "Email verified. Welcome aboard.");
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      Alert.alert("Verification failed", e?.error ?? "Invalid or expired code");
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0 || resending) return;
    if (!userId.trim()) {
      Alert.alert("Missing", "Enter your user ID first");
      return;
    }
    setResending(true);
    try {
      const resp = await api.post<ResendOtpResponse>("/Api/Auth/ResendOtp", { userId: userId.trim() });
      const remaining = resp?.remainingSends ?? 0;
      const message = resp?.smtpFallback
        ? "A new code has been generated. SMTP is not configured — ask the admin to check server logs."
        : remaining > 0
          ? `New code sent. ${remaining} resend${remaining === 1 ? "" : "s"} remaining this hour.`
          : "New code sent.";
      Alert.alert("Sent", message);
      setCooldown(30);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to resend code");
      if (Number(e?.status) === 429) setCooldown(60);
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f4f6fb" }}>
      <LinearGradient
        colors={["#eef2ff", "#f5f3ff", "#fdf2f8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill as any}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBadge}>
              <FontAwesome name="envelope-o" size={24} color="white" />
            </LinearGradient>
          </View>

          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            {initialEmail
              ? `Enter the 6-digit code we sent to ${initialEmail}.`
              : "Enter the 6-digit code we emailed you."}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>User ID</Text>
            <TextInput
              value={userId}
              onChangeText={setUserId}
              editable={!initialUserId}
              autoCapitalize="none"
              placeholder="Your user ID"
              placeholderTextColor="rgba(15,23,42,0.4)"
              style={[styles.input, !!initialUserId && styles.inputDisabled]}
            />

            <Text style={[styles.label, { marginTop: 18 }]}>6-digit code</Text>
            <TextInput
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              textContentType="oneTimeCode"
              placeholder="000000"
              placeholderTextColor="rgba(15,23,42,0.3)"
              style={[styles.input, styles.otpInput]}
            />
            <Text style={styles.hint}>Codes expire after 15 minutes. Check your spam folder if you don't see the email.</Text>

            <TouchableOpacity
              disabled={!canSubmit}
              onPress={onSubmit}
              activeOpacity={0.85}
              style={[styles.primary, !canSubmit && styles.primaryDisabled]}
            >
              <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
              {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Verify email</Text>}
            </TouchableOpacity>

            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={onResend} disabled={cooldown > 0 || resending} style={styles.linkBtn}>
                <Text style={[styles.linkText, (cooldown > 0 || resending) && { color: "rgba(15,23,42,0.4)" }]}>
                  {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.replace("/login" as any)}>
                <Text style={styles.linkMuted}>Back to login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 22, justifyContent: "center" },
  iconWrap: { alignItems: "center", marginBottom: 16 },
  iconBadge: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  title: { fontSize: 24, fontWeight: "900", color: "#0f172a", textAlign: "center" },
  subtitle: { marginTop: 6, fontSize: 13, color: "rgba(15,23,42,0.6)", textAlign: "center", paddingHorizontal: 12 },

  card: {
    marginTop: 22, padding: 20, borderRadius: 22,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(99,102,241,0.12)",
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 22, elevation: 4,
  },

  label: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    marginTop: 8, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(99,102,241,0.18)",
    backgroundColor: "#ffffff", color: "#0f172a", fontSize: 14,
  },
  inputDisabled: { backgroundColor: "rgba(15,23,42,0.04)", color: "rgba(15,23,42,0.6)" },
  otpInput: { textAlign: "center", letterSpacing: 8, fontSize: 22, fontWeight: "900" },
  hint: { marginTop: 8, fontSize: 11, color: "rgba(15,23,42,0.55)" },

  primary: {
    overflow: "hidden", marginTop: 18, paddingVertical: 14,
    borderRadius: 14, alignItems: "center", justifyContent: "center",
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: "white", fontWeight: "900", fontSize: 14, letterSpacing: 0.4 },

  actionsRow: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  linkBtn: { paddingVertical: 4 },
  linkText: { color: "#4f46e5", fontWeight: "800", fontSize: 12 },
  linkMuted: { color: "rgba(15,23,42,0.55)", fontWeight: "700", fontSize: 12 },
});
