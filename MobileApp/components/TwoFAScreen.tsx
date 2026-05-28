import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

type Props = {
  tempToken: string;
  onSuccess: (accessToken: string) => void;
  onBack: () => void;
  apiBaseUrl: string;
};

const RESEND_COOLDOWN = 30;

export default function TwoFAScreen({ tempToken, onSuccess, onBack, apiBaseUrl }: Props) {
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCooldown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  const handleSubmit = async () => {
    const code = otp.trim();
    if (code.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const base = (apiBaseUrl ?? "").replace(/\/+$/, "");
      const res = await fetch(`${base}/Api/Auth/Verify2FA`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ tempToken, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Verification failed");
        return;
      }
      if (!data?.access_token) {
        setError("No token received");
        return;
      }
      onSuccess(data.access_token);
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    startCooldown();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#6366f1", "#8b5cf6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconBadge}
      >
        <FontAwesome name="lock" size={26} color="white" />
      </LinearGradient>

      <Text style={styles.title}>Two-Factor Authentication</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to your email to continue.
      </Text>

      <TextInput
        style={styles.otpInput}
        value={otp}
        onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        placeholder="000000"
        placeholderTextColor="rgba(15,23,42,0.3)"
        maxLength={6}
        editable={!busy}
        textAlign="center"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={busy}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={["#6366f1", "#8b5cf6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnGradient}
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnText}>Verify Code</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleResend}
        disabled={cooldown > 0}
        style={{ marginTop: 12, paddingVertical: 8 }}
      >
        <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={{ marginTop: 8, paddingVertical: 8 }}>
        <Text style={styles.backText}>← Back to login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    padding: 24,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: "rgba(15,23,42,0.6)",
    textAlign: "center",
    lineHeight: 20,
  },
  otpInput: {
    marginTop: 20,
    width: "100%",
    height: 58,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(99,102,241,0.3)",
    backgroundColor: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 8,
    color: "#0f172a",
    textAlign: "center",
  },
  error: {
    marginTop: 10,
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "700",
    textAlign: "center",
  },
  btn: {
    marginTop: 18,
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
  },
  btnDisabled: { opacity: 0.6 },
  btnGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 15, fontWeight: "900", color: "white", letterSpacing: 0.5 },
  resendText: { fontSize: 13, fontWeight: "700", color: "#6366f1" },
  resendDisabled: { color: "rgba(15,23,42,0.4)" },
  backText: { fontSize: 13, fontWeight: "700", color: "rgba(15,23,42,0.55)" },
});
