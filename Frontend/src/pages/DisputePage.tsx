import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronRight, Clock, Copy, Paperclip, Send, X, XCircle } from "lucide-react";
import {
  type Dispute,
  type DisputeStatus,
  type TimelineEntry,
  disputeFileUrl,
  getAllDisputes,
  getDisputeTimeline,
  getIncomingDisputes,
  getMyDisputes,
  generateDisputeSummary,
  reviewDispute,
  submitDispute,
} from "@/services/disputeService";

// ---------- shared helpers ----------

function statusBadge(status: DisputeStatus) {
  switch (status) {
    case "Pending":
      return {
        label: "Pending",
        icon: Clock,
        cls: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      };
    case "Accepted":
      return {
        label: "Accepted",
        icon: CheckCircle2,
        cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
      };
    case "Rejected":
      return {
        label: "Rejected",
        icon: XCircle,
        cls: "bg-red-500/15 text-red-500 border-red-500/30",
      };
  }
}

function StatusChip({ status }: { status: DisputeStatus }) {
  const b = statusBadge(status);
  const Icon = b.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${b.cls}`}>
      <Icon className="w-3 h-3" />
      {b.label}
    </span>
  );
}

type Severity = "critical" | "high" | "medium" | "low";

function severityBadge(severity: Severity | null | undefined, score: number | null | undefined) {
  if (!severity) {
    return {
      label: "Scoring...",
      cls: "bg-slate-100 text-slate-600 border-slate-200",
      showScore: false,
    };
  }
  switch (severity) {
    case "critical":
      return {
        label: "CRITICAL",
        cls: "bg-red-100 text-red-700 border-red-200",
        showScore: true,
      };
    case "high":
      return {
        label: "HIGH",
        cls: "bg-orange-100 text-orange-700 border-orange-200",
        showScore: true,
      };
    case "medium":
      return {
        label: "MEDIUM",
        cls: "bg-amber-100 text-amber-700 border-amber-200",
        showScore: true,
      };
    case "low":
      return {
        label: "LOW",
        cls: "bg-blue-100 text-blue-700 border-blue-200",
        showScore: true,
      };
  }
}

function SeverityChip({ severity, score }: { severity: Severity | null; score: number | null }) {
  const b = severityBadge(severity, score);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${b.cls}`}>
      {b.label}
      {b.showScore && score !== null && <span className="opacity-75">{score}</span>}
    </span>
  );
}

function formatAmount(n: number): string {
  return `RM ${Number(n ?? 0).toFixed(2)}`;
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return d.toLocaleDateString();
}

// ---------- Worker view ----------

