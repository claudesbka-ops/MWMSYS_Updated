import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ChevronLeft, AlertTriangle, User, Building2, FileText,
  Clock, Send, Shield, CheckCircle2, ArrowUpCircle, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { usePanicAlerts } from "@/contexts/PanicAlertsContext";
import { getProblems, resolveProblem, type ProblemAndActionDto } from "@/services/problemService";

type NormalisedIncident = {
  id: number;
  type: "Panic Alert" | "Issue";
  name: string;
  idNumber: string;
  workerId?: string | null;
  description: string;
  employer?: string | null;
  date: string;
  time: string;
  by: string;
  resolved: boolean;
};

const statusOptions = [
  { value: "open", label: "Open", color: "bg-warning/10 text-warning" },
  { value: "investigating", label: "Investigating", color: "bg-primary/10 text-primary" },
  { value: "escalated", label: "Escalated to Police", color: "bg-destructive/10 text-destructive" },
  { value: "resolved", label: "Resolved", color: "bg-success/10 text-success" },
];

interface ResponseLog {
  id: number;
  author: string;
  action: string;
  comment: string;
  timestamp: string;
}

function formatDateTime(raw: unknown): { date: string; time: string } {
  if (!raw) return { date: "—", time: "—" };
  const d = new Date(raw as any);
  if (!Number.isFinite(d.getTime())) return { date: "—", time: "—" };
  return { date: d.toLocaleDateString(), time: d.toLocaleTimeString() };
}

function isResolved(p: ProblemAndActionDto): boolean {
  const raw = (p as any)?.IsResolved ?? (p as any)?.Status;
  return raw === true || raw === 1 || raw === "1";
}

