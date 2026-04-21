import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { apiClient } from "@/services/apiClient";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { createBroadcastSocket, getBroadcastFeed, sendBroadcast, sendBroadcastMultipart, type BroadcastMessage } from "@/services/broadcastService";
import type { Socket } from "socket.io-client";
import { Megaphone, Paperclip, Send, Smile } from "lucide-react";

export default function BroadcastPage() {
  const { currentRole } = useRole();
  const [rows, setRows] = useState<BroadcastMessage[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSend = currentRole === "admin" || currentRole === "employer" || currentRole === "agency" || currentRole === "embassy_source" || currentRole === "embassy_destination" || currentRole === "labour";

  const socketUrl = useMemo(() => {
    return apiClient.defaults.baseURL ?? "";
  }, []);

  useEffect(() => {
    getBroadcastFeed(80)
      .then((res) => setRows(Array.isArray(res?.rows) ? res.rows : []))
      .catch(() => undefined);

    const s = createBroadcastSocket(socketUrl);
    socketRef.current = s;

    const onMsg = (payload: any) => {
      const msg: BroadcastMessage = {
        id: payload?.id ?? null,
        senderRoleId: Number(payload?.senderRoleId ?? 0),
        senderKey: payload?.senderKey ?? null,
        senderName: payload?.senderName ?? null,
        message: String(payload?.message ?? ""),
        target: String(payload?.target ?? ""),
        createdOn: String(payload?.createdOn ?? new Date().toISOString()),
        attachments: Array.isArray(payload?.attachments) ? payload.attachments : [],
      };

      setRows((prev) => {
        const next = [msg, ...(prev ?? [])];
        const seen = new Set<string>();
        return next.filter((x) => {
          const key = `${x.id ?? ""}|${x.createdOn}|${x.message}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
    };

    s.on("broadcast_message", onMsg);

    return () => {
      try {
        s.off("broadcast_message", onMsg);
        s.disconnect();
      } catch {
        // ignore
      }
      socketRef.current = null;
    };
  }, [socketUrl]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" />
              Broadcast
            </h1>
            <p className="text-sm text-muted-foreground">Announcements and updates scoped by role</p>
          </div>

          <Badge variant="secondary" className="trend-badge-shimmer">Live</Badge>
        </div>

        {canSend && (
          <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/55 p-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type an announcement…"
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  setFiles(list.slice(0, 5));
                }}
              />
              <Button
                variant="outline"
                type="button"
                className="sm:w-[120px]"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
                Attach
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className="sm:w-[110px]">
                    <Smile className="h-4 w-4" />
                    Emoji
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72">
                  <div className="grid grid-cols-8 gap-1">
                    {[
                      "😀","😁","😂","🤣","😊","😍","😘","😎",
                      "👍","🙏","👏","💪","🔥","✅","❌","⚠️",
                      "🎉","📢","📌","📎","📷","🎥","📄","💬",
                    ].map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="h-8 w-8 rounded-md hover:bg-muted/60 text-lg"
                        onClick={() => setText((t) => `${t}${e}`)}
                        aria-label={e}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                className="sm:w-[160px]"
                disabled={!text.trim() && files.length === 0}
                onClick={async () => {
                  try {
                    const msg = text.trim();
                    setText("");
                    const curFiles = files;
                    setFiles([]);
                    if (curFiles.length) {
                      await sendBroadcastMultipart({ message: msg, files: curFiles });
                    } else {
                      await sendBroadcast(msg);
                    }
                    toast.success("Broadcast sent");
                  } catch (e: any) {
                    toast.error(e?.response?.data?.error ?? "Unable to send");
                  }
                }}
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
            {files.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((f) => (
                  <span key={`${f.name}-${f.size}`} className="text-[11px] px-2 py-1 rounded-xl bg-muted/60 text-muted-foreground border border-border/50">
                    {f.name}
                  </span>
                ))}
                <button
                  type="button"
                  className="text-[11px] px-2 py-1 rounded-xl bg-destructive/10 text-destructive border border-border/50"
                  onClick={() => setFiles([])}
                >
                  Clear
                </button>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Visibility is automatic: employers → their workers, agencies → their workers + employers, embassies → nationality, admin/labour → everyone.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="p-4 border-b border-border/60">
            <div className="text-sm font-semibold">Feed</div>
            <div className="text-xs text-muted-foreground">Latest announcements</div>
          </div>

          <div className="max-h-[70vh] overflow-auto">
            {rows.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No messages yet.</div>
            ) : (
              <div className="divide-y divide-border/40">
                {rows.map((r, idx) => (
                  <div key={`${r.id ?? "x"}-${idx}`} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">
                          {r.senderName ?? "System"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.createdOn ? new Date(r.createdOn).toLocaleString() : "—"}
                        </div>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-xl bg-primary/10 text-primary font-semibold">{r.target}</span>
                    </div>
                    <div className="mt-2 text-sm text-foreground whitespace-pre-wrap">{r.message}</div>
                    {Array.isArray(r.attachments) && r.attachments.length ? (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {r.attachments.map((a) => {
                          const mime = (a.mime ?? "").toLowerCase();
                          const isImg = mime.startsWith("image/");
                          const name = a.originalName ?? a.url;
                          return isImg ? (
                            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-border/50 bg-muted/20">
                              <img src={a.url} alt={name} className="w-full h-48 object-cover" loading="lazy" />
                            </a>
                          ) : (
                            <a
                              key={a.id}
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/30"
                            >
                              <span className="text-xs text-foreground truncate">{name}</span>
                              <span className="text-[11px] text-muted-foreground">Download</span>
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
