import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, AlertTriangle, Building2, Command, ArrowRight } from "lucide-react";
import { globalSearch } from "@/services/searchService";

interface SearchResult {
  type: "worker" | "alert" | "employer";
  id: string | number;
  title: string;
  subtitle: string;
  path: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    let cancelled = false;
    if (!open) return;
    if (!normalizedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await globalSearch(normalizedQuery);
        if (cancelled) return;

        const next: SearchResult[] = [
          ...(res.workers ?? []).map((w) => ({
            type: "worker" as const,
            id: w.Worker_Id,
            title: (w.Name ?? w.Worker_Id).toString(),
            subtitle: `${(w.Passport_Number ?? "").toString()}${w.Passport_Number ? " · " : ""}${w.Worker_Id}`,
            path: "/worker",
          })),
          ...(res.employers ?? []).map((e) => ({
            type: "employer" as const,
            id: e.User_Id,
            title: e.Employer_Name.toString(),
            subtitle: `${(e.Employer_ContactPerson ?? "").toString()}${e.Employer_ContactPerson ? " · " : ""}${(e.Employer_EmailID ?? "").toString()}`.trim(),
            path: "/employer",
          })),
        ];

        setResults(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [normalizedQuery, open]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-card rounded-2xl border border-border/60 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 border-b border-border/40">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search workers by name or passport..."
            className="flex-1 py-4 bg-transparent text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-muted/60 text-[10px] font-semibold text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {normalizedQuery && (
          <div className="max-h-72 overflow-y-auto p-2">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Searching…</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No results found for "{query}"</p>
            ) : (
              results.map((r, i) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${i === selectedIndex ? "bg-primary/10" : "hover:bg-muted/40"}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    r.type === "worker" ? "bg-primary/10" : r.type === "alert" ? "bg-warning/10" : "bg-success/10"
                  }`}>
                    {r.type === "worker" ? <User className="w-4 h-4 text-primary" /> :
                     r.type === "alert" ? <AlertTriangle className="w-4 h-4 text-warning" /> :
                     <Building2 className="w-4 h-4 text-success" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        )}

        {!query.trim() && (
          <div className="p-6 text-center">
            <Command className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Type to search workers, incidents, or employers</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Search by passport number for fastest results</p>
          </div>
        )}
      </div>
    </div>
  );
}
