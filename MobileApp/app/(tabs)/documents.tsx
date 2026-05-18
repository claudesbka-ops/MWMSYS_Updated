import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Screen, Card, PrimaryButton, GhostButton, SectionTitle } from "@/components/ui";
import { DocumentExtractionModal } from "@/components/DocumentExtractionModal";

type AIExtractedData = {
  full_name?: string;
  document_number?: string;
  expiry_date?: string;
  date_of_birth?: string;
  nationality?: string;
  issuing_country?: string;
};

type AIConfidenceScores = {
  full_name?: number;
  document_number?: number;
  expiry_date?: number;
  date_of_birth?: number;
  nationality?: number;
  issuing_country?: number;
};

type DocRow = {
  type: string;
  name: string;
  url: string;
  hasFile: boolean;
  aiExtractionStatus?: string | null;
  aiExtractedData?: AIExtractedData | null;
  aiConfidenceScores?: AIConfidenceScores | null;
  aiOverallConfidence?: number | null;
  aiNeedsReview?: boolean;
  workerConfirmedAt?: string | null;
  workerCorrectedData?: Record<string, any> | null;
};

const DOC_TYPES: { key: string; label: string; icon: keyof typeof FontAwesome.glyphMap; gradient: readonly [string, string] }[] = [
  { key: "passport", label: "🛫 Passport", icon: "id-card-o", gradient: ["#0ea5e9", "#6366f1"] },
  { key: "permit", label: "🆔 Work Permit", icon: "id-badge", gradient: ["#10b981", "#06b6d4"] },
  { key: "insurance", label: "🛡️ Insurance", icon: "shield", gradient: ["#8b5cf6", "#ec4899"] },
  { key: "contract", label: "📝 Contract", icon: "file-text-o", gradient: ["#f59e0b", "#fb7185"] },
  { key: "demand_letter", label: "✉️ Demand Letter", icon: "envelope", gradient: ["#6366f1", "#a855f7"] },
];

