import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { useHrmsService } from "@/services/hrmsService";
import { GradientBackground, ScreenHeader, PrimaryButton } from "@/components/ui";

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

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (messages.length) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }, [messages.length]);

  return (
    <GradientBackground colors={["#eef2ff", "#f5f3ff", "#fdf2f8"]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.headerWrap}>
            <ScreenHeader
              title="MWMS AI Assistant"
              subtitle="Ask anything about your rights, documents or process"
              gradient={["#0ea5e9", "#6366f1", "#8b5cf6"]}
            />
          </View>

          {loading && messages.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#6366f1" />
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <FontAwesome name="comments-o" size={40} color="rgba(99,102,241,0.4)" />
                  <Text style={styles.emptyTitle}>Start a conversation</Text>
                  <Text style={styles.emptyText}>Type below to ask about leave, salary, documents or emergencies.</Text>
                </View>
              ) : (
                messages.map((item, idx) => {
                  const isUser = item.senderType === "User";
                  return (
                    <View key={idx} style={[styles.row, isUser ? styles.rowUser : styles.rowAi]}>
                      {!isUser && (
                        <LinearGradient colors={["#0ea5e9", "#6366f1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                          <FontAwesome name="magic" size={12} color="white" />
                        </LinearGradient>
                      )}
                      {isUser ? (
                        <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.userBubble]}>
                          <Text style={styles.userBubbleText}>{item.message}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.bubble, styles.aiBubble]}>
                          <Text style={styles.aiBubbleText}>{item.message}</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              style={styles.input}
              placeholder="Type a message…"
              placeholderTextColor="rgba(15,23,42,0.4)"
              autoCapitalize="sentences"
              multiline
            />
            <PrimaryButton title={busy ? "…" : "Send"} loading={busy} onPress={send} style={{ height: 46 }} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 18, paddingTop: 6 },
  list: { padding: 18, paddingBottom: 24, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '92%' },
  rowUser: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  rowAi: { alignSelf: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, maxWidth: '100%' },
  userBubble: { borderBottomRightRadius: 4 },
  aiBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.1)',
  },
  userBubbleText: { color: 'white', fontSize: 14, lineHeight: 20 },
  aiBubbleText: { color: '#0f172a', fontSize: 14, lineHeight: 20 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  emptyText: { fontSize: 13, color: 'rgba(15,23,42,0.6)', textAlign: 'center', paddingHorizontal: 40 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(79,70,229,0.08)',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: 14,
  },
});