export default function IncidentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const incidentId = Number(id);

  const { alerts: panicAlerts, resolve: resolvePanic } = usePanicAlerts();

  const problemsQuery = useQuery({
    queryKey: ["problems", "all"],
    queryFn: () => getProblems(),
    staleTime: 30_000,
  });

  const incident: NormalisedIncident | null = useMemo(() => {
    if (!Number.isFinite(incidentId)) return null;

    const panic = (panicAlerts ?? []).find((p) => Number(p.ID) === incidentId);
    if (panic) {
      const { date, time } = formatDateTime(panic.Updated_On);
      return {
        id: Number(panic.ID),
        type: "Panic Alert",
        name: (panic.worker_ID ?? "Worker").toString(),
        idNumber: (panic.Prob_ID ?? "").toString(),
        workerId: panic.worker_ID ?? null,
        description: (panic.Description ?? panic.Title ?? "Panic alert triggered").toString(),
        employer: panic.Company_Name ?? null,
        date,
        time,
        by: "Worker",
        resolved: false,
      };
    }

    const problem = (problemsQuery.data ?? []).find(
      (p) => Number(p.ProblemAndActionId) === incidentId
    );
    if (problem) {
      const fallback = formatDateTime(problem.CreatedOn ?? problem.Date ?? null);
      return {
        id: Number(problem.ProblemAndActionId),
        type: "Issue",
        name: (problem.MemberName ?? problem.FullName ?? "Unknown").toString(),
        idNumber: (problem.PassportNumber ?? "").toString(),
        workerId: null,
        description: (problem.Description ?? problem.Title ?? "").toString(),
        employer: problem.EmployerName ?? null,
        date: problem.Date ?? fallback.date,
        time: problem.Time ?? fallback.time,
        by: (problem.FullName ?? problem.MemberName ?? "System").toString(),
        resolved: isResolved(problem),
      };
    }

    return null;
  }, [incidentId, panicAlerts, problemsQuery.data]);

  const [status, setStatus] = useState<string>("open");
  const [newComment, setNewComment] = useState("");
  const [responses, setResponses] = useState<ResponseLog[]>([]);
  const [actioning, setActioning] = useState(false);

  // Keep the status selector in sync with the loaded incident on first hit.
  useMemo(() => {
    if (incident?.resolved) setStatus("resolved");
  }, [incident?.resolved]);

  const smartSummary = useMemo(() => {
    if (!incident) return "";
    if (incident.type === "Panic Alert") {
      return `Automated Risk Assessment: High. Live panic alert from ${incident.name}${incident.employer ? ` at ${incident.employer}` : ""}.`;
    }
    const openCount = (problemsQuery.data ?? []).filter(
      (p) => !isResolved(p) && incident.employer && (p.EmployerName ?? "").toString().toLowerCase() === incident.employer.toLowerCase()
    ).length;
    const risk = openCount > 2 ? "High" : openCount > 0 ? "Medium" : "Low";
    return `Automated Risk Assessment: ${risk}. Employer has ${openCount} open issue${openCount === 1 ? "" : "s"}.`;
  }, [incident, problemsQuery.data]);

  const loading = problemsQuery.isLoading && (panicAlerts ?? []).length === 0;

  if (!Number.isFinite(incidentId)) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Invalid Incident</h2>
          <button onClick={() => navigate("/")} className="text-sm text-primary hover:underline">Return to Dashboard</button>
        </div>
      </DashboardLayout>
    );
  }

  if (loading && !incident) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!incident) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Incident Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">This incident is no longer active or you do not have access to it.</p>
          <button onClick={() => navigate("/")} className="text-sm text-primary hover:underline">Return to Dashboard</button>
        </div>
      </DashboardLayout>
    );
  }

  const isPanic = incident.type === "Panic Alert";
  const currentStatus = statusOptions.find(s => s.value === status) ?? statusOptions[0];

  const handleAddResponse = () => {
    if (!newComment.trim()) return;
    setResponses(prev => [
      ...prev,
      {
        id: Date.now(),
        author: "You",
        action: "Comment Added",
        comment: newComment,
        timestamp: new Date().toLocaleString(),
      },
    ]);
    setNewComment("");
    toast.success("Response logged");
  };

  const handleStatusChange = async (newStatus: string) => {
    const label = statusOptions.find(s => s.value === newStatus)?.label ?? newStatus;

    if (newStatus === "resolved" && !actioning) {
      setActioning(true);
      try {
        if (isPanic) {
          await resolvePanic(incident.id);
        } else {
          await resolveProblem(incident.id);
          await problemsQuery.refetch();
        }
        setStatus("resolved");
        setResponses(prev => [
          ...prev,
          {
            id: Date.now(),
            author: "You",
            action: "Status → Resolved",
            comment: "Incident marked as resolved.",
            timestamp: new Date().toLocaleString(),
          },
        ]);
        toast.success("Incident resolved");
      } catch (e: any) {
        toast.error(e?.response?.data?.error ?? "Failed to resolve incident");
      } finally {
        setActioning(false);
      }
      return;
    }

    setStatus(newStatus);
    setResponses(prev => [
      ...prev,
      {
        id: Date.now(),
        author: "You",
        action: `Status → ${label}`,
        comment: `Incident status changed to "${label}".`,
        timestamp: new Date().toLocaleString(),
      },
    ]);
  };

  return (
    <DashboardLayout>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      {/* Incident Header */}
      <div className={`relative overflow-hidden rounded-2xl p-7 mb-6 shadow-xl ${isPanic ? "bg-gradient-to-br from-[hsl(0,40%,15%)] via-[hsl(0,50%,18%)] to-[hsl(0,60%,22%)]" : "bg-gradient-to-br from-[hsl(38,40%,15%)] via-[hsl(38,50%,18%)] to-[hsl(38,60%,22%)]"}`}>
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg mb-3 ${isPanic ? "bg-destructive/20 text-[hsl(0,80%,70%)]" : "bg-warning/20 text-[hsl(38,80%,70%)]"}`}>
                <AlertTriangle className="w-3 h-3" />
                {incident.type} · #{incident.id}
              </span>
              <h1 className="text-xl font-bold text-[hsl(0,0%,100%)] mb-1">{incident.description || incident.type}</h1>
              <p className="text-[hsl(210,20%,75%)] text-sm">Reported by {incident.by} on {incident.date} at {incident.time}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${currentStatus.color}`}>
              {currentStatus.label}
            </span>
          </div>
        </div>
        <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl ${isPanic ? "bg-destructive/20" : "bg-warning/20"}`} />
      </div>

      {/* Smart Summary */}
      <div className="bg-card rounded-2xl border border-border/60 p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-foreground">Smart Summary</h3>
          <span className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg font-medium">AI Briefing</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{smartSummary}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Worker Details */}
        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Worker Details
          </h3>
          <div className="space-y-3">
            {[
              { label: "Name", value: incident.name },
              { label: "Worker Id", value: incident.workerId ?? "—" },
              { label: "Passport", value: incident.idNumber || "—" },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{item.label}</p>
                <p className="text-sm font-medium text-foreground">{item.value}</p>
              </div>
            ))}
            {isPanic && incident.workerId ? (
              <button
                onClick={() => navigate(`/map?focus=${encodeURIComponent(incident.workerId!)}&alertId=${incident.id}`)}
                className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
              >
                Open on live map →
              </button>
            ) : null}
          </div>
        </div>

        {/* Employer Details */}
        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-success" />
            Employer Details
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Company</p>
              <p className="text-sm font-medium text-foreground">{incident.employer || "Not specified"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Type</p>
              <p className="text-sm font-medium text-foreground">{incident.type}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Reported</p>
              <p className="text-sm font-medium text-foreground">{incident.date} · {incident.time}</p>
            </div>
          </div>
        </div>

        {/* Status Control */}
        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-warning" />
            Incident Control
          </h3>
          <div className="space-y-2">
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                disabled={actioning}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${status === opt.value ? opt.color + " ring-1 ring-current/20" : "text-muted-foreground hover:bg-muted/40"}`}
              >
                {opt.value === "open" && <Clock className="w-4 h-4" />}
                {opt.value === "investigating" && <FileText className="w-4 h-4" />}
                {opt.value === "escalated" && <ArrowUpCircle className="w-4 h-4" />}
                {opt.value === "resolved" && <CheckCircle2 className="w-4 h-4" />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Response Log */}
      <div className="bg-card rounded-2xl border border-border/60 p-6">
        <h3 className="text-sm font-bold text-foreground mb-5 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Response Log
        </h3>

        <div className="space-y-4 mb-6">
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No responses yet. Add the first note below.</p>
          ) : (
            responses.map(r => (
              <div key={r.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">{r.author.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{r.author}</span>
                    <span className="text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">{r.action}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.comment}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">{r.timestamp}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Comment */}
        <div className="flex gap-3 pt-4 border-t border-border/40">
          <input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddResponse()}
            placeholder="Add a response or comment..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleAddResponse}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
