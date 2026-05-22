import { useState, useCallback } from "react";
import { Sparkles, Zap, ShieldCheck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { CopilotChat } from "@/components/copilot/CopilotChat";
import { CopilotInput } from "@/components/copilot/CopilotInput";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
}

const LABOUR_SUGGESTIONS = [
  "Which employer has the most violations?",
  "Show me critical disputes this month",
  "Are there any unusual patterns?",
  "Rank employers by risk level",
  "Give me a compliance overview",
  "Which nationality has the most issues?",
];

export default function LabourCopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      // Build history from last 6 messages
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await apiClient.post("/Api/Copilot/LabourQuery", {
        message,
        history,
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: data.reply,
          toolsUsed: data.toolsUsed,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Show rate limit warning if low
        if (data.rateLimit?.remaining < 5) {
          toast.warning(`${data.rateLimit.remaining} queries remaining this hour`);
        }
      } else {
        toast.error(data.error || "Failed to get response");
      }
    },
    onError: (error: any) => {
      if (error.response?.status === 429) {
        toast.error("Rate limit exceeded. Please try again in an hour.");
      } else if (error.response?.status === 403) {
        toast.error("You don't have permission to use the AI Copilot");
      } else {
        toast.error("AI Copilot is unavailable. Please try again.");
      }
    },
  });

  const handleSend = useCallback((content: string) => {
    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Send to API
    sendMessageMutation.mutate(content);
  }, [messages, sendMessageMutation]);

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Labour Intelligence Copilot</h1>
              <p className="text-sm text-muted-foreground">
                Analyze workforce compliance and systemic risks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 text-xs font-medium">
              <Zap className="w-3 h-3" />
              Beta
            </span>
          </div>
        </div>
      </div>

      {/* Suggestion chips (shown when no messages) */}
      {messages.length === 0 && (
        <div className="px-6 py-4 border-b border-border/50">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-muted-foreground mb-3">
              Try asking:
            </p>
            <div className="flex flex-wrap gap-2">
              {LABOUR_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-muted hover:bg-muted/80 border border-border/50 transition-colors text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat messages */}
      <CopilotChat
        messages={messages}
        isLoading={sendMessageMutation.isPending}
      />

      {/* Input */}
      <CopilotInput
        onSend={handleSend}
        isLoading={sendMessageMutation.isPending}
      />
    </div>
  );
}
