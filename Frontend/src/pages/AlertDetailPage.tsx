import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  MapPin,
  ShieldAlert,
  User,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/contexts/RoleContext";
import { usePanicAlerts, type PanicAlert } from "@/contexts/PanicAlertsContext";
import {
  getProblems,
  resolveProblem,
  type ProblemAndActionDto,
} from "@/services/problemService";
import { apiClient } from "@/services/apiClient";

type ResolvedRecord = {
  id: number;
  type: "panic" | "issue";
  title: string;
  description: string;
  workerId: string | null;
  workerName: string;
  passportNumber: string;
  employer: string | null;
  status: string;
  resolved: boolean;
  timestamp: string | null;
  lat: number | null;
  lng: number | null;
  source: "panic" | "problem";
};

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatTimestamp(raw: unknown): string {
  if (!raw) return "Unknown";
  const d = new Date(raw as any);
  if (!Number.isFinite(d.getTime())) return "Unknown";
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString()}`;
}

function fromPanic(p: PanicAlert): ResolvedRecord {
  return {
    id: Number(p.ID),
    type: "panic",
    title: (p.Title ?? "Panic Alert").toString(),
    description: (p.Description ?? "Panic alert triggered").toString(),
    workerId: p.worker_ID ?? null,
    workerName: (p.worker_ID ?? "Worker").toString(),
    passportNumber: (p.Prob_ID ?? "").toString(),
    employer: p.Company_Name ?? null,
    status: (p.ProbStatus ?? "Active").toString(),
    resolved: false,
    timestamp: p.Updated_On ? new Date(p.Updated_On as any).toISOString() : null,
    lat: toNumberOrNull(p.Lat),
    lng: toNumberOrNull(p.Lng),
    source: "panic",
  };
}

function fromProblem(p: ProblemAndActionDto): ResolvedRecord {
  const isPanic = ((p as any).Type ?? "").toString().toLowerCase() === "panic";
  const rawResolved = (p as any).IsResolved;
  const resolved =
    rawResolved === true ||
    rawResolved === 1 ||
    rawResolved === "1" ||
    ((p as any).Status === "Resolved");
  return {
    id: Number(p.ProblemAndActionId),
    type: isPanic ? "panic" : "issue",
    title: (p.Title ?? (isPanic ? "Panic Alert" : "Issue")).toString(),
    description: (p.Description ?? "").toString(),
    workerId: ((p as any).worker_ID ?? null) as string | null,
    workerName: (p.MemberName ?? p.FullName ?? p.PassportNumber ?? "Unknown").toString(),
    passportNumber: (p.PassportNumber ?? "").toString(),
    employer: (p.EmployerName as string | undefined) ?? null,
    status: resolved ? "Resolved" : ((p as any).Status ?? "Active").toString(),
    resolved,
    timestamp: (p.CreatedOn as string | undefined) ?? null,
    lat: toNumberOrNull((p as any).Lat),
    lng: toNumberOrNull((p as any).Lng),
    source: "problem",
  };
}

export default function AlertDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentRole } = useRole();
  const { alerts: panicAlerts, resolve: resolvePanic } = usePanicAlerts();

  const alertIdRaw = searchParams.get("alertId");
  const focusedWorkerId = searchParams.get("focus");
  const alertId = alertIdRaw != null ? Number(alertIdRaw) : NaN;

  const [resolving, setResolving] = useState(false);
  const [optimisticResolved, setOptimisticResolved] = useState(false);

  const problemsQuery = useQuery({
    queryKey: ["problems", "all"],
    queryFn: getProblems,
    staleTime: 30_000,
  });

  const record: ResolvedRecord | null = useMemo(() => {
    if (!Number.isFinite(alertId)) return null;

    const fromContext = (panicAlerts ?? []).find((a) => Number(a.ID) === alertId);
    if (fromContext) return fromPanic(fromContext);

    const fromList = (problemsQuery.data ?? []).find(
      (p) => Number(p.ProblemAndActionId) === alertId
    );
    if (fromList) return fromProblem(fromList);

    return null;
  }, [alertId, panicAlerts, problemsQuery.data]);

  const canResolve =
    currentRole === "admin" || currentRole === "employer" || currentRole === "agency";

  const handleResolve = async () => {
    if (!record) return;
    setResolving(true);
    try {
      if (record.source === "panic") {
        try {
          await resolvePanic(record.id);
        } catch {
          // Fall back to legacy resolve in case the panic endpoint is gated.
          await apiClient.post("/Api/Panic/Resolve", { id: record.id });
        }
      } else {
        await resolveProblem(record.id);
      }
      setOptimisticResolved(true);
      toast.success("Alert marked resolved");
      problemsQuery.refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? e?.message ?? "Failed to resolve alert");
    } finally {
      setResolving(false);
    }
  };

  const isLoading = problemsQuery.isLoading && !record;
  const hasGps = record && record.lat != null && record.lng != null;
  const isResolved = (record?.resolved ?? false) || optimisticResolved;

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        {focusedWorkerId && (
          <span className="text-xs text-muted-foreground">
            Worker: <span className="font-mono text-foreground">{focusedWorkerId}</span>
          </span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(215,32%,22%)] to-[hsl(243,75%,35%)] p-7 mb-6 shadow-xl">
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary uppercase tracking-widest">
                Alert Detail
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[hsl(0,0%,100%)] mb-1.5">
              {record?.title ?? (isLoading ? "Loading alert…" : "Alert not found")}
            </h1>
            <p className="text-[hsl(210,20%,75%)] text-sm max-w-xl">
              {record?.description ||
                "Review the alert location, worker information, and resolution status."}
            </p>
          </div>
          {record && (
            <span
              className={
                "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border " +
                (isResolved
                  ? "bg-success/15 text-success border-success/40"
                  : "bg-destructive/15 text-destructive border-destructive/40")
              }
            >
              {isResolved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" /> Active
                </>
              )}
            </span>
          )}
        </div>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-40 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : !record ? (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-8 text-center">
          <p className="text-sm font-medium text-foreground">Alert #{alertIdRaw ?? "?"} not found</p>
          <p className="text-xs text-muted-foreground mt-1">
            It may have been resolved or you may not have access to it.
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card rounded-2xl border border-border/60 p-6">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Location
              </h3>
              {hasGps ? (
                <div>
                  <div className="rounded-xl overflow-hidden border border-border/60">
                    <iframe
                      title="Alert location"
                      src={`https://maps.google.com/maps?q=${record.lat},${record.lng}&z=15&output=embed`}
                      className="w-full h-[360px]"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    {record.lat?.toFixed(6)}, {record.lng?.toFixed(6)}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-6 text-center">
                  <p className="text-sm font-medium text-foreground">Location not available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No GPS coordinates were captured for this alert.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border/60 p-6">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Worker
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Name
                  </p>
                  <p className="text-sm font-medium text-foreground">{record.workerName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Passport
                  </p>
                  <p className="text-sm font-mono text-foreground">
                    {record.passportNumber || "—"}
                  </p>
                </div>
                {record.workerId && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      Worker ID
                    </p>
                    <p className="text-sm font-mono text-foreground">{record.workerId}</p>
                  </div>
                )}
                {record.employer && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      Employer
                    </p>
                    <p className="text-sm font-medium text-foreground">{record.employer}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border/60 p-6">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Alert Info
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Type
                  </p>
                  <p className="text-sm font-medium text-foreground capitalize">{record.type}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Reported
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {formatTimestamp(record.timestamp)}
                  </p>
                </div>
              </div>
            </div>

            {canResolve && !isResolved && (
              <button
                type="button"
                onClick={handleResolve}
                disabled={resolving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-success text-success-foreground text-sm font-semibold hover:bg-success/90 transition disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                {resolving ? "Resolving…" : "Mark Resolved"}
              </button>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
