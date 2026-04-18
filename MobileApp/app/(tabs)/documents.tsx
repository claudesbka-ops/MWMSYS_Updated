import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";

type DocRow = { type: string; name: string; url: string; hasFile: boolean };

export default function DocumentsScreen() {
  const api = useApiClient();
  const session = useSession();
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [docType, setDocType] = useState("passport");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ workerId: string; documents: DocRow[] }>("/Api/Worker/Documents");
      setDocs(Array.isArray(res?.documents) ? res.documents : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const upload = async () => {
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ["application/pdf", "image/*"],
      });

      if (picked.canceled) return;
      const asset = picked.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Error", "No file selected");
        return;
      }

      const form = new FormData();
      form.append("docType", docType);
      form.append("file", {
        uri: asset.uri,
        name: asset.name ?? "document",
        type: asset.mimeType ?? "application/octet-stream",
      } as any);

      const url = session.apiBaseUrl.replace(/\/+$/, "") + "/Api/Worker/Documents";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          Accept: "application/json",
        },
        body: form as any,
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");

      await refresh();
      Alert.alert("Uploaded", "Document uploaded");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (type: string) => {
    setBusy(true);
    try {
      await api.delete(`/Api/Worker/Documents?docType=${encodeURIComponent(type)}`);
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Documents</Text>
      <Text style={styles.subtitle}>Passport, permit, insurance and contract files</Text>

      <View style={styles.uploadCard}>
        <Text style={styles.label}>Doc Type</Text>
        <TextInput value={docType} onChangeText={setDocType} style={styles.input} autoCapitalize="none" />
        <View style={styles.row}>
          <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabledBtn]} onPress={upload} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? "Working..." : "Upload"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.refreshBtn, busy && styles.disabledBtn]} onPress={refresh} disabled={busy}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>docType values: passport, permit, insurance, contract, demand_letter</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => d.type}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDesc}>{item.hasFile ? "Available" : "Not uploaded"}</Text>
              {item.hasFile ? <Text style={styles.cardLink}>{item.url}</Text> : null}
              <View style={styles.rowTight}>
                <TouchableOpacity
                  style={[styles.dangerBtn, busy && styles.disabledBtn]}
                  onPress={() => remove(item.type)}
                  disabled={busy}
                >
                  <Text style={styles.dangerText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No documents found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  uploadCard: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  label: { fontSize: 12, fontWeight: "700", opacity: 0.8 },
  input: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", paddingHorizontal: 12, marginTop: 8, color: "inherit" as any },
  row: { marginTop: 12, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  rowTight: { marginTop: 10, flexDirection: "row", gap: 10 },
  primaryBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#2563eb" },
  primaryText: { color: "white", fontWeight: "800" },
  refreshBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  refreshText: { fontWeight: "800", opacity: 0.8 },
  hint: { marginTop: 10, fontSize: 11, opacity: 0.65 },
  disabledBtn: { opacity: 0.6 },
  loadingWrap: { padding: 18 },
  list: { paddingVertical: 14, gap: 10 },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
  },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardDesc: { marginTop: 6, fontSize: 12, opacity: 0.75 },
  cardLink: { marginTop: 8, fontSize: 11, opacity: 0.65 },
  dangerBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(220,38,38,0.12)", borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" },
  dangerText: { fontWeight: "800" },
  emptyWrap: { paddingVertical: 30, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
