import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TextInput, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";
import { useHrmsService } from "@/services/hrmsService";

type ChatMessage = { senderType: string; message: string; createdOn: string };

export default function ChatScreen() {
  const api = useApiClient();
  const hrms = useHrmsService();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number>(0);
  const [workerId, setWorkerId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");

  const ensureWorkerId = async () => {
    if (workerId) return workerId;
    const me = await hrms.me();
    const wid = (me?.workerId ?? me?.userKey ?? "").toString().trim();
    setWorkerId(wid);
    return wid;
  };

  const ensureSession = async () => {
    if (sessionId > 0) return sessionId;
    setLoading(true);
    try {
      const wid = await ensureWorkerId();
      const numericWid = Number(wid);
      const res = await api.post<{ ChatSessionId: number }>("/Api/Chat/Sessions", {
        WorkerId: Number.isFinite(numericWid) ? numericWid : 0,
      });
      const id = Number((res as any)?.ChatSessionId ?? 0);
      setSessionId(id);
      return id;
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    const id = await ensureSession();
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<any[]>(`/Api/Chat/Messages?ChatSessionId=${id}`);
      const rows = Array.isArray(res) ? res : [];
      setMessages(
        rows.map((m) => ({
          senderType: (m.SenderType ?? "AI").toString(),
          message: (m.Message ?? "").toString(),
          createdOn: (m.CreatedOn ?? new Date().toISOString()).toString(),
        }))
      );
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load chat");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;

    const id = await ensureSession();
    if (!id) return;

    const wid = await ensureWorkerId();
    const numericWid = Number(wid);

    setBusy(true);
    setText("");
    try {
      await api.post("/Api/Chat/Messages", { ChatSessionId: id, SenderType: "User", Message: msg });
      const ai = await api.post<{ reply: string }>("/Api/Chat/AIReply", {
        ChatSessionId: id,
        WorkerId: Number.isFinite(numericWid) ? numericWid : 0,
        Message: msg,
      });
      await refresh();
      if ((ai as any)?.reply) {
        // no-op; refresh shows it
      }
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to send message");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat</Text>
      <Text style={styles.subtitle}>MWMSYS assistant</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(_, idx) => String(idx)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.senderType === "User" ? styles.userBubble : styles.aiBubble]}>
              <Text style={styles.bubbleText}>{item.message}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No messages</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          style={styles.input}
          placeholder="Type a message"
          autoCapitalize="sentences"
        />
        <TouchableOpacity style={[styles.sendBtn, busy && styles.disabled]} onPress={send} disabled={busy}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  loadingWrap: { padding: 18 },
  list: { paddingVertical: 14, gap: 10 },
  bubble: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.18)",
    maxWidth: "92%",
  },
  userBubble: { alignSelf: "flex-end", backgroundColor: "rgba(37,99,235,0.15)" },
  aiBubble: { alignSelf: "flex-start", backgroundColor: "rgba(120,120,120,0.08)" },
  bubbleText: { fontSize: 13, opacity: 0.9 },
  emptyWrap: { paddingVertical: 30, alignItems: "center" },
  emptyText: { opacity: 0.7 },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.25)",
    paddingHorizontal: 12,
    color: "inherit" as any,
  },
  sendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#2563eb",
  },
  sendText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },
});
