import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { useHrmsService } from "@/services/hrmsService";
import { GradientBackground, ScreenHeader } from "@/components/ui";

type ChatMessage = { senderType: string; message: string; createdOn: string };

const STARTER_PROMPTS = [
  "🌴 How do I apply for leave?",
  "📄 What documents do I need?",
  "💰 My salary is delayed — what should I do?",
  "🚨 How do I report an emergency?",
  "🔄 Can I switch employers?",
];

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
      Alert.alert("⚠️ Error", e?.error ?? "Failed to load chat");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const sendMessage = async (msg: string) => {
    msg = msg.trim();
    if (!msg) return;

    const id = await ensureSession();
    if (!id) return;
    const wid = await ensureWorkerId();
    const numericWid = Number(wid);

    setBusy(true);
    setText("");
    try {
      await api.post("/Api/Chat/Messages", { ChatSessionId: id, SenderType: "User", Message: msg });
      await api.post<{ reply: string }>("/Api/Chat/AIReply", {
        ChatSessionId: id,
        WorkerId: Number.isFinite(numericWid) ? numericWid : 0,
        Message: msg,
      });
      await refresh();
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Failed to send message");
    } finally {
      setBusy(false);
    }
  };

  const send = () => sendMessage(text);

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
              title="🤖 MWMS AI Assistant"
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
                  <LinearGradient colors={["#0ea5e9", "#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyAvatar}>
                    <FontAwesome name="magic" size={24} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>👋 Hi! I'm MWMS AI</Text>
                  <Text style={styles.emptyText}>Ask me anything about your rights, documents, salary or emergencies.</Text>
                  <View style={styles.promptList}>
                    {STARTER_PROMPTS.map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => sendMessage(p)}
                        style={styles.promptChip}
                        disabled={busy}
                      >
                        <FontAwesome name="lightbulb-o" size={12} color="#4f46e5" />
                        <Text style={styles.promptText}>{p}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                messages.map((item, idx) => {
                  const isUser = item.senderType === "User";
                  const ts = formatTime(item.createdOn);
                  return (
                    <View key={idx} style={[styles.row, isUser ? styles.rowUser : styles.rowAi]}>
                      {!isUser && (
                        <LinearGradient colors={["#0ea5e9", "#6366f1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                          <FontAwesome name="magic" size={12} color="white" />
                        </LinearGradient>
                      )}
                      <View style={isUser ? styles.bubbleColUser : styles.bubbleColAi}>
                        {isUser ? (
                          <LinearGradient colors={["#6366f1", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.userBubble]}>
                            <Text style={styles.userBubbleText}>{item.message}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={[styles.bubble, styles.aiBubble]}>
                            <Text style={styles.aiBubbleText}>{item.message}</Text>
                          </View>
                        )}
                        {ts ? <Text style={[styles.timestamp, isUser && styles.timestampUser]}>{ts}</Text> : null}
                      </View>
                    </View>
                  );
                })
              )}
              {busy && messages.length > 0 && (
                <View style={[styles.row, styles.rowAi]}>
                  <LinearGradient colors={["#0ea5e9", "#6366f1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                    <FontAwesome name="magic" size={12} color="white" />
                  </LinearGradient>
                  <View style={[styles.bubble, styles.aiBubble]}>
                    <Text style={styles.aiBubbleText}>💡 Thinking…</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              style={styles.input}
              placeholder="✍️ Type a message…"
              placeholderTextColor="rgba(15,23,42,0.4)"
              autoCapitalize="sentences"
              multiline
            />
            <TouchableOpacity onPress={send} disabled={busy || !text.trim()} activeOpacity={0.85}>
              <LinearGradient
                colors={text.trim() ? ["#6366f1", "#8b5cf6"] : ["#cbd5e1", "#94a3b8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtn}
              >
                <FontAwesome name={busy ? "circle-o-notch" : "paper-plane"} size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
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
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, gap: 10 },
  emptyAvatar: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6 },
  emptyTitle: { marginTop: 6, fontSize: 18, fontWeight: '900', color: '#0f172a' },
  emptyText: { fontSize: 13, color: 'rgba(15,23,42,0.6)', textAlign: 'center', paddingHorizontal: 30 },
  promptList: { marginTop: 14, gap: 8, alignSelf: 'stretch' },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.15)',
  },
  promptText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0f172a' },
  bubbleColUser: { alignItems: 'flex-end', maxWidth: '82%' },
  bubbleColAi: { alignItems: 'flex-start', maxWidth: '82%' },
  timestamp: { marginTop: 4, fontSize: 10, fontWeight: '700', color: 'rgba(15,23,42,0.4)' },
  timestampUser: { color: 'rgba(15,23,42,0.4)' },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
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

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
