import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { io, type Socket } from "socket.io-client";
import * as DocumentPicker from "expo-document-picker";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Card, Screen, SectionTitle } from "@/components/ui";

type BroadcastAttachment = {
  id: number;
  url: string;
  mime: string | null;
  originalName: string | null;
  sizeBytes: number | null;
};

type BroadcastMessage = {
  id: number | null;
  senderRoleId: number;
  senderKey: string | null;
  senderName: string | null;
  message: string;
  target: string;
  createdOn: string;
  attachments?: BroadcastAttachment[];
};

type PendingAttachment = { uri: string; name: string; type: string; size?: number };

const SENDER_ROLES = new Set(["admin", "employer", "agency", "embassy_source", "embassy_destination", "labour"]);

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function dedupeKey(m: BroadcastMessage) {
  return `${m.id ?? ""}|${m.createdOn}|${m.message}`;
}

export default function BroadcastScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? session.claims?.role ?? "worker").toString();
  const canSend = SENDER_ROLES.has(appRole);

  const [rows, setRows] = useState<BroadcastMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const socketUrl = useMemo(() => session.apiBaseUrl.replace(/\/+$/, ""), [session.apiBaseUrl]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ rows: BroadcastMessage[] }>("/Api/Broadcast/Feed?limit=80");
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to load broadcast feed");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!session.token) return;
    const s = io(socketUrl, {
      transports: ["websocket"],
      auth: { token: `Bearer ${session.token}` },
      reconnection: true,
    });
    socketRef.current = s;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onMessage = (payload: any) => {
      const msg: BroadcastMessage = {
        id: payload?.id ?? null,
        senderRoleId: Number(payload?.senderRoleId ?? 0),
        senderKey: payload?.senderKey ?? null,
        senderName: payload?.senderName ?? null,
        message: String(payload?.message ?? ""),
        target: String(payload?.target ?? ""),
        createdOn: String(payload?.createdOn ?? new Date().toISOString()),
      };
      setRows((prev) => {
        const seen = new Set(prev.map(dedupeKey));
        return seen.has(dedupeKey(msg)) ? prev : [msg, ...prev];
      });
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("broadcast_message", onMessage);

    return () => {
      try {
        s.off("connect", onConnect);
        s.off("disconnect", onDisconnect);
        s.off("broadcast_message", onMessage);
        s.disconnect();
      } catch {
        // ignore
      }
      socketRef.current = null;
    };
  }, [session.token, socketUrl]);

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: ["image/*", "application/pdf"],
    });
    if (result.canceled || !result.assets?.length) return;
    const next: PendingAttachment[] = [];
    for (const a of result.assets) {
      if (a.size && a.size > 10 * 1024 * 1024) {
        Alert.alert("Too large", `${a.name ?? "File"} exceeds 10 MB and was skipped`);
        continue;
      }
      next.push({
        uri: a.uri,
        name: a.name ?? "file",
        type: a.mimeType ?? "application/octet-stream",
        size: a.size ?? undefined,
      });
    }
    if (next.length) setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const send = async () => {
    const msg = text.trim();
    if (!msg && files.length === 0) return;
    setSending(true);
    try {
      if (files.length > 0) {
        const form = new FormData();
        form.append("message", msg);
        for (const f of files) {
          const part = { uri: f.uri, name: f.name, type: f.type };
          form.append("files", part as unknown as Blob);
        }
        await api.postForm("/Api/Broadcast/SendMultipart", form);
      } else {
        await api.post("/Api/Broadcast/Send", { message: msg });
      }
      setText("");
      setFiles([]);
      // Optimistic local insert; socket will dedupe by id+createdOn.
      setRows((prev) => [
        {
          id: null,
          senderRoleId: 0,
          senderKey: (session.claims?.userKey as string | undefined) ?? null,
          senderName: ((session.claims?.name as string | undefined) ?? "You") as string | null,
          message: msg,
          target: "ALL",
          createdOn: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to send broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      title="Broadcast"
      subtitle="Announcements and updates scoped by role"
      gradient={["#6366f1", "#8b5cf6", "#ec4899"]}
      refreshing={loading}
      onRefresh={load}
    >
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, connected ? styles.dotLive : styles.dotIdle]} />
        <Text style={styles.statusText}>{connected ? "Live" : "Reconnecting…"}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.statusMeta}>{rows.length} message{rows.length === 1 ? "" : "s"}</Text>
      </View>

      {canSend ? (
        <Card>
          <Text style={styles.label}>Compose announcement</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            style={[styles.input, styles.multiline]}
            placeholder="Type your announcement…"
            placeholderTextColor="rgba(15,23,42,0.4)"
          />

          {files.length > 0 ? (
            <View style={styles.fileList}>
              {files.map((f, idx) => (
                <View key={`${f.name}-${idx}`} style={styles.filePill}>
                  <FontAwesome name={f.type.startsWith("image/") ? "image" : "file-pdf-o"} size={11} color="#4f46e5" />
                  <Text style={styles.filePillText} numberOfLines={1}>{f.name}</Text>
                  <TouchableOpacity onPress={() => removeFile(idx)} hitSlop={10}>
                    <FontAwesome name="times" size={11} color="rgba(15,23,42,0.5)" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.composeActions}>
            <TouchableOpacity
              onPress={pickFiles}
              activeOpacity={0.85}
              disabled={sending}
              style={styles.attachBtn}
            >
              <FontAwesome name="paperclip" size={13} color="#4f46e5" />
              <Text style={styles.attachText}>{files.length === 0 ? "Attach" : `Add more (${files.length})`}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={sending || (!text.trim() && files.length === 0)}
              onPress={send}
              activeOpacity={0.85}
              style={[styles.sendBtn, (sending || (!text.trim() && files.length === 0)) && styles.sendBtnDisabled]}
            >
              <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
              {sending ? <ActivityIndicator color="white" /> : (
                <View style={styles.sendBtnInner}>
                  <FontAwesome name="send" size={13} color="white" />
                  <Text style={styles.sendBtnText}>Broadcast</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}

      <SectionTitle title="Feed" />
      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="bullhorn" size={28} color="rgba(15,23,42,0.25)" />
          <Text style={styles.emptyText}>No announcements yet.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((m, idx) => (
            <Card key={`${m.id ?? "x"}-${m.createdOn}-${idx}`} tight>
              <View style={styles.msgHeader}>
                <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                  <Text style={styles.avatarText}>{(m.senderName ?? "?").slice(0, 1).toUpperCase()}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.senderName} numberOfLines={1}>{m.senderName ?? "Unknown sender"}</Text>
                  <Text style={styles.metaLine}>{m.target ? m.target : "ALL"} · {timeAgo(m.createdOn)}</Text>
                </View>
              </View>
              {m.message ? <Text style={styles.message}>{m.message}</Text> : null}
              {m.attachments && m.attachments.length > 0 ? (
                <View style={styles.attachList}>
                  {m.attachments.map((a) => (
                    <View key={a.id} style={styles.attachChip}>
                      <FontAwesome name={(a.mime ?? "").startsWith("image/") ? "image" : "file-pdf-o"} size={11} color="#4f46e5" />
                      <Text style={styles.attachChipText} numberOfLines={1}>{a.originalName ?? `attachment-${a.id}`}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}

      <Text style={styles.back} onPress={() => router.back()}>Back</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotLive: { backgroundColor: "#10b981" },
  dotIdle: { backgroundColor: "#f59e0b" },
  statusText: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.65)", letterSpacing: 0.4, textTransform: "uppercase" },
  statusMeta: { fontSize: 11, fontWeight: "700", color: "rgba(15,23,42,0.5)" },

  label: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(99,102,241,0.18)",
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 8,
    backgroundColor: "#ffffff", color: "#0f172a",
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },

  composeActions: { marginTop: 14, flexDirection: "row", gap: 10, alignItems: "stretch" },
  attachBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14,
    backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 1, borderColor: "rgba(99,102,241,0.2)",
  },
  attachText: { fontSize: 12, fontWeight: "800", color: "#4f46e5" },

  sendBtn: {
    flex: 1, overflow: "hidden",
    paddingVertical: 12, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  sendBtnText: { color: "white", fontWeight: "900", fontSize: 13 },

  fileList: { marginTop: 12, gap: 6 },
  filePill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: "rgba(99,102,241,0.06)", borderWidth: 1, borderColor: "rgba(99,102,241,0.18)",
  },
  filePillText: { flex: 1, fontSize: 12, fontWeight: "700", color: "#0f172a" },

  attachList: { marginTop: 10, gap: 6 },
  attachChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.08)",
    alignSelf: "flex-start",
  },
  attachChipText: { fontSize: 11, fontWeight: "700", color: "#4f46e5", maxWidth: 220 },

  empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13 },

  msgHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontWeight: "900", fontSize: 13 },
  senderName: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  metaLine: { marginTop: 2, fontSize: 10, fontWeight: "700", color: "rgba(15,23,42,0.55)", letterSpacing: 0.4, textTransform: "uppercase" },
  message: { marginTop: 10, fontSize: 14, color: "#0f172a", lineHeight: 20 },

  back: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
