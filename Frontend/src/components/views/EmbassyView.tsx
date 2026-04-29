import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FileCheck, Globe2, Send, ShieldAlert, Users } from "lucide-react";

import { getProblems } from "@/services/problemService";
import { getWorkersList, type WorkerListRow } from "@/services/workerService";
import { sendBroadcast } from "@/services/broadcastService";

export default function EmbassyView({ variant }: { variant: "source" | "destination" }) {
  const navigate = useNavigate();
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  const { data: problems = [] } = useQuery({
    queryKey: ["problems"],
    queryFn: getProblems,
  });
  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["workers", "embassy"],
    queryFn: getWorkersList,
  });

  // Backend already scopes worker list to the embassy's nationality via
  // buildWorkerScopeWhere — we display whatever the API returned.
  const scopedWorkers: WorkerListRow[] = workers ?? [];
  const countryLabel = useMemo(() => {
    const names = scopedWorkers
      .map((w) => (w.Country_Name ?? "").toString().trim())
      .filter(Boolean);
    if (!names.length) return variant === "source" ? "Source Country" : "Destination Country";
    const top = new Map<string, number>();
    for (const n of names) top.set(n, (top.get(n) ?? 0) + 1);
    return [...top.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }, [scopedWorkers, variant]);

  const totalWorkers = scopedWorkers.length;
  const activeAlerts = problems.filter(
    (p) => !(p as any).IsResolved && ((p as any).ProbStatus !== "Resolved")
  ).length;
  const pendingDocuments = problems.filter(
    (p) => ((p as any).Type ?? "").toString().toLowerCase().includes("document")
  ).length;
  const resolvedCases = problems.filter(
    (p) => (p as any).IsResolved || ((p as any).ProbStatus === "Resolved")
  ).length;

  const handleSendBroadcast = async () => {
    const msg = broadcastMsg.trim();
    if (!msg) return;
    setBroadcastBusy(true);
    setBroadcastStatus(null);
    try {
      await sendBroadcast(msg);
      setBroadcastStatus("Broadcast sent to your nationality workers.");
      setBroadcastMsg("");
      setTimeout(() => {
        setBroadcastOpen(false);
        setBroadcastStatus(null);
      }, 1200);
    } catch (e: any) {
      setBroadcastStatus(e?.message ?? "Failed to send broadcast");
    } finally {
      setBroadcastBusy(false);
    }
  };

  const stats = [
    { icon: Users, value: totalWorkers, label: "Total Workers" },
    { icon: ShieldAlert, value: activeAlerts, label: "Active Alerts" },
    { icon: FileCheck, value: pendingDocuments, label: "Pending Documents" },
    { icon: AlertTriangle, value: resolvedCases, label: "Resolved Cases" },
  ];

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(215,32%,22%)] to-[hsl(243,75%,35%)] p-7 mb-7 shadow-xl">
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe2 className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary uppercase tracking-widest">
                Embassy Portal ({variant === "source" ? "Source" : "Destination"})
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[hsl(0,0%,100%)] mb-1.5">
              Embassy Portal — {countryLabel} Workers
            </h1>
            <p className="text-[hsl(210,20%,75%)] text-sm max-w-lg">
              Monitor your nationals abroad, track active alerts, and broadcast messages directly to them.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBroadcastOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
          >
            <Send className="w-4 h-4" />
            Broadcast to Nationals
          </button>
        </div>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl" />
      </div>

      {broadcastOpen && (
        <div className="bg-card rounded-2xl border border-border/60 p-5 mb-6">
          <h3 className="text-sm font-bold text-foreground mb-2">Broadcast message</h3>
          <p className="text-xs text-muted-foreground mb-3">
            This message is delivered only to workers whose nationality matches your embassy.
          </p>
          <textarea
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            disabled={broadcastBusy}
            rows={3}
            placeholder="Type your message…"
            className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleSendBroadcast}
              disabled={broadcastBusy || !broadcastMsg.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {broadcastBusy ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBroadcastOpen(false);
                setBroadcastMsg("");
                setBroadcastStatus(null);
              }}
              className="px-4 py-2 rounded-xl border border-border/60 text-sm text-muted-foreground hover:bg-muted/40"
            >
              Cancel
            </button>
            {broadcastStatus && (
              <span className="text-xs text-muted-foreground ml-2">{broadcastStatus}</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group bg-card rounded-2xl border border-border/60 p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/10 group-hover:scale-110 transition-transform duration-300">
              <stat.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border/60 p-6">
        <h3 className="text-sm font-bold text-foreground mb-1">{countryLabel} Workers</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Workers from your nationality currently registered in the system
        </p>

        {workersLoading ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading workers…</p>
          </div>
        ) : scopedWorkers.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium text-foreground">No workers found</p>
            <p className="text-xs text-muted-foreground mt-1">
              No workers from your nationality are currently registered.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <th className="py-2 pr-3 font-medium">Worker ID</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Passport</th>
                  <th className="py-2 pr-3 font-medium">Employer</th>
                  <th className="py-2 pr-3 font-medium">Permit Expiry</th>
                </tr>
              </thead>
              <tbody>
                {scopedWorkers.slice(0, 100).map((w) => (
                  <tr
                    key={w.Worker_Id}
                    onClick={() => navigate(`/worker/${encodeURIComponent(w.Worker_Id)}`)}
                    className="cursor-pointer border-b border-border/40 hover:bg-muted/30"
                  >
                    <td className="py-2 pr-3 font-mono text-xs text-foreground">{w.Worker_Id}</td>
                    <td className="py-2 pr-3 text-foreground">{w.Name ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{w.Passport_Number ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {w.Company_Name ?? w.Employer_Id ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {w.Permit_Expire_Date
                        ? new Date(w.Permit_Expire_Date).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
