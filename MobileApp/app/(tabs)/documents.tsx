import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Screen, Card, PrimaryButton, GhostButton, SectionTitle, ListItemCard } from "@/components/ui";

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
    <Screen
      title="My Documents"
      subtitle="Passport, permit, insurance & contract files"
      gradient={["#6366f1", "#8b5cf6", "#0ea5e9"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      <Card>
        <Text style={styles.label}>Document type</Text>
        <TextInput
          value={docType}
          onChangeText={setDocType}
          placeholder="passport, permit, insurance, contract, demand_letter"
          placeholderTextColor="rgba(15,23,42,0.4)"
          style={styles.input}
          autoCapitalize="none"
        />
        <View style={styles.row}>
          <PrimaryButton title={busy ? "Working…" : "Upload file"} loading={busy} onPress={upload} style={{ flex: 1 }} />
          <GhostButton title="Refresh" onPress={refresh} disabled={busy} />
        </View>
      </Card>

      <SectionTitle title={`Files (${docs.length})`} />

      {loading && docs.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : docs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No documents uploaded yet.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {docs.map((item) => (
            <ListItemCard
              key={item.type}
              title={item.name}
              subtitle={item.hasFile ? "Available" : "Not uploaded"}
              meta={item.hasFile ? item.url : undefined}
              icon={item.hasFile ? "file-text" : "file-o"}
              iconGradient={item.hasFile ? ["#10b981", "#06b6d4"] : ["#94a3b8", "#64748b"]}
              badge={item.hasFile ? { label: "Ready", tone: "emerald" } : { label: "Missing", tone: "slate" }}
              onPress={item.hasFile ? () => remove(item.type) : undefined}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '800', color: 'rgba(15,23,42,0.6)', letterSpacing: 0.4, textTransform: 'uppercase' },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.15)',
    paddingHorizontal: 14,
    marginTop: 8,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  row: { marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: 'rgba(15,23,42,0.55)', fontSize: 13 },
});
