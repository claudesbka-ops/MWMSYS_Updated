import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";

type AccountProfile = {
  userId: string | null;
  userName: string | null;
  emailId: string | null;
  role: string | null;
  profile:
    | { kind: "worker"; fields: Record<string, string | null>; complete: boolean }
    | { kind: "employer"; fields: Record<string, string | null>; complete: boolean }
    | { kind: "agency"; fields: Record<string, string | null>; complete: boolean }
    | null;
};

const FIELD_LABELS: Record<string, Record<string, { label: string; placeholder?: string; multiline?: boolean; keyboard?: "default" | "email-address" | "phone-pad" | "numeric" | "decimal-pad"; capitalize?: "none" | "characters" }>> = {
  worker: {
    name: { label: "Full name", placeholder: "As on passport" },
    email: { label: "Email", keyboard: "email-address", capitalize: "none" },
    contactNumber: { label: "Contact number", keyboard: "phone-pad" },
    address: { label: "Address", multiline: true },
    passportNumber: { label: "Passport number", capitalize: "characters" },
  },
  employer: {
    companyName: { label: "Company name" },
    email: { label: "Company email", keyboard: "email-address", capitalize: "none" },
    companyPhone: { label: "Company phone", keyboard: "phone-pad" },
    address: { label: "Address", multiline: true },
    ssmNumber: { label: "SSM number", capitalize: "characters" },
    contactPerson: { label: "Contact person" },
    position: { label: "Contact position" },
    contactPersonPhone: { label: "Contact phone", keyboard: "phone-pad" },
  },
  agency: {
    agentName: { label: "Agent name" },
    organizationName: { label: "Organization name" },
    email: { label: "Email", keyboard: "email-address", capitalize: "none" },
    contactNumber: { label: "Contact number", keyboard: "phone-pad" },
    icPassport: { label: "IC / Passport", capitalize: "characters" },
  },
};

export default function CompleteProfileScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AccountProfile>("/Api/Account/Profile");
      setProfile(res ?? null);
      const f = (res?.profile?.fields ?? {}) as Record<string, string | null>;
      const next: Record<string, string> = {};
      Object.entries(f).forEach(([k, v]) => {
        if (k === "photo") return;
        next[k] = String(v ?? "");
      });
      setFields(next);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to load profile");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put<{ ok: boolean; profile: AccountProfile["profile"] }>("/Api/Account/Profile", fields);
      const complete = res?.profile?.complete === true;
      if (complete) {
        Alert.alert("Saved", "Profile complete. Welcome aboard.");
        router.replace("/(tabs)" as any);
      } else {
        Alert.alert("Saved", "Profile updated. A few required fields are still missing.");
        await load();
      }
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to save profile");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    Alert.alert("Sign out", "Sign out and finish later?", [
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

  const role = profile?.profile?.kind ?? null;
  const roleFields = role ? FIELD_LABELS[role] ?? {} : {};
  const isReadyToSave = role != null && Object.keys(roleFields).length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#f4f6fb" }}>
      <LinearGradient colors={["#eef2ff", "#f5f3ff", "#fdf2f8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBadge}>
              <FontAwesome name="user-plus" size={22} color="white" />
            </LinearGradient>
          </View>

          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.subtitle}>
            We need a few more details before you can use MWMSYS. This is a one-time step.
          </Text>

          {loading ? (
            <View style={{ marginTop: 40, alignItems: "center" }}>
              <ActivityIndicator color="#6366f1" />
            </View>
          ) : !role ? (
            <View style={styles.card}>
              <Text style={styles.muted}>
                There are no editable profile fields for your role. You can continue.
              </Text>
              <TouchableOpacity activeOpacity={0.85} onPress={() => router.replace("/(tabs)" as any)} style={styles.primary}>
                <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
                <Text style={styles.primaryText}>Continue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.rolePill}>
                <FontAwesome name="id-badge" size={11} color="#4f46e5" />
                <Text style={styles.rolePillText}>{(profile?.role ?? role).toUpperCase()}</Text>
              </View>

              {Object.entries(roleFields).map(([key, meta]) => (
                <View key={key}>
                  <Text style={styles.label}>{meta.label}</Text>
                  <TextInput
                    value={fields[key] ?? ""}
                    onChangeText={(v) => setFields((prev) => ({ ...prev, [key]: v }))}
                    placeholder={meta.placeholder ?? ""}
                    placeholderTextColor="rgba(15,23,42,0.4)"
                    multiline={!!meta.multiline}
                    keyboardType={meta.keyboard ?? "default"}
                    autoCapitalize={meta.capitalize ?? "sentences"}
                    style={[styles.input, !!meta.multiline && styles.multiline]}
                  />
                </View>
              ))}

              <TouchableOpacity
                disabled={!isReadyToSave || saving}
                onPress={save}
                activeOpacity={0.85}
                style={[styles.primary, (!isReadyToSave || saving) && styles.primaryDisabled]}
              >
                <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
                {saving ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Save and continue</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={signOut} style={{ alignItems: "center", marginTop: 10 }}>
                <Text style={styles.linkMuted}>Sign out and finish later</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 22, paddingBottom: 40 },
  iconWrap: { alignItems: "center", marginTop: 12, marginBottom: 14 },
  iconBadge: {
    width: 60, height: 60, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  title: { fontSize: 22, fontWeight: "900", color: "#0f172a", textAlign: "center" },
  subtitle: { marginTop: 6, fontSize: 13, color: "rgba(15,23,42,0.6)", textAlign: "center", paddingHorizontal: 12 },

  card: {
    marginTop: 18, padding: 20, borderRadius: 22,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(99,102,241,0.12)",
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 22, elevation: 4,
  },

  rolePill: {
    alignSelf: "flex-start",
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.12)",
    marginBottom: 6,
  },
  rolePillText: { fontSize: 10, fontWeight: "900", color: "#4f46e5", letterSpacing: 0.5 },

  label: { marginTop: 14, fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    marginTop: 8, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(99,102,241,0.18)",
    backgroundColor: "#ffffff", color: "#0f172a", fontSize: 14,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },

  primary: {
    overflow: "hidden", marginTop: 22, paddingVertical: 14,
    borderRadius: 14, alignItems: "center", justifyContent: "center",
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: "white", fontWeight: "900", fontSize: 14, letterSpacing: 0.4 },

  muted: { color: "rgba(15,23,42,0.65)", fontSize: 13, lineHeight: 19 },
  linkMuted: { color: "rgba(15,23,42,0.55)", fontWeight: "700", fontSize: 12 },
});