function WorkerDisputeView() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    disputeMonth: "",
    expectedAmount: "",
    receivedAmount: "",
    description: "",
  });
  const [proof, setProof] = useState<File | null>(null);

  const myDisputes = useQuery({
    queryKey: ["my_disputes"],
    queryFn: getMyDisputes,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const expected = Number(form.expectedAmount);
      const received = Number(form.receivedAmount);
      if (!form.disputeMonth.trim()) throw new Error("Enter the month this dispute covers");
      if (!Number.isFinite(expected) || !Number.isFinite(received)) throw new Error("Amounts must be numbers");
      if (!form.description.trim()) throw new Error("Describe the issue so we can route it properly");
      return submitDispute({
        disputeMonth: form.disputeMonth.trim(),
        expectedAmount: expected,
        receivedAmount: received,
        description: form.description.trim(),
        proof: proof ?? undefined,
      });
    },
    onSuccess: () => {
      toast.success("Dispute submitted");
      setForm({ disputeMonth: "", expectedAmount: "", receivedAmount: "", description: "" });
      setProof(null);
      queryClient.invalidateQueries({ queryKey: ["my_disputes"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? "Unable to submit dispute";
      toast.error(msg);
    },
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error("Proof file must be 5 MB or smaller");
      e.target.value = "";
      return;
    }
    setProof(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border/60 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-base font-bold text-foreground">Submit a salary dispute</h2>
            <p className="text-xs text-muted-foreground">
              We will route this to your employer. Agencies and the Labour Department can also see it.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="month">Month</Label>
              <Input
                id="month"
                value={form.disputeMonth}
                onChange={(e) => setForm((p) => ({ ...p, disputeMonth: e.target.value }))}
                placeholder="e.g. March 2025"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expected">Expected amount (RM)</Label>
              <Input
                id="expected"
                type="number"
                step="0.01"
                min="0"
                value={form.expectedAmount}
                onChange={(e) => setForm((p) => ({ ...p, expectedAmount: e.target.value }))}
                placeholder="1700.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="received">Received amount (RM)</Label>
              <Input
                id="received"
                type="number"
                step="0.01"
                min="0"
                value={form.receivedAmount}
                onChange={(e) => setForm((p) => ({ ...p, receivedAmount: e.target.value }))}
                placeholder="1200.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">What happened?</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe the shortfall and any overtime / bonus that was withheld."
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proof">Proof (optional)</Label>
            <div className="flex items-center gap-3">
              <input
                id="proof"
                type="file"
                accept="image/*,application/pdf"
                onChange={onFileChange}
                className="text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold"
              />
              {proof ? (
                <button
                  type="button"
                  onClick={() => setProof(null)}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Remove
                </button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              JPG, PNG or PDF, up to 5 MB. Payslips or bank-transfer screenshots work best.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitMutation.isPending}>
              <Send className="w-4 h-4 mr-2" />
              {submitMutation.isPending ? "Submitting…" : "Submit dispute"}
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="p-4 border-b border-border/60">
          <h3 className="text-sm font-bold text-foreground">My past disputes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {myDisputes.data?.length ?? 0} record{(myDisputes.data?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <DisputeTable
          rows={myDisputes.data ?? []}
          loading={myDisputes.isLoading}
          showEmployer
          showActions={false}
          showDetail
        />
      </div>
    </div>
  );
}

// ---------- Employer view ----------

function EmployerDisputeView() {
  const queryClient = useQueryClient();
  const incoming = useQuery({
    queryKey: ["incoming_disputes"],
    queryFn: getIncomingDisputes,
  });

  const [reviewTarget, setReviewTarget] = useState<{ dispute: Dispute; decision: "Accepted" | "Rejected" } | null>(null);
  const [comment, setComment] = useState("");

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewTarget) throw new Error("Nothing to review");
      if (reviewTarget.decision === "Rejected" && !comment.trim()) {
        throw new Error("A reason is required to reject a dispute");
      }
      return reviewDispute({
        id: reviewTarget.dispute.id,
        status: reviewTarget.decision,
        comment: comment.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Dispute updated");
      setReviewTarget(null);
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["incoming_disputes"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? "Unable to update dispute";
      toast.error(msg);
    },
  });

  return (
    <>
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Incoming disputes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {incoming.data?.length ?? 0} from your workers
            </p>
          </div>
        </div>
        <DisputeTable
          rows={incoming.data ?? []}
          loading={incoming.isLoading}
          showEmployer={false}
          showActions
          onAccept={(d) => {
            setReviewTarget({ dispute: d, decision: "Accepted" });
            setComment("");
          }}
          onReject={(d) => {
            setReviewTarget({ dispute: d, decision: "Rejected" });
            setComment("");
          }}
        />
      </div>

      {reviewTarget ? (
        <div
          className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => (reviewMutation.isPending ? null : setReviewTarget(null))}
        >
          <div
            className="bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-border/40">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {reviewTarget.decision === "Accepted" ? "Accept dispute" : "Reject dispute"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {reviewTarget.dispute.workerName ?? reviewTarget.dispute.workerId} · {reviewTarget.dispute.disputeMonth}
                </p>
              </div>
              <button
                onClick={() => setReviewTarget(null)}
                className="p-1.5 rounded-xl hover:bg-muted/60"
                disabled={reviewMutation.isPending}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <Label htmlFor="reviewComment">
                Comment {reviewTarget.decision === "Rejected" ? "(required)" : "(optional)"}
              </Label>
              <Textarea
                id="reviewComment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder={
                  reviewTarget.decision === "Accepted"
                    ? "Explain how the shortfall will be paid out, if applicable."
                    : "Explain why this dispute is being rejected — the worker will see this comment."
                }
              />
            </div>

            <div className="flex gap-2 p-5 pt-0 justify-end">
              <Button
                variant="outline"
                onClick={() => setReviewTarget(null)}
                disabled={reviewMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => reviewMutation.mutate()}
                disabled={reviewMutation.isPending}
                className={
                  reviewTarget.decision === "Accepted"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }
              >
                {reviewMutation.isPending
                  ? "Saving…"
                  : reviewTarget.decision === "Accepted"
                    ? "Accept dispute"
                    : "Reject dispute"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ---------- Agency + Admin + Labour view ----------

type SeverityFilter = "All" | Severity | "unscored";

function ReadOnlyDisputeView() {
  const [statusFilter, setStatusFilter] = useState<"All" | DisputeStatus>("All");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("All");

  const allQuery = useQuery({
    queryKey: ["all_disputes", statusFilter, severityFilter],
    queryFn: () => getAllDisputes({ status: statusFilter }),
  });

  // Filter disputes by severity client-side
  const filteredDisputes = allQuery.data?.filter((d) => {
    if (severityFilter === "All") return true;
    if (severityFilter === "unscored") return !d.aiSeverity;
    return d.aiSeverity === severityFilter;
  });

  return (
    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
      <div className="p-4 border-b border-border/60 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">All disputes in scope</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allQuery.data?.length ?? 0} record{(allQuery.data?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-40">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "All" | DisputeStatus)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Accepted">Accepted</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="AI Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="unscored">Not scored</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DisputeTable
        rows={filteredDisputes ?? []}
        loading={allQuery.isLoading}
        showEmployer
        showActions={false}
        showDetail
      />
    </div>
  );
}

// ---------- Shared table ----------

// ---------- Detail panel (timeline + AI summary) ----------

function timelineActionLabel(action: string): { label: string; cls: string } {
  switch (action) {
    case "submitted": return { label: "Submitted", cls: "bg-blue-500" };
    case "accepted":  return { label: "Accepted",  cls: "bg-emerald-500" };
    case "rejected":  return { label: "Rejected",  cls: "bg-red-500" };
    default:          return { label: action,       cls: "bg-muted-foreground" };
  }
}

function DisputeDetailPanel({ dispute, canGenerateSummary }: { dispute: Dispute; canGenerateSummary: boolean }) {
  const timelineQuery = useQuery({
    queryKey: ["dispute_timeline", dispute.id],
    queryFn: () => getDisputeTimeline(dispute.id),
  });

  const [summary, setSummary] = useState<string | null>((dispute as any).aiCaseSummary ?? null);
  const [generating, setGenerating] = useState(false);

  const handleGenerateSummary = async () => {
    setGenerating(true);
    try {
      const result = await generateDisputeSummary(dispute.id);
      setSummary(result.summary);
      toast.success("Summary generated");
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to generate summary");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="px-4 pb-4 pt-2 bg-muted/20 border-t border-border/40 space-y-4">
      <div>
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Case Timeline</h4>
        {timelineQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-64" />
          </div>
        ) : !timelineQuery.data || timelineQuery.data.length === 0 ? (
          <p className="text-xs text-muted-foreground">No timeline entries yet.</p>
        ) : (
          <ol className="relative border-l border-border/50 ml-2 space-y-3">
            {(timelineQuery.data as TimelineEntry[]).map((entry) => {
              const { label, cls } = timelineActionLabel(entry.Action);
              return (
                <li key={entry.Id} className="ml-4">
                  <span className={`absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full ${cls}`} />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-semibold text-foreground">{label}</span>
                    {entry.Actor_Role && (
                      <span className="text-[10px] text-muted-foreground capitalize">by {entry.Actor_Role}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.Created_At).toLocaleString()}
                    </span>
                  </div>
                  {entry.Note && (
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.Note}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {canGenerateSummary && (
        <div className="border border-border/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">AI Case Summary</span>
            </div>
            <div className="flex items-center gap-2">
              {summary && (
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
              )}
              <Button size="sm" variant="outline" onClick={handleGenerateSummary} disabled={generating}>
                <Bot className="w-3.5 h-3.5 mr-1.5" />
                {generating ? "Generating…" : summary ? "Regenerate" : "Generate Summary"}
              </Button>
            </div>
          </div>
          {summary ? (
            <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">{summary}</pre>
          ) : (
            <p className="text-xs text-muted-foreground">Click Generate Summary to produce a formal AI case summary for HR/legal records.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Shared table ----------

function DisputeTable({
  rows,
  loading,
  showEmployer,
  showActions,
  showDetail,
  onAccept,
  onReject,
}: {
  rows: Dispute[];
  loading: boolean;
  showEmployer: boolean;
  showActions: boolean;
  showDetail?: boolean;
  onAccept?: (d: Dispute) => void;
  onReject?: (d: Dispute) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { currentRole } = useRole();
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No disputes to show.
      </div>
    );
  }

  const canGenerateSummary = currentRole === "admin" || currentRole === "agency";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border/40">
            {showDetail ? <th className="w-8" /> : null}
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
            {showEmployer ? (
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Employer</th>
            ) : null}
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Month</th>
            <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Expected</th>
            <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Received</th>
            <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Diff</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Submitted</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">AI Severity</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Comment</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Proof</th>
            {showActions ? (
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((d) => {
            const diff = Number(d.expectedAmount ?? 0) - Number(d.receivedAmount ?? 0);
            const isExpanded = expandedId === d.id;
            const rowTint =
              d.status === "Accepted"
                ? "hover:bg-emerald-500/5"
                : d.status === "Rejected"
                  ? "hover:bg-red-500/5"
                  : "hover:bg-amber-500/5";
            const colSpan = [true, showEmployer, true, true, true, true, true, true, true, true, showActions].filter(Boolean).length + (showDetail ? 1 : 0);
            return (
              <>
              <tr key={d.id} className={`transition-colors ${rowTint} ${showDetail ? "cursor-pointer" : ""}`} onClick={() => showDetail && setExpandedId(isExpanded ? null : d.id)}>
                {showDetail ? (
                  <td className="w-8 px-2 py-3 text-muted-foreground">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{d.workerName || d.workerId}</div>
                  {d.workerPassport ? (
                    <div className="text-[11px] text-muted-foreground font-mono">{d.workerPassport}</div>
                  ) : null}
                </td>
                {showEmployer ? (
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {d.employerName || d.employerId}
                  </td>
                ) : null}
                <td className="px-4 py-3 text-foreground">{d.disputeMonth}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatAmount(d.expectedAmount)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatAmount(d.receivedAmount)}</td>
                <td
                  className={`px-4 py-3 text-right tabular-nums font-semibold ${
                    diff > 0 ? "text-red-500" : diff < 0 ? "text-emerald-500" : "text-muted-foreground"
                  }`}
                >
                  {formatAmount(diff)}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(d.submittedAt)}</td>
                <td className="px-4 py-3">
                  <StatusChip status={d.status} />
                </td>
                <td className="px-4 py-3">
                  <SeverityChip severity={d.aiSeverity} score={d.aiSeverityScore} />
                </td>
                <td
                  className="px-4 py-3 text-xs max-w-[220px] truncate text-muted-foreground"
                  title={d.employerComment ?? undefined}
                >
                  {d.employerComment ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {d.hasProof ? (
                    <a
                      href={disputeFileUrl(d.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Paperclip className="w-3 h-3" />
                      View
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                {showActions ? (
                  <td className="px-4 py-3 text-right">
                    {d.status === "Pending" ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => onAccept?.(d)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 text-emerald-500 px-2.5 py-1 text-xs font-semibold hover:bg-emerald-500/10 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Accept
                        </button>
                        <button
                          onClick={() => onReject?.(d)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 text-red-500 px-2.5 py-1 text-xs font-semibold hover:bg-red-500/10 transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Reviewed</span>
                    )}
                  </td>
                ) : null}
              </tr>
              {showDetail && isExpanded && (
                <tr key={`detail-${d.id}`}>
                  <td colSpan={colSpan} className="p-0">
                    <DisputeDetailPanel dispute={d} canGenerateSummary={canGenerateSummary} />
                  </td>
                </tr>
              )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Page entry ----------

export default function DisputePage() {
  const { currentRole } = useRole();

  let body: React.ReactNode;
  let subtitle: string;

  if (currentRole === "worker") {
    subtitle = "Report salary shortfalls and track the outcome.";
    body = <WorkerDisputeView />;
  } else if (currentRole === "employer") {
    subtitle = "Review disputes filed by your workers.";
    body = <EmployerDisputeView />;
  } else if (currentRole === "agency" || currentRole === "admin" || currentRole === "labour") {
    subtitle =
      currentRole === "admin"
        ? "Monitor every dispute across the system."
        : currentRole === "agency"
          ? "Disputes filed by workers under your linked employers."
          : "All disputes across the national workforce.";
    body = <ReadOnlyDisputeView />;
  } else {
    subtitle = "You do not have access to the dispute module.";
    body = (
      <div className="bg-card rounded-2xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
        Your role does not have access to salary disputes.
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Salary Disputes</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {body}
    </DashboardLayout>
  );
}
