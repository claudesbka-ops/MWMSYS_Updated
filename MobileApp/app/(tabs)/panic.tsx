import React, { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";

import { Text, View } from "@/components/Themed";
import { usePanic } from "@/hooks/usePanic";

export default function PanicScreen() {
  const panic = usePanic();
  const [desc, setDesc] = useState("");
  const [photoUri, setPhotoUri] = useState<string>("");
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo library access to attach a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const a = result.assets?.[0];
      if (a?.uri) {
        setPhotoUri(a.uri);
        setPhotoMime(a.mimeType ?? null);
        setPhotoName(a.fileName ?? null);
      }
    }
  };

  const send = async () => {
    try {
      const res = await panic.trigger({
        description: desc,
        photoUri: photoUri || null,
        photoMime,
        photoName,
      });
      if ((res as any)?.queued) {
        Alert.alert(
          "Saved offline",
          "No signal right now. Your emergency alert is queued and will auto-send when connection returns."
        );
      } else {
        Alert.alert("Sent", "MWMSYS has received your panic alert.");
        setDesc("");
        setPhotoUri("");
        setPhotoMime(null);
        setPhotoName(null);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? e?.message ?? "Failed to send panic");
    }
  };

  const sending = panic.mutation.isPending;
  const syncing = panic.isSyncingEmergency;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Panic</Text>
      <Text style={styles.subtitle}>Emergency alert goes to MWMSYS for validation</Text>

      {panic.hasPendingEmergency && (
        <EmergencyPulseBanner count={panic.pendingCount} onRetry={() => panic.drain()} />
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Describe the issue (optional)</Text>
        <TextInput
          value={desc}
          onChangeText={setDesc}
          style={[styles.input, styles.multiline]}
          multiline
          placeholder="What happened?"
          editable={!sending}
        />

        <View style={styles.photoRow}>
          <TouchableOpacity style={[styles.ghostBtn, sending && styles.disabled]} onPress={pickPhoto} disabled={sending}>
            <Text style={styles.ghostText}>{photoUri ? "Change Photo" : "Attach Photo"}</Text>
          </TouchableOpacity>
          {photoUri ? (
            <TouchableOpacity
              style={[styles.ghostBtn, sending && styles.disabled]}
              onPress={() => {
                setPhotoUri("");
                setPhotoMime(null);
                setPhotoName(null);
              }}
              disabled={sending}
            >
              <Text style={styles.ghostText}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}

        <TouchableOpacity style={[styles.primaryBtn, sending && styles.disabled]} onPress={send} disabled={sending}>
          <Text style={styles.primaryBtnText}>
            {sending ? (syncing ? "Syncing emergency..." : "Sending...") : "Send Panic Alert"}
          </Text>
        </TouchableOpacity>

        {panic.geoLoading ? (
          <Text style={styles.hint}>Acquiring high-accuracy GPS fix...</Text>
        ) : panic.geoError ? (
          <Text style={styles.hintWarn}>Location unavailable — alert will still send without GPS.</Text>
        ) : null}
      </View>
    </View>
  );
}

function EmergencyPulseBanner({ count, onRetry }: { count: number; onRetry: () => void }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.18, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    opacity.value = withRepeat(
      withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [opacity, scale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <TouchableOpacity style={styles.pulseBanner} onPress={onRetry} activeOpacity={0.85}>
      <Animated.View style={[styles.pulseDot, dotStyle]} />
      <View style={styles.pulseTextWrap}>
        <Text style={styles.pulseTitle}>Syncing Emergency Alert</Text>
        <Text style={styles.pulseSubtitle}>
          {count} pending — tap to retry now
        </Text>
      </View>
    </TouchableOpacity>
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
    paddingHorizontal: 12,
    marginTop: 8,
    color: "inherit" as any,
  },
  multiline: { minHeight: 110, paddingTop: 10 },
  photoRow: { marginTop: 12, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  ghostBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  ghostText: { fontWeight: "800", opacity: 0.8 },
  preview: { marginTop: 12, width: "100%", height: 180, borderRadius: 12 },
  primaryBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },
  hint: { marginTop: 10, fontSize: 12, opacity: 0.7 },
  hintWarn: { marginTop: 10, fontSize: 12, color: "#b45309", fontWeight: "600" },
  pulseBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.45)",
    gap: 12,
  },
  pulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#f59e0b",
  },
  pulseTextWrap: { flex: 1 },
  pulseTitle: { fontSize: 13, fontWeight: "800", color: "#92400e" },
  pulseSubtitle: { marginTop: 2, fontSize: 11, color: "#92400e", opacity: 0.9 },
});
