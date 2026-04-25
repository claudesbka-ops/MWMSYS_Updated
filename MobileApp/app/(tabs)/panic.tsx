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

import { Text, View } from "react-native";
import { usePanic } from "@/hooks/usePanic";
import { Screen, Card, PrimaryButton, GhostButton } from "@/components/ui";

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
    <Screen
      title="Emergency"
      subtitle="Your alert is reviewed by MWMSYS response team"
      gradient={["#ef4444", "#f97316", "#ec4899"]}
    >
      {panic.hasPendingEmergency && (
        <EmergencyPulseBanner count={panic.pendingCount} onRetry={() => panic.drain()} />
      )}

      <Card>
        <Text style={styles.label}>Describe the issue (optional)</Text>
        <TextInput
          value={desc}
          onChangeText={setDesc}
          style={[styles.input, styles.multiline]}
          multiline
          placeholder="What happened?"
          placeholderTextColor="rgba(15,23,42,0.4)"
          editable={!sending}
        />

        <View style={styles.photoRow}>
          <GhostButton title={photoUri ? "Change photo" : "Attach photo"} onPress={pickPhoto} disabled={sending} />
          {photoUri ? (
            <GhostButton
              title="Remove"
              onPress={() => {
                setPhotoUri("");
                setPhotoMime(null);
                setPhotoName(null);
              }}
              disabled={sending}
            />
          ) : null}
        </View>

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}

        <PrimaryButton
          title={sending ? (syncing ? "Syncing emergency…" : "Sending…") : "Send Panic Alert"}
          loading={sending}
          variant="danger"
          onPress={send}
          style={{ marginTop: 14 }}
        />

        {panic.geoLoading ? (
          <Text style={styles.hint}>Acquiring high-accuracy GPS fix…</Text>
        ) : panic.geoError ? (
          <Text style={styles.hintWarn}>Location unavailable — alert will still send without GPS.</Text>
        ) : null}
      </Card>
    </Screen>
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
  label: { fontSize: 11, fontWeight: '800', color: 'rgba(15,23,42,0.6)', letterSpacing: 0.4, textTransform: 'uppercase' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.15)',
    paddingHorizontal: 14,
    marginTop: 8,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  multiline: { minHeight: 110, paddingTop: 12 },
  photoRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  preview: { marginTop: 12, width: '100%', height: 180, borderRadius: 14 },
  hint: { marginTop: 10, fontSize: 12, color: 'rgba(15,23,42,0.55)' },
  hintWarn: { marginTop: 10, fontSize: 12, color: '#b45309', fontWeight: '700' },
  pulseBanner: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    gap: 12,
  },
  pulseDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#f59e0b' },
  pulseTextWrap: { flex: 1 },
  pulseTitle: { fontSize: 13, fontWeight: '800', color: '#92400e' },
  pulseSubtitle: { marginTop: 2, fontSize: 11, color: '#92400e', opacity: 0.9 },
});
