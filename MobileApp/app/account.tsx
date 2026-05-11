import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as ImagePicker from "expo-image-picker";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Card, PrimaryButton, Screen, SectionTitle } from "@/components/ui";

type WorkerFields = {
  name: string; contactNumber: string; address: string; passportNumber: string; email: string; photo: string | null;
};
type EmployerFields = {
  companyName: string; address: string; companyPhone: string; contactPerson: string; contactPersonPhone: string; position: string; email: string; ssmNumber: string;
};
type AgencyFields = {
  agentName: string; organizationName: string; contactNumber: string; icPassport: string; email: string;
};

type RoleProfile =
  | { kind: "worker"; fields: WorkerFields; complete: boolean }
  | { kind: "employer"; fields: EmployerFields; complete: boolean }
  | { kind: "agency"; fields: AgencyFields; complete: boolean };

type AccountProfile = {
  userId: string | null;
  userName: string | null;
  emailId: string | null;
  role: string | null;
  subscription: { planType: string; status: string; endDate: string | null };
  profile: RoleProfile | null;
};

const PLAN_GRADIENT: Record<string, readonly [string, string]> = {
  free: ["#10b981", "#06b6d4"],
  pro: ["#6366f1", "#8b5cf6"],
  enterprise: ["#f59e0b", "#ef4444"],
};

