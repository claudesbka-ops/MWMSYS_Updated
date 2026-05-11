import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as DocumentPicker from "expo-document-picker";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Card, PrimaryButton, Screen, SectionTitle } from "@/components/ui";

type DisputeStatus = "Pending" | "Accepted" | "Rejected";

type Dispute = {
  id: number;
  workerId: string;
  employerId: string;
  workerName: string | null;
  employerName: string | null;
  disputeMonth: string;
  expectedAmount: number;
  receivedAmount: number;
  description: string;
  hasProof: boolean;
  status: DisputeStatus;
  employerComment: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

const STATUS_FILTERS: Array<{ key: "All" | DisputeStatus; label: string }> = [
  { key: "All", label: "📜 All" },
  { key: "Pending", label: "⏳ Pending" },
  { key: "Accepted", label: "✅ Accepted" },
  { key: "Rejected", label: "❌ Rejected" },
];

export default function DisputesScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? session.claims?.role ?? "worker").toString();

  const isWorker = appRole === "worker";
  // Anyone non-worker can *view* disputes; only admin + employer can *act* on
  // them (matches the backend role gate on /Api/Dispute/Review).
  const isViewer = appRole === "employer" || appRole === "agency" || appRole === "admin" || appRole === "labour";
  const canReview = appRole === "employer" || appRole === "admin";

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Dispute[]>([]);
  const [statusFilter, setStatusFilter] = useState<"All" | DisputeStatus>("Pending");

  // Worker submission state
  const [month, setMonth] = useState("");
  const [expected, setExpected] = useState("");
  const [received, setReceived] = useState("");
  const [description, setDescription] = useState("");
  const [proof, setProof] = useState<{ uri: string; name: string; type: string; size?: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reviewer state
  const [busyId, setBusyId] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<number, string>>({});

  const loadEndpoint = useMemo(() => {
    if (isWorker) return "/Api/Dispute/MyDisputes";
    // Employer is the only role with a personal inbox; agency, labour and
    // admin all read /All (which the backend scopes for them).
    if (appRole === "employer") return "/Api/Dispute/Incoming";
    return "/Api/Dispute/All";
  }, [isWorker, appRole]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Dispute[]>(loadEndpoint);
      setItems(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Unable to load disputes");
    } finally {
      setLoading(false);
    }
  }, [api, loadEndpoint]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === "All") return items;
    return items.filter((d) => d.status === statusFilter);
  }, [items, statusFilter]);

  const pickProof = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: ["image/*", "application/pdf"],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    if (a.size && a.size > 5 * 1024 * 1024) {
      Alert.alert("📁 Too large", "Proof file must be 5 MB or smaller");
      return;
    }
    setProof({
      uri: a.uri,
      name: a.name ?? "proof",
      type: a.mimeType ?? "application/octet-stream",
      size: a.size ?? undefined,
    });
  };

  const submit = async () => {
    const expectedNum = Number(expected);
    const receivedNum = Number(received);
    if (!month.trim()) return Alert.alert("📅 Missing", "Enter the dispute month");
    if (!Number.isFinite(expectedNum) || !Number.isFinite(receivedNum)) {
      return Alert.alert("💰 Missing", "Amounts must be valid numbers");
    }
    if (!description.trim()) return Alert.alert("📝 Missing", "Describe the dispute");

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("disputeMonth", month.trim());
      form.append("expectedAmount", String(expectedNum));
      form.append("receivedAmount", String(receivedNum));
      form.append("description", description.trim());
      if (proof) {
        const filePart = { uri: proof.uri, name: proof.name, type: proof.type };
        form.append("proof", filePart as unknown as Blob);
      }
      await api.postForm("/Api/Dispute/Submit", form);
      setMonth("");
      setExpected("");
      setReceived("");
      setDescription("");
      setProof(null);
      Alert.alert("✅ Submitted", "Dispute sent for review");
      await load();
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Unable to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const review = async (d: Dispute, status: "Accepted" | "Rejected") => {
    setBusyId(d.id);
    try {
      await api.put("/Api/Dispute/Review", {
        id: d.id,
        status,
        employerComment: commentDraft[d.id] ?? "",
      });
      setItems((prev) => prev.map((x) => (x.id === d.id ? { ...x, status, employerComment: commentDraft[d.id] ?? x.employerComment } : x)));
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Unable to save decision");
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = items.filter((d) => d.status === "Pending").length;
  const acceptedCount = items.filter((d) => d.status === "Accepted").length;

  if (!isWorker && !isViewer) {
    return (
      <Screen title="⚖️ Disputes" subtitle="Not available for this role" gradient={["#f59e0b", "#ef4444"]}>
        <Card>
          <Text style={styles.muted}>ℹ️ Salary disputes are only visible to workers, employers, agencies, the Labour Department and admins.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="⚖️ Disputes"
      subtitle={isWorker ? "📝 Submit and track salary disputes" : canReview ? "🔍 Review salary disputes from workers" : "👀 View salary disputes"}
      gradient={["#f59e0b", "#ef4444", "#a855f7"]}
      refreshing={loading}
      onRefresh={load}
    >
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>⏳ Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{acceptedCount}</Text>
          <Text style={styles.statLabel}>✅ Accepted</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{items.length}</Text>
          <Text style={styles.statLabel}>📊 Total</Text>
        </View>
      </View>

      {isWorker ? (
        <>
          <SectionTitle title="📝 Submit a salary dispute" />
          <Card>
            <Text style={styles.label}>Month</Text>
            <TextInput
              value={month}
              onChangeText={setMonth}
              style={styles.input}
              placeholder="e.g. 2025-01 or January 2025"
              placeholderTextColor="rgba(15,23,42,0.4)"
              testID="dispute-month"
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Expected (RM)</Text>
                <TextInput value={expected} onChangeText={setExpected} keyboardType="decimal-pad" style={styles.input} testID="dispute-amount" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Received (RM)</Text>
                <TextInput value={received} onChangeText={setReceived} keyboardType="decimal-pad" style={styles.input} testID="dispute-received" />
              </View>
            </View>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              style={[styles.input, styles.multiline]}
              placeholder="Describe the issue clearly so it can be routed properly"
              placeholderTextColor="rgba(15,23,42,0.4)"
              testID="dispute-description"
            />

            <TouchableOpacity onPress={pickProof} activeOpacity={0.85} style={styles.proofPicker} testID="attach-proof-btn">
              <FontAwesome name="paperclip" size={14} color="#4f46e5" />
              <Text style={styles.proofText} numberOfLines={1}>
                {proof ? `📎 ${proof.name}` : "📎 Attach proof (optional, ≤5 MB)"}
              </Text>
              {proof ? (
                <TouchableOpacity onPress={() => setProof(null)} hitSlop={10}>
                  <FontAwesome name="times" size={12} color="rgba(15,23,42,0.5)" />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>

            <PrimaryButton
              title={submitting ? "⏳ Submitting…" : "📤 Submit dispute"}
              loading={submitting}
              onPress={submit}
              style={{ marginTop: 16 }}
              testID="submit-dispute-btn"
            />
          </Card>
        </>
      ) : null}

      {/* Status filter */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((s) => {
          const active = statusFilter === s.key;
          return (
            <TouchableOpacity key={s.key} activeOpacity={0.85} onPress={() => setStatusFilter(s.key)} style={[styles.filter, active && styles.filterActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionTitle title={`📂 ${filtered.length} ${filtered.length === 1 ? "dispute" : "disputes"}`} />

      {loading && items.length === 0 ? (
        <ActivityIndicator color="#f59e0b" />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>🙌 No disputes for this filter.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((d) => (
            <DisputeCard
              key={d.id}
              d={d}
              isReviewer={canReview}
              isWorker={isWorker}
              busy={busyId === d.id}
              comment={commentDraft[d.id] ?? ""}
              onChangeComment={(v) => setCommentDraft((prev) => ({ ...prev, [d.id]: v }))}
              onReview={(status) => review(d, status)}
            />
          ))}
        </View>
      )}

      <Text style={styles.back} onPress={() => router.back()}>← Back</Text>
    </Screen>
  );
}

function StatusPill({ status }: { status: DisputeStatus }) {
  const lower = status.toLowerCase();
  const style = lower === "accepted" ? styles.statusAccepted : lower === "rejected" ? styles.statusRejected : styles.statusPending;
  const icon: React.ComponentProps<typeof FontAwesome>["name"] =
    lower === "accepted" ? "check-circle" : lower === "rejected" ? "times-circle" : "clock-o";
  return (
    <View style={[styles.statusPill, style]}>
      <FontAwesome name={icon} size={10} color="#0f172a" />
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

function DisputeCard({
  d,
  isReviewer,
  isWorker,
  busy,
  comment,
  onChangeComment,
  onReview,
}: {
  d: Dispute;
  isReviewer: boolean;
  isWorker: boolean;
  busy: boolean;
  comment: string;
  onChangeComment: (v: string) => void;
  onReview: (status: "Accepted" | "Rejected") => void;
}) {
  const diff = (d.expectedAmount ?? 0) - (d.receivedAmount ?? 0);
  return (
    <Card tight>
      <View style={styles.cardHeader}>
        <LinearGradient colors={["#f59e0b", "#ef4444"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBadge}>
          <FontAwesome name="balance-scale" size={14} color="white" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{d.workerName ?? d.workerId} · {d.disputeMonth}</Text>
          <Text style={styles.cardSub}>{d.employerName ?? d.employerId}</Text>
        </View>
        <StatusPill status={d.status} />
      </View>

      <View style={styles.amountRow}>
        <View style={styles.amountCol}>
          <Text style={styles.amountLabel}>Expected</Text>
          <Text style={styles.amountValue}>RM {Number(d.expectedAmount ?? 0).toFixed(2)}</Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.amountLabel}>Received</Text>
          <Text style={styles.amountValue}>RM {Number(d.receivedAmount ?? 0).toFixed(2)}</Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.amountLabel}>Shortfall</Text>
          <Text style={[styles.amountValue, diff > 0 ? { color: "#ef4444" } : null]}>RM {diff.toFixed(2)}</Text>
        </View>
      </View>

      {d.description ? <Text style={styles.description}>{d.description}</Text> : null}

      {d.hasProof ? (
        <View style={styles.proofTag}>
          <FontAwesome name="paperclip" size={10} color="#4f46e5" />
          <Text style={styles.proofTagText}>📎 Proof attached</Text>
        </View>
      ) : null}

      {d.employerComment ? (
        <View style={styles.commentBox}>
          <Text style={styles.commentLabel}>Reviewer comment</Text>
          <Text style={styles.commentText}>{d.employerComment}</Text>
        </View>
      ) : null}

      {/* Submitted/reviewed meta */}
      <View style={styles.metaRow}>
        {d.submittedAt ? <Text style={styles.metaText}>Submitted: {String(d.submittedAt).slice(0, 10)}</Text> : null}
        {d.reviewedAt ? <Text style={styles.metaText}>Reviewed: {String(d.reviewedAt).slice(0, 10)}</Text> : null}
      </View>

      {isReviewer && d.status === "Pending" ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>Comment (optional)</Text>
          <TextInput
            value={comment}
            onChangeText={onChangeComment}
            multiline
            style={[styles.input, styles.multiline]}
            placeholder="Add context for the worker"
            placeholderTextColor="rgba(15,23,42,0.4)"
          />
          <View style={styles.decisionRow}>
            <TouchableOpacity disabled={busy} onPress={() => onReview("Rejected")} style={[styles.rejectBtn, busy && styles.btnDisabled]} testID="reject-dispute-btn">
              <Text style={styles.rejectText}>❌ Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={() => onReview("Accepted")} style={[styles.approveBtn, busy && styles.btnDisabled]} testID="accept-dispute-btn">
              {busy ? <ActivityIndicator color="white" /> : <Text style={styles.approveText}>✅ Accept</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {isWorker && d.status !== "Pending" && d.employerComment == null ? (
        <Text style={[styles.metaText, { marginTop: 8 }]}>The reviewer left no comment.</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: { color: "rgba(15,23,42,0.65)", fontSize: 13, lineHeight: 19 },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(245,158,11,0.18)",
    shadowColor: "#f59e0b", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  statValue: { fontSize: 26, fontWeight: "900", color: "#0f172a" },
  statLabel: { marginTop: 2, fontSize: 11, fontWeight: "700", color: "rgba(15,23,42,0.55)", letterSpacing: 0.3, textTransform: "uppercase" },

  label: { marginTop: 12, fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(245,158,11,0.2)",
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 8,
    backgroundColor: "#ffffff", color: "#0f172a",
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },

  proofPicker: {
    marginTop: 14,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(79,70,229,0.4)",
    backgroundColor: "rgba(79,70,229,0.04)",
  },
  proofText: { flex: 1, fontSize: 12, fontWeight: "700", color: "#4f46e5" },

  filterRow: { marginTop: 16, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  filter: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)",
  },
  filterActive: { backgroundColor: "#f59e0b", borderColor: "#f59e0b" },
  filterText: { fontSize: 12, fontWeight: "700", color: "rgba(15,23,42,0.65)" },
  filterTextActive: { color: "white" },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13 },

  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBadge: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  cardSub: { marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.6)", fontWeight: "600" },

  amountRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  amountCol: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.06)" },
  amountLabel: { fontSize: 10, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.3, textTransform: "uppercase" },
  amountValue: { marginTop: 4, fontSize: 13, fontWeight: "900", color: "#0f172a" },

  description: { marginTop: 12, fontSize: 13, color: "rgba(15,23,42,0.75)", lineHeight: 18 },

  proofTag: {
    alignSelf: "flex-start",
    marginTop: 10,
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: "rgba(79,70,229,0.1)",
  },
  proofTagText: { fontSize: 10, fontWeight: "800", color: "#4f46e5", letterSpacing: 0.3 },

  commentBox: {
    marginTop: 12, padding: 12, borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.04)", borderLeftWidth: 3, borderLeftColor: "#4f46e5",
  },
  commentLabel: { fontSize: 10, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.3, textTransform: "uppercase" },
  commentText: { marginTop: 4, fontSize: 13, color: "#0f172a", lineHeight: 18 },

  metaRow: { marginTop: 10, flexDirection: "row", gap: 14, flexWrap: "wrap" },
  metaText: { fontSize: 11, color: "rgba(15,23,42,0.55)", fontWeight: "600" },

  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPending: { backgroundColor: "rgba(245,158,11,0.16)" },
  statusAccepted: { backgroundColor: "rgba(16,185,129,0.16)" },
  statusRejected: { backgroundColor: "rgba(239,68,68,0.16)" },
  statusText: { fontSize: 10, fontWeight: "900", color: "#0f172a", letterSpacing: 0.3, textTransform: "uppercase" },

  decisionRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  approveBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "#10b981", alignItems: "center", justifyContent: "center",
  },
  approveText: { color: "white", fontWeight: "900", fontSize: 13 },
  rejectBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "#ffffff",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", alignItems: "center", justifyContent: "center",
  },
  rejectText: { color: "#ef4444", fontWeight: "900", fontSize: 13 },
  btnDisabled: { opacity: 0.6 },

  back: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
