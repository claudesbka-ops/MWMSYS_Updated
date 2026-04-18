import React, { useState } from "react";
import { Alert, Image, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

import { Text, View } from "@/components/Themed";
import { useSession } from "@/contexts/SessionContext";

export default function PanicScreen() {
  const session = useSession();
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoUri, setPhotoUri] = useState<string>("");

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
      const uri = result.assets?.[0]?.uri ?? "";
      if (uri) setPhotoUri(uri);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (!locPerm.granted) {
        Alert.alert("Permission required", "Location permission is required to send panic with GPS.");
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos?.coords?.latitude;
      const lng = pos?.coords?.longitude;

      const form = new FormData();
      form.append("Title", "Panic Alert");
      form.append("Description", desc.trim() || "Worker triggered panic button");
      if (typeof lat === "number") form.append("Latitude", String(lat));
      if (typeof lng === "number") form.append("Longitude", String(lng));

      if (photoUri) {
        const filename = photoUri.split("/").pop() || "panic.jpg";
        const ext = filename.split(".").pop()?.toLowerCase();
        const type = ext === "png" ? "image/png" : "image/jpeg";
        form.append("file", { uri: photoUri, name: filename, type } as any);
      }

      const url = session.apiBaseUrl.replace(/\/+$/, "") + "/Api/Panic";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          Accept: "application/json",
          // NOTE: do not set Content-Type for multipart; fetch will set boundary.
        },
        body: form as any,
      });

      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        const msg = data?.error ?? "Failed to send panic";
        throw new Error(msg);
      }

      Alert.alert("Sent", "MWMSYS has received your panic alert.");
      setDesc("");
      setPhotoUri("");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to send panic");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Panic</Text>
      <Text style={styles.subtitle}>Emergency alert goes to MWMSYS for validation</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Describe the issue (optional)</Text>
        <TextInput
          value={desc}
          onChangeText={setDesc}
          style={[styles.input, styles.multiline]}
          multiline
          placeholder="What happened?"
        />

        <View style={styles.photoRow}>
          <TouchableOpacity style={[styles.ghostBtn, busy && styles.disabled]} onPress={pickPhoto} disabled={busy}>
            <Text style={styles.ghostText}>{photoUri ? "Change Photo" : "Attach Photo"}</Text>
          </TouchableOpacity>
          {photoUri ? (
            <TouchableOpacity style={[styles.ghostBtn, busy && styles.disabled]} onPress={() => setPhotoUri("")} disabled={busy}>
              <Text style={styles.ghostText}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}

        <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={send} disabled={busy}>
          <Text style={styles.primaryBtnText}>{busy ? "Sending..." : "Send Panic Alert"}</Text>
        </TouchableOpacity>
      </View>
    </View>
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
});
