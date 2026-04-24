import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LinkSearchRow = {
  id: string;
  primary: string; // bold line (name/company)
  secondary: string; // subline (email / passport / etc.)
  meta?: string;
};

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  placeholder: string;
  onClose: () => void;
  onSearch: (query: string) => Promise<LinkSearchRow[]>;
  onLink: (row: LinkSearchRow) => Promise<void>;
};

export default function LinkEntityModal({ open, title, subtitle, placeholder, onClose, onSearch, onLink }: Props) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LinkSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setRows([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (!trimmed) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const result = await onSearch(trimmed);
        if (!cancelled) setRows(result);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, open, onSearch]);

  const handleLink = async (row: LinkSearchRow) => {
    if (linkingId) return;
    setLinkingId(row.id);
    try {
      await onLink(row);
      toast.success(`Linked ${row.primary}`);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Unable to link";
      toast.error(msg);
    } finally {
      setLinkingId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-border/40">
          <div>
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted/60 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {q.trim().length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              Start typing to search.
            </div>
          ) : loading ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Searching…</div>
          ) : rows.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No matches found.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{r.primary}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.secondary}</div>
                    {r.meta ? (
                      <div className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{r.meta}</div>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleLink(r)}
                    disabled={linkingId === r.id}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    {linkingId === r.id ? "Linking…" : "Link"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
