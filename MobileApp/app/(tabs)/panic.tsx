import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";

import { Text, View } from "react-native";
import { usePanic } from "@/hooks/usePanic";
import { Screen, Card, GhostButton } from "@/components/ui";

export default function PanicScreen() {
  const panic = usePanic();
  const [desc, setDesc] = useState("");
  const [photoUri, setPhotoUri] = useState<string>("");
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("📷 Permission required", "Please allow photo library access to attach a photo.");
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
          "📥 Saved offline",
          "No signal right now. Your emergency alert is queued and will auto-send when connection returns."
        );
      } else {
        Alert.alert("✅ Sent", "MWMSYS has received your panic alert.");
        setDesc("");
        setPhotoUri("");
        setPhotoMime(null);
        setPhotoName(null);
      }
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? e?.message ?? "Failed to send panic");
    }
  };

  const sending = panic.mutation.isPending;
  const syncing = panic.isSyncingEmergency;

  return (
    <Screen
      title="🚨 Emergency"
      subtitle="Your alert is reviewed by MWMSYS response team"
      gradient={["#ef4444", "#f97316", "#ec4899"]}
    >
      {panic.hasPendingEmergency && (
        <EmergencyPulseBanner count={panic.pendingCount} onRetry={() => panic.drain()} />
      )}

      <BigPanicButton sending={sending} syncing={syncing} onPress={send} />

      <Card style={{ marginTop: 14 } as any}>
        <Text style={styles.label}>📝 Describe the issue (optional)</Text>
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
          <GhostButton title={photoUri ? "🖼️ Change photo" : "📎 Attach photo"} onPress={pickPhoto} disabled={sending} />
          {photoUri ? (
            <GhostButton
              title="🗑️ Remove"
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

        {panic.geoLoading ? (
          <Text style={styles.hint}>📡 Acquiring high-accuracy GPS fix…</Text>
        ) : panic.geoError ? (
          <Text style={styles.hintWarn}>⚠️ Location unavailable — alert will still send without GPS.</Text>
        ) : null}
      </Card>
    </Screen>
  );
}

function BigPanicButton({
  sending,
  syncing,
  onPress,
}: {
  sending: boolean;
  syncing: boolean;
  onPress: () => void;
}) {
  const ring = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    ring.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    return () => cancelAnimation(ring);
  }, [ring]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ring.value * 0.55 }],
    opacity: 0.5 * (1 - ring.value),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ((ring.value + 0.5) % 1) * 0.55 }],
    opacity: 0.35 * (1 - ((ring.value + 0.5) % 1)),
  }));
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const label = sending ? (syncing ? "☁️ SYNCING…" : "📤 SENDING…") : "🚨 TAP TO SEND";

  return (
    <View style={bigStyles.wrap}>
      <View style={bigStyles.center}>
        <Animated.View style={[bigStyles.ring, ringStyle]} />
        <Animated.View style={[bigStyles.ring, ring2Style]} />
        <Pressable
          onPress={onPress}
          disabled={sending}
          onPressIn={() => {
            press.value = withTiming(0.95, { duration: 80 });
          }}
          onPressOut={() => {
            press.value = withTiming(1, { duration: 120 });
          }}
          accessibilityRole="button"
          accessibilityLabel="Send panic alert"
          hitSlop={20}
        >
          <Animated.View style={buttonStyle}>
            <LinearGradient
              colors={["#ef4444", "#dc2626", "#b91c1c"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={bigStyles.button}
            >
              <FontAwesome name="exclamation-triangle" size={56} color="#ffffff" />
              <Text style={bigStyles.buttonText}>{label}</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </View>
      <Text style={bigStyles.help}>📍 One tap sends your location and any details below.</Text>
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
        <Text style={styles.pulseTitle}>☁️ Syncing Emergency Alert</Text>
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

const bigStyles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 28,
    backgroundColor: 'rgba(254,226,226,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
    alignItems: 'center',
  },
  center: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(239,68,68,0.45)',
  },
  button: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#b91c1c',
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  buttonText: { marginTop: 10, fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  help: { marginTop: 12, fontSize: 12, color: 'rgba(15,23,42,0.6)', fontWeight: '600', textAlign: 'center' },
});
