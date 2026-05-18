import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";

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

type DocumentWithAI = {
  type: string;
  name: string;
  url: string;
  hasFile: boolean;
  aiExtractionStatus?: string | null;
  aiExtractedData?: AIExtractedData | null;
  aiConfidenceScores?: AIConfidenceScores | null;
  aiOverallConfidence?: number | null;
  aiNeedsReview?: boolean;
};

type DocumentExtractionModalProps = {
  document: DocumentWithAI | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (corrections: Record<string, string> | null) => void;
};

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isFinite(d.getTime())) {
      return d.toLocaleDateString();
    }
  } catch {}
  return dateStr;
}

function getConfidenceColor(score: number | undefined): string {
  if (!score) return "#9ca3af";
  if (score >= 80) return "#10b981"; // green
  if (score >= 60) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

export function DocumentExtractionModal({
  document,
  isLoading,
  onClose,
  onConfirm,
}: DocumentExtractionModalProps) {
  const [editing, setEditing] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});

  if (!document) return null;

  const data = document.aiExtractedData || {};
  const scores = document.aiConfidenceScores || {};
  const hasError = document.aiExtractionStatus === "failed";
  const isUnsupported = document.aiExtractionStatus === "unsupported";
  const hasData = !!data.full_name || !!data.document_number || !!data.expiry_date;

  const fields = [
    { key: "full_name", label: "Full Name", value: data.full_name, score: scores.full_name },
    { key: "document_number", label: "Document Number", value: data.document_number, score: scores.document_number },
    { key: "expiry_date", label: "Expiry Date", value: formatDate(data.expiry_date), score: scores.expiry_date, rawValue: data.expiry_date },
    { key: "date_of_birth", label: "Date of Birth", value: formatDate(data.date_of_birth), score: scores.date_of_birth, rawValue: data.date_of_birth },
    { key: "nationality", label: "Nationality", value: data.nationality, score: scores.nationality },
    { key: "issuing_country", label: "Issuing Country", value: data.issuing_country, score: scores.issuing_country },
  ].filter((f) => f.value && f.value !== "—");

  const handleConfirm = () => {
    if (editing && Object.keys(corrections).length > 0) {
      onConfirm(corrections);
    } else {
      onConfirm(null);
    }
    setEditing(false);
    setCorrections({});
  };

  const handleEdit = () => {
    setEditing(true);
    const initialCorrections: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.rawValue) initialCorrections[f.key] = f.rawValue;
      else if (f.value && f.value !== "—") initialCorrections[f.key] = f.value;
    });
    setCorrections(initialCorrections);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={!!document}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={["#6366f1", "#8b5cf6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Text style={styles.headerTitle}>AI Document Extraction</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <FontAwesome name="close" size={20} color="#fff" />
            </Pressable>
          </LinearGradient>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Analyzing document...</Text>
                <Text style={styles.loadingSubtext}>
                  AI is extracting information from your {document.name}
                </Text>
              </View>
            ) : isUnsupported ? (
              <View style={styles.errorContainer}>
                <FontAwesome name="file-text-o" size={48} color="#6b7280" />
                <Text style={styles.errorTitle}>File Type Not Supported</Text>
                <Text style={styles.errorText}>
                  AI extraction is not available for this file type. Please fill in the details manually in your profile.
                </Text>
                <Pressable style={styles.errorButton} onPress={onClose}>
                  <Text style={styles.errorButtonText}>Got it</Text>
                </Pressable>
              </View>
            ) : hasError ? (
              <View style={styles.errorContainer}>
                <FontAwesome name="exclamation-triangle" size={48} color="#f59e0b" />
                <Text style={styles.errorTitle}>AI Extraction Failed</Text>
                <Text style={styles.errorText}>
                  We couldn't automatically extract data from your document. Please fill in the details manually in your profile.
                </Text>
                <Pressable style={styles.errorButton} onPress={onClose}>
                  <Text style={styles.errorButtonText}>Got it</Text>
                </Pressable>
              </View>
            ) : !hasData ? (
              <View style={styles.emptyContainer}>
                <FontAwesome name="file-o" size={48} color="#9ca3af" />
                <Text style={styles.emptyTitle}>No Data Extracted</Text>
                <Text style={styles.emptyText}>
                  No readable information was found in your document. Please verify your document is clear and try again, or fill in details manually.
                </Text>
                <Pressable style={styles.errorButton} onPress={onClose}>
                  <Text style={styles.errorButtonText}>Got it</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.summary}>
                  <Text style={styles.summaryLabel}>Document Type</Text>
                  <Text style={styles.summaryValue}>{document.name}</Text>
                  
                  <View style={styles.confidenceRow}>
                    <Text style={styles.summaryLabel}>AI Confidence</Text>
                    <View style={[
                      styles.confidenceBadge,
                      { backgroundColor: getConfidenceColor(document.aiOverallConfidence) + "20" }
                    ]}>
                      <FontAwesome 
                        name={document.aiNeedsReview ? "exclamation-circle" : "check-circle"} 
                        size={12} 
                        color={getConfidenceColor(document.aiOverallConfidence)} 
                      />
                      <Text style={[
                        styles.confidenceText,
                        { color: getConfidenceColor(document.aiOverallConfidence) }
                      ]}>
                        {document.aiOverallConfidence || 0}%
                        {document.aiNeedsReview ? " (Needs Review)" : ""}
                      </Text>
                    </View>
                  </View>
                </View>

                {document.aiNeedsReview && !editing && (
                  <View style={styles.reviewBanner}>
                    <FontAwesome name="exclamation-triangle" size={16} color="#f59e0b" />
                    <Text style={styles.reviewText}>
                      Some fields have low confidence. Please review and correct if needed.
                    </Text>
                  </View>
                )}

                <Text style={styles.sectionTitle}>Extracted Information</Text>

                {fields.map((field) => {
                  const score = field.score || 0;
                  const needsReview = score < 60;
                  const isCorrected = editing && corrections[field.key] !== undefined;

                  return (
                    <View key={field.key} style={styles.field}>
                      <View style={styles.fieldHeader}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        {!editing && (
                          <View style={[
                            styles.scoreBadge,
                            { backgroundColor: getConfidenceColor(score) + "20" }
                          ]}>
                            <Text style={[
                              styles.scoreText,
                              { color: getConfidenceColor(score) }
                            ]}>
                              {score}%
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      {editing ? (
                        <TextInput
                          style={[
                            styles.input,
                            isCorrected && styles.inputModified
                          ]}
                          value={corrections[field.key] || ""}
                          onChangeText={(text) =>
                            setCorrections((prev) => ({ ...prev, [field.key]: text }))
                          }
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                      ) : (
                        <View style={[
                          styles.valueContainer,
                          needsReview && styles.valueNeedsReview
                        ]}>
                          <Text style={styles.fieldValue}>{field.value}</Text>
                          {needsReview && (
                            <FontAwesome name="warning" size={14} color="#f59e0b" />
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}

                <View style={styles.actions}>
                  {editing ? (
                    <>
                      <Pressable style={styles.saveButton} onPress={handleConfirm}>
                        <LinearGradient
                          colors={["#10b981", "#059669"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.gradientButton}
                        >
                          <FontAwesome name="check" size={16} color="#fff" />
                          <Text style={styles.buttonText}>Save Corrections</Text>
                        </LinearGradient>
                      </Pressable>
                      <Pressable
                        style={styles.cancelButton}
                        onPress={() => {
                          setEditing(false);
                          setCorrections({});
                        }}
                      >
                        <Text style={styles.cancelText}>Cancel</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                        <LinearGradient
                          colors={["#6366f1", "#8b5cf6"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.gradientButton}
                        >
                          <FontAwesome name="check-circle" size={16} color="#fff" />
                          <Text style={styles.buttonText}>
                            {document.aiNeedsReview ? "Confirm with Review" : "Confirm Correct"}
                          </Text>
                        </LinearGradient>
                      </Pressable>
                      <Pressable style={styles.editButton} onPress={handleEdit}>
                        <FontAwesome name="edit" size={16} color="#6366f1" />
                        <Text style={styles.editText}>Edit Data</Text>
                      </Pressable>
                    </>
                  )}
                </View>

                <Text style={styles.disclaimer}>
                  AI-extracted data may contain errors. Always verify important information before confirming.
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    maxHeight: 600,
  },
  contentInner: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#92400e",
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  errorButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4b5563",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  summary: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  confidenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: "600",
  },
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  reviewText: {
    flex: 1,
    fontSize: 13,
    color: "#92400e",
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  field: {
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  scoreBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: "600",
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 12,
  },
  valueNeedsReview: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  fieldValue: {
    fontSize: 16,
    color: "#1f2937",
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#1f2937",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  inputModified: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  confirmButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  saveButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  gradientButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
  },
  editText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366f1",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6b7280",
  },
  disclaimer: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 18,
  },
});
