import { Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopilotMessageProps {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
}

/**
 * Simple markdown-like formatting:
 * - **bold** text → <strong>
 * - Numbered lists (1. 2. 3.) → <ol><li>
 * - Bulleted lists (- or *) → <ul><li>
 */
function formatContent(content: string): string {
  let html = content
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Numbered lists
    .replace(/^(\d+)\.\s+(.+)$/gm, "<li>$2</li>")
    // Bulleted lists
    .replace(/^[\-\*]\s+(.+)$/gm, "<li>$1</li>")
    // Line breaks
    .replace(/\n/g, "<br />");

  // Wrap consecutive <li> in <ol> or <ul>
  html = html.replace(/(<li>.+<\/li>)/g, (match) => {
    if (match.includes("1.")) return `<ol class="list-decimal ml-4 my-2">${match}</ol>`;
    return `<ul class="list-disc ml-4 my-2">${match}</ul>`;
  });

  return html;
}

export function CopilotMessage({ role, content, toolsUsed }: CopilotMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted/50 border border-border/50 rounded-tl-sm"
        )}
      >
        <div
          dangerouslySetInnerHTML={{ __html: formatContent(content) }}
          className="prose prose-sm dark:prose-invert max-w-none"
        />

        {/* Tools used tag */}
        {!isUser && toolsUsed && toolsUsed.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Queried: {toolsUsed.join(", ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