export default function AccountScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const role = profile?.profile?.kind ?? "worker";
  const plan = String(profile?.subscription?.planType ?? "Free").toLowerCase();
  const planGradient = PLAN_GRADIENT[plan] ?? PLAN_GRADIENT.free;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AccountProfile>("/Api/Account/Profile");
      setProfile(res ?? null);
      const f = (res?.profile?.fields ?? {}) as Record<string, string | null>;
      const next: Record<string, string> = {};
      Object.entries(f).forEach(([k, v]) => { if (k !== "photo") next[k] = String(v ?? ""); });
      setFields(next);
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Unable to load profile");
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
      await api.put("/Api/Account/Profile", fields);
      Alert.alert("✅ Saved", "Profile updated");
      await load();
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Unable to save profile");
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("📷 Permission", "Media library permission is required");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    const asset = picked.assets[0];

    setUploading(true);
    try {
      const form = new FormData();
      const filePart = {
        uri: asset.uri,
        name: asset.fileName ?? `photo.${(asset.mimeType ?? "image/jpeg").split("/")[1] ?? "jpg"}`,
        type: asset.mimeType ?? "image/jpeg",
      };
      // React Native's FormData accepts a file-descriptor object at runtime even
      // though the web DOM types don't know about it.
      form.append("photo", filePart as unknown as Blob);
      await api.postForm("/Api/Account/Photo", form);
      Alert.alert("✅ Uploaded", "Profile photo updated");
      await load();
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Unable to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const signOut = async () => {
    Alert.alert("👋 Sign out", "Sign out of your account?", [
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

  const photoUri = useMemo(() => {
    const p = (profile?.profile as any)?.fields?.photo as string | undefined;
    if (!p) return null;
    if (p.startsWith("data:") || p.startsWith("http")) return p;
    return `data:image/jpeg;base64,${p}`;
  }, [profile]);

  const displayName =
    (profile?.profile as any)?.fields?.name ??
    (profile?.profile as any)?.fields?.contactPerson ??
    (profile?.profile as any)?.fields?.companyName ??
    (profile?.profile as any)?.fields?.agentName ??
    profile?.userName ??
    profile?.emailId ??
    "Account";

  return (
    <Screen
      title="👤 Account"
      subtitle="Manage your profile and subscription"
      gradient={["#6366f1", "#8b5cf6", "#ec4899"]}
      refreshing={loading}
      onRefresh={load}
    >
      {/* Identity card */}
      <Card>
        <View style={styles.identityRow}>
          <TouchableOpacity activeOpacity={0.85} onPress={pickPhoto} style={styles.avatarWrap}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImg} />
            ) : (
              <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarImg}>
                <FontAwesome name="user" size={36} color="white" />
              </LinearGradient>
            )}
            <View style={styles.cameraBadge}>
              {uploading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <FontAwesome name="camera" size={11} color="white" />
              )}
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{String(displayName)}</Text>
            {profile?.emailId ? <Text style={styles.email}>{profile.emailId}</Text> : null}
            <View style={styles.roleRow}>
              <View style={styles.rolePill}>
                <FontAwesome name="id-badge" size={10} color="#4f46e5" />
                <Text style={styles.rolePillText}>{String(profile?.role ?? role).toUpperCase()}</Text>
              </View>
              <View style={[styles.planPill, styles.planPillBg]}>
                <LinearGradient colors={planGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
                <FontAwesome name="star" size={10} color="white" />
                <Text style={styles.planPillText}>{(profile?.subscription?.planType ?? "Free").toString()}</Text>
              </View>
            </View>
          </View>
        </View>
      </Card>

      {/* Editable fields */}
      <SectionTitle title="📝 Profile details" />
      {!profile?.profile ? (
        <Card>
          <Text style={styles.muted}>
            ℹ️ No editable profile fields for this role. Contact an administrator to update your details.
          </Text>
        </Card>
      ) : profile.profile.kind === "worker" ? (
        <Card>
          <Field label="Full name" value={fields.name ?? ""} onChange={(v) => setFields({ ...fields, name: v })} testID="name-input" />
          <Field label="Email" value={fields.email ?? ""} onChange={(v) => setFields({ ...fields, email: v })} keyboardType="email-address" />
          <Field label="Contact number" value={fields.contactNumber ?? ""} onChange={(v) => setFields({ ...fields, contactNumber: v })} keyboardType="phone-pad" testID="phone-input" />
          <Field label="Address" value={fields.address ?? ""} onChange={(v) => setFields({ ...fields, address: v })} multiline />
          <Field label="Passport number" value={fields.passportNumber ?? ""} onChange={(v) => setFields({ ...fields, passportNumber: v })} autoCapitalize="characters" />
        </Card>
      ) : profile.profile.kind === "employer" ? (
        <Card>
          <Field label="Company name" value={fields.companyName ?? ""} onChange={(v) => setFields({ ...fields, companyName: v })} />
          <Field label="Company email" value={fields.email ?? ""} onChange={(v) => setFields({ ...fields, email: v })} keyboardType="email-address" />
          <Field label="Company phone" value={fields.companyPhone ?? ""} onChange={(v) => setFields({ ...fields, companyPhone: v })} keyboardType="phone-pad" />
          <Field label="Address" value={fields.address ?? ""} onChange={(v) => setFields({ ...fields, address: v })} multiline />
          <Field label="SSM number" value={fields.ssmNumber ?? ""} onChange={(v) => setFields({ ...fields, ssmNumber: v })} autoCapitalize="characters" />
          <Field label="Contact person" value={fields.contactPerson ?? ""} onChange={(v) => setFields({ ...fields, contactPerson: v })} />
          <Field label="Contact position" value={fields.position ?? ""} onChange={(v) => setFields({ ...fields, position: v })} />
          <Field label="Contact phone" value={fields.contactPersonPhone ?? ""} onChange={(v) => setFields({ ...fields, contactPersonPhone: v })} keyboardType="phone-pad" />
        </Card>
      ) : (
        <Card>
          <Field label="Agent name" value={fields.agentName ?? ""} onChange={(v) => setFields({ ...fields, agentName: v })} />
          <Field label="Organization name" value={fields.organizationName ?? ""} onChange={(v) => setFields({ ...fields, organizationName: v })} />
          <Field label="Email" value={fields.email ?? ""} onChange={(v) => setFields({ ...fields, email: v })} keyboardType="email-address" />
          <Field label="Contact number" value={fields.contactNumber ?? ""} onChange={(v) => setFields({ ...fields, contactNumber: v })} keyboardType="phone-pad" />
          <Field label="IC / Passport" value={fields.icPassport ?? ""} onChange={(v) => setFields({ ...fields, icPassport: v })} autoCapitalize="characters" />
        </Card>
      )}

      {profile?.profile ? (
        <PrimaryButton title={saving ? "⏳ Saving…" : "💾 Save profile"} loading={saving} onPress={save} style={{ marginTop: 18 }} testID="save-profile-btn" />
      ) : null}

      <SectionTitle title="⚙️ Account actions" />
      <Card tight>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7} onPress={() => router.push("/(tabs)/pricing" as any)}>
          <FontAwesome name="credit-card" size={16} color="#4f46e5" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>💎 Manage subscription</Text>
            <Text style={styles.actionSub}>Change plan, view billing details</Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color="rgba(15,23,42,0.3)" />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7} onPress={() => router.push("/(tabs)/settings" as any)}>
          <FontAwesome name="cog" size={16} color="#4f46e5" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>⚙️ Preferences</Text>
            <Text style={styles.actionSub}>Location sharing, API base URL</Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color="rgba(15,23,42,0.3)" />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7} onPress={signOut}>
          <FontAwesome name="sign-out" size={16} color="#ef4444" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: "#ef4444" }]}>🚪 Sign out</Text>
            <Text style={styles.actionSub}>End your current session</Text>
          </View>
        </TouchableOpacity>
      </Card>

      <Text style={styles.back} onPress={() => router.back()}>← Back</Text>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  keyboardType,
  autoCapitalize,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  testID?: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value ?? ""}
        onChangeText={onChange}
        style={[styles.input, multiline ? styles.multiline : null]}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor="rgba(15,23,42,0.4)"
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  identityRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarWrap: { position: "relative" },
  avatarImg: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden", backgroundColor: "rgba(99,102,241,0.15)",
  },
  cameraBadge: {
    position: "absolute", right: 0, bottom: 0,
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#4f46e5", borderWidth: 2, borderColor: "#ffffff",
  },
  name: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  email: { marginTop: 2, fontSize: 12, color: "rgba(15,23,42,0.6)" },
  roleRow: { marginTop: 10, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.12)",
  },
  rolePillText: { fontSize: 10, fontWeight: "900", color: "#4f46e5", letterSpacing: 0.5 },
  planPill: {
    overflow: "hidden",
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
  },
  planPillBg: { backgroundColor: "rgba(15,23,42,0.8)" },
  planPillText: { fontSize: 10, fontWeight: "900", color: "white", letterSpacing: 0.5 },

  label: { marginTop: 12, fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(79,70,229,0.15)",
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 8,
    backgroundColor: "#ffffff", color: "#0f172a",
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  actionTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  actionSub: { marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.55)", fontWeight: "600" },
  divider: { height: 1, backgroundColor: "rgba(15,23,42,0.06)" },

  muted: { color: "rgba(15,23,42,0.65)", fontSize: 13, lineHeight: 19 },
  back: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
