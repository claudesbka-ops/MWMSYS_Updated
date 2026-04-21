import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient, getAccessToken } from "@/services/apiClient";
import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";

type SenderType = "AI" | "User" | "Agent";

type ChatMessage = {
  id: string;
  senderType: SenderType;
  message: string;
  createdOn: string;
};

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getJwtUserId(): number | null {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const userId = Number(payload?.userId ?? 0);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [workerId] = useState<number>(() => getJwtUserId() ?? 0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sessionStorageKey = useMemo(() => `mwmsys_chat_session_${workerId || "anon"}`,
  [workerId]);

  const isAuthed = useMemo(() => !!getAccessToken(), []);
  const canSend = useMemo(() => text.trim().length > 0 && sessionId != null && sessionId > 0 && isAuthed, [text, sessionId, isAuthed]);

  useEffect(() => {
    if (!open) return;

    if (!getAccessToken()) {
      setSessionId(0);
      setMessages([
        {
          id: crypto.randomUUID(),
          senderType: "AI",
          message: "**Login required**\n\nPlease sign in to use the MWMSYS safety chatbot.",
          createdOn: new Date().toISOString(),
        },
      ]);
      return;
    }

    const loadHistory = async (id: number) => {
      const msgRes = await apiClient.get("/Api/Chat/Messages", { params: { ChatSessionId: id } });
      const serverMessages: any[] = Array.isArray(msgRes.data) ? msgRes.data : [];
      setMessages(
        serverMessages.map((m) => ({
          id: crypto.randomUUID(),
          senderType: (m.SenderType ?? "AI") as SenderType,
          message: (m.Message ?? "").toString(),
          createdOn: (m.CreatedOn ?? new Date().toISOString()).toString(),
        }))
      );
    };

    const ensureSession = async () => {
      let id = sessionId ?? 0;

      if (!id) {
        const existingRaw = localStorage.getItem(sessionStorageKey);
        const existing = existingRaw != null ? Number(existingRaw) : 0;
        if (Number.isFinite(existing) && existing > 0) {
          id = existing;
          setSessionId(existing);
        }
      }

      if (!id) {
        const res = await apiClient.post("/Api/Chat/Sessions", {});
        id = Number(res.data?.ChatSessionId ?? 0);
        setSessionId(id);
        localStorage.setItem(sessionStorageKey, String(id));
      }

      try {
        await loadHistory(id);
      } catch {
        const welcome: ChatMessage = {
          id: crypto.randomUUID(),
          senderType: "AI",
          message: "Hi, I’m MWMSYS assistant. How can I help you today?",
          createdOn: new Date().toISOString(),
        };
        setMessages([welcome]);
        try {
          await apiClient.post("/Api/Chat/Messages", {
            ChatSessionId: id,
            SenderType: "AI",
            Message: welcome.message,
          });
        } catch {
          // ignore
        }
      }
    };

    ensureSession().catch((e: any) => {
      const status = Number(e?.response?.status ?? 0);
      const errMsg = e?.response?.data?.error?.toString?.() ?? "";

      setSessionId(0);

      if (status === 401) {
        setMessages([
          {
            id: crypto.randomUUID(),
            senderType: "AI",
            message: "**Login required**\n\nYour session expired. Please log in again to continue chatting.",
            createdOn: new Date().toISOString(),
          },
        ]);
        return;
      }

      if (status === 501 || /chat tables not installed/i.test(errMsg)) {
        setMessages([
          {
            id: crypto.randomUUID(),
            senderType: "AI",
            message:
              "**Chat storage is not installed**\n\nThe database tables for chat are missing. Please run `Backend/Database/chat_schema.sql` and restart the backend.",
            createdOn: new Date().toISOString(),
          },
        ]);
        return;
      }

      setMessages([
        {
          id: crypto.randomUUID(),
          senderType: "AI",
          message: "**Chat service is unavailable**\n\nPlease try again later.",
          createdOn: new Date().toISOString(),
        },
      ]);
    });
  }, [open, sessionId, sessionStorageKey, workerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    if (!canSend || sessionId == null) return;

    if (sending) return;
    setSending(true);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      senderType: "User",
      message: text.trim(),
      createdOn: new Date().toISOString(),
    };

    setMessages((p) => [...p, userMsg]);
    setText("");

    try {
      await apiClient.post("/Api/Chat/Messages", {
        ChatSessionId: sessionId,
        SenderType: "User",
        Message: userMsg.message,
      });
    } catch {
      // ignore
    }

    let aiText = "";
    try {
      const aiRes = await apiClient.post("/Api/Chat/AIReply", {
        ChatSessionId: sessionId,
        Message: userMsg.message,
      });
      aiText = (aiRes.data?.reply ?? "").toString();
    } catch (e: any) {
      const status = Number(e?.response?.status ?? 0);
      const errMsg = e?.response?.data?.error?.toString?.() ?? "";
      if (status === 403) aiText = "**Access denied**\n\nPlease reopen the chat and try again.";
      else if (status === 500 && /openai_api_key/i.test(errMsg)) aiText = "**AI is not configured**\n\nOPENAI_API_KEY is missing on the server.";
      else if (status === 503) aiText = "**Service unavailable**\n\nPlease try again later.";
      else aiText = "**Unable to respond right now**\n\nPlease try again.";
    } finally {
      setSending(false);
    }

    const aiMsg: ChatMessage = {
      id: crypto.randomUUID(),
      senderType: "AI",
      message: aiText,
      createdOn: new Date().toISOString(),
    };

    setMessages((p) => [...p, aiMsg]);

    // AI message is saved by backend /Api/Chat/AIReply
  };

  const requestHuman = async () => {
    if (sessionId == null) return;
    try {
      await apiClient.post("/Api/Chat/SupportRequests", {
        ChatSessionId: sessionId,
        Reason: "Human handover requested",
      });
    } catch {
      // ignore
    }

    setMessages((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        senderType: "AI",
        message: "A human agent has been notified. Please wait…",
        createdOn: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="w-[360px] h-[480px] bg-card border border-border/60 rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
            <div className="text-sm font-bold">MWMSYS Chat</div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.senderType === "User"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : m.senderType === "Agent"
                      ? "bg-success/15 text-foreground"
                      : "bg-muted text-foreground"
                }`}
              >
                {m.senderType === "User" ? (
                  m.message
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{m.message}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-border/40 space-y-2">
            <Button variant="outline" className="w-full" onClick={requestHuman}>
              Talk to Human
            </Button>

            <div className="flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button onClick={send} disabled={!canSend || sending}>
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!open && (
        <Button className="rounded-full h-14 w-14 p-0 shadow-lg" onClick={() => setOpen(true)}>
          <Bot className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