export default function DocumentsScreen() {
  const api = useApiClient();
  const session = useSession();
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [docType, setDocType] = useState<string>("passport");
  const [busy, setBusy] = useState(false);
  const [extractingDoc, setExtractingDoc] = useState<DocRow | null>(null);
  const [isExtractionLoading, setIsExtractionLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ workerId: string; documents: DocRow[] }>("/Api/Worker/Documents");
      setDocs(Array.isArray(res?.documents) ? res.documents : []);
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Failed to load documents");
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
        Alert.alert("⚠️ Error", "No file selected");
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
      
      // Show extraction modal for uploaded document
      if (data?.extractionPending) {
        const uploadedDoc: DocRow = {
          type: docType,
          name: asset.name ?? "document",
          url: data?.url ?? "",
          hasFile: true,
          aiExtractionStatus: null,
        };
        setExtractingDoc(uploadedDoc);
        setIsExtractionLoading(true);
        
        // Poll for extraction completion
        const pollInterval = setInterval(async () => {
          try {
            const pollRes = await api.get<{ workerId: string; documents: DocRow[] }>("/Api/Worker/Documents");
            const pollDocs = Array.isArray(pollRes?.documents) ? pollRes.documents : [];
            const updatedDoc = pollDocs.find((d) => d.type === docType && d.aiExtractionStatus);
            
            if (updatedDoc?.aiExtractionStatus === "completed" || updatedDoc?.aiExtractionStatus === "failed") {
              clearInterval(pollInterval);
              setExtractingDoc(updatedDoc);
              setIsExtractionLoading(false);
            }
          } catch {
            // Continue polling
          }
        }, 2000);
        
        // Stop polling after 30 seconds
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsExtractionLoading(false);
        }, 30000);
      } else {
        Alert.alert("✅ Uploaded", "Your document is saved.");
      }
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.message ?? "Upload failed");
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
      Alert.alert("⚠️ Error", e?.error ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const merged = DOC_TYPES.map((meta) => {
    const existing = docs.find((d) => d.type === meta.key);
    return {
      ...meta,
      hasFile: !!existing?.hasFile,
      name: existing?.name ?? meta.label,
      url: existing?.url ?? "",
      aiNeedsReview: existing?.aiNeedsReview,
    };
  });
  const uploadedCount = merged.filter((m) => m.hasFile).length;

  return (
    <Screen
      title="📄 My Documents"
      subtitle={`📁 ${uploadedCount} of ${DOC_TYPES.length} uploaded`}
      gradient={["#6366f1", "#8b5cf6", "#0ea5e9"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      <Card>
        <Text style={styles.sectionTitle}>📌 Document type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {DOC_TYPES.map((t) => (
            <Pressable key={t.key} onPress={() => setDocType(t.key)} testID={`doc-type-${t.key}`} style={[styles.chip, docType === t.key && styles.chipActive]}>
              {docType === t.key ? (
                <LinearGradient colors={t.gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chipIconActive}>
                  <FontAwesome name={t.icon} size={13} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={styles.chipIcon}>
                  <FontAwesome name={t.icon} size={13} color="rgba(15,23,42,0.55)" />
                </View>
              )}
              <Text style={[styles.chipText, docType === t.key && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.row}>
          <PrimaryButton title={busy ? "⏳ Working…" : "⬆️ Upload file"} loading={busy} onPress={upload} style={{ flex: 1 }} testID="upload-btn" />
          <GhostButton title="🔄 Refresh" onPress={refresh} disabled={busy} />
        </View>
        <Text style={styles.help}>PDF or images up to 10MB. Pick a category above before uploading.</Text>
      </Card>

      <SectionTitle title="📁 Your files" />

      {loading && docs.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : (
        <View style={styles.grid}>
          {merged.map((doc) => (
            <DocumentTile
              key={doc.key}
              icon={doc.icon}
              gradient={doc.gradient}
              label={doc.label}
              hasFile={doc.hasFile}
              aiNeedsReview={doc.aiNeedsReview}
              onPress={
                doc.hasFile
                  ? () =>
                      Alert.alert(doc.label, "Remove this document?", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => remove(doc.key) },
                      ])
                  : () => setDocType(doc.key)
              }
            />
          ))}
        </View>
      )}
      
      <DocumentExtractionModal
        document={extractingDoc}
        isLoading={isExtractionLoading}
        onClose={() => setExtractingDoc(null)}
        onConfirm={async (corrections) => {
          try {
            await api.post("/Api/Worker/Documents/Confirm", { corrections });
            await refresh();
            setExtractingDoc(null);
            Alert.alert("✅ Confirmed", "Document data saved.");
          } catch (e: any) {
            Alert.alert("⚠️ Error", "Failed to save confirmation");
          }
        }}
      />
    </Screen>
  );
}

function DocumentTile({
  icon,
  gradient,
  label,
  hasFile,
  aiNeedsReview,
  onPress,
}: {
  icon: keyof typeof FontAwesome.glyphMap;
  gradient: readonly [string, string];
  label: string;
  hasFile: boolean;
  aiNeedsReview?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <LinearGradient
        colors={(hasFile ? gradient : ["#e2e8f0", "#cbd5e1"]) as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tileIcon}
      >
        <FontAwesome name={icon} size={22} color={hasFile ? "#fff" : "rgba(15,23,42,0.55)"} />
      </LinearGradient>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={[
        styles.tileBadge,
        hasFile ? (aiNeedsReview ? styles.tileBadgeReview : styles.tileBadgeReady) : styles.tileBadgeMissing
      ]}>
        <FontAwesome
          name={hasFile ? (aiNeedsReview ? "warning" : "check-circle") : "exclamation-circle"}
          size={10}
          color={hasFile ? (aiNeedsReview ? "#f59e0b" : "#047857") : "#92400e"}
        />
        <Text style={[
          styles.tileBadgeText,
          hasFile ? (aiNeedsReview ? styles.tileBadgeTextReview : styles.tileBadgeTextReady) : styles.tileBadgeTextMissing
        ]}>
          {hasFile ? (aiNeedsReview ? "⚠️ Review" : "✅ Uploaded") : "⚠️ Missing"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  chipRow: { gap: 8, paddingTop: 10, paddingBottom: 4, paddingRight: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.15)",
    backgroundColor: "#ffffff",
  },
  chipActive: { borderColor: "rgba(79,70,229,0.6)", shadowColor: "#6366f1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3 },
  chipIcon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99,102,241,0.08)" },
  chipIconActive: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  chipText: { fontSize: 13, fontWeight: "700", color: "rgba(15,23,42,0.65)" },
  chipTextActive: { color: "#0f172a" },

  row: { marginTop: 14, flexDirection: "row", gap: 10, alignItems: "stretch" },
  help: { marginTop: 10, fontSize: 11, color: "rgba(15,23,42,0.5)" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47.5%",
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.08)",
    alignItems: "flex-start",
    gap: 10,
  },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  tileBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  tileBadgeReady: { backgroundColor: "rgba(16,185,129,0.14)" },
  tileBadgeMissing: { backgroundColor: "rgba(245,158,11,0.16)" },
  tileBadgeReview: { backgroundColor: "rgba(245,158,11,0.25)" },
  tileBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  tileBadgeTextReady: { color: "#047857" },
  tileBadgeTextMissing: { color: "#92400e" },
  tileBadgeTextReview: { color: "#b45309" },
});
