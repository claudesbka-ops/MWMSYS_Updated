import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyLeave, decideLeave, getLeaves } from "@/services/hrmsService";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/contexts/RoleContext";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Download } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { downloadCsv, downloadPdfSimpleTable } from "@/lib/exporters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function LeavePage() {
  const { currentRole } = useRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const subscription = useSubscription();

  const { data = [], isLoading } = useQuery({
    queryKey: ["hrms_leave"],
    queryFn: getLeaves,
  });

  const [form, setForm] = useState({
    leaveType: "Annual",
    startDate: null as Date | null,
    endDate: null as Date | null,
  });

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [selectedIds, setSelectedIds] = useState<Record<number, true>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<any | null>(null);

  const applyMut = useMutation({
    mutationFn: applyLeave,
    onSuccess: () => {
      toast.success("Leave submitted");
      setForm({ leaveType: "Annual", startDate: null, endDate: null });
      qc.invalidateQueries({ queryKey: ["hrms_leave"] }).catch(() => undefined);
    },
  });

  const decideMut = useMutation({
    mutationFn: decideLeave,
    onSuccess: () => {
      toast.success("Leave updated");
      qc.invalidateQueries({ queryKey: ["hrms_leave"] }).catch(() => undefined);
    },
  });

  const rows = useMemo(() => {
    return (data ?? []).map((r) => {
      const sd = r.startDate ? new Date(String(r.startDate)).toLocaleDateString() : "";
      const ed = r.endDate ? new Date(String(r.endDate)).toLocaleDateString() : "";
      return { ...r, startFmt: sd, endFmt: ed };
    });
  }, [data]);

  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const byStatus = statusFilter === "__all__" ? rows : rows.filter((r: any) => String(r.status) === statusFilter);
    if (!s) return byStatus;
    return byStatus.filter((r: any) => {
      const hay = `${r.id} ${(r.workerId ?? "").toString()} ${(r.leaveType ?? "").toString()} ${(r.status ?? "").toString()}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q, statusFilter]);

  const pendingIds = useMemo(() => {
    return new Set<number>(
      (filteredRows ?? [])
        .filter((r: any) => String(r.status) === "Pending")
        .map((r: any) => Number(r.id))
        .filter((id: any) => Number.isFinite(id) && id > 0)
    );
  }, [filteredRows]);

  const selectedPendingIds = useMemo(() => {
    return Object.keys(selectedIds)
      .map((k) => Number(k))
      .filter((id) => pendingIds.has(id));
  }, [selectedIds, pendingIds]);

  const allPendingSelected = useMemo(() => {
    if (pendingIds.size === 0) return false;
    for (const id of pendingIds) {
      if (!(selectedIds as any)[id]) return false;
    }
    return true;
  }, [pendingIds, selectedIds]);

  const toggleOne = (id: number, checked: boolean) => {
    if (!Number.isFinite(id) || id <= 0) return;
    setSelectedIds((prev) => {
      const cur = { ...prev } as Record<number, true>;
      if (checked) cur[id] = true;
      else delete cur[id];
      return cur;
    });
  };

  const toggleAllPending = (checked: boolean) => {
    setSelectedIds((prev) => {
      const cur = { ...prev } as Record<number, true>;
      if (checked) {
        for (const id of pendingIds) cur[id] = true;
      } else {
        for (const id of pendingIds) delete cur[id];
      }
      return cur;
    });
  };

  const clearSelection = () => setSelectedIds({});

  const kpis = useMemo(() => {
    const pending = rows.filter((r: any) => String(r.status) === "Pending").length;
    const approved = rows.filter((r: any) => String(r.status) === "Approved").length;
    const rejected = rows.filter((r: any) => String(r.status) === "Rejected").length;
    const total = rows.length;
    return { pending, approved, rejected, total };
  }, [rows]);

  const isWorker = currentRole === "worker";
  const canDecide = currentRole === "admin" || currentRole === "employer" || currentRole === "agency";
  const isWriteLocked = (currentRole === "agency" || currentRole === "employer") && !subscription.hasActivePlan;

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Leave</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Applications and approvals</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const headers = ["Worker", "Type", "Start", "End", "Status"]; 
              const out = rows.map((r) => [
                r.workerId,
                r.leaveType,
                (r as any).startFmt,
                (r as any).endFmt,
                r.status,
              ]);
              downloadCsv(`leave_${new Date().toISOString().slice(0, 10)}.csv`, headers, out);
            }}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const headers = ["Worker", "Type", "Start", "End", "Status"]; 
              const out = rows.map((r) => [
                r.workerId,
                r.leaveType,
                (r as any).startFmt,
                (r as any).endFmt,
                r.status,
              ]);
              downloadPdfSimpleTable(
                `leave_${new Date().toISOString().slice(0, 10)}.pdf`,
                "Leave Applications",
                headers,
                out
              );
            }}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {canDecide && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant={statusFilter === "__all__" ? "default" : "outline"} onClick={() => setStatusFilter("__all__")}>
            All ({kpis.total})
          </Button>
          <Button variant={statusFilter === "Pending" ? "default" : "outline"} onClick={() => setStatusFilter("Pending")}>
            Pending ({kpis.pending})
          </Button>
          <Button variant={statusFilter === "Approved" ? "default" : "outline"} onClick={() => setStatusFilter("Approved")}>
            Approved ({kpis.approved})
          </Button>
          <Button variant={statusFilter === "Rejected" ? "default" : "outline"} onClick={() => setStatusFilter("Rejected")}>
            Rejected ({kpis.rejected})
          </Button>
        </div>
      )}

      {canDecide && (
        <div className="bg-card rounded-2xl border border-border/60 p-4 mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">Search</div>
            <div className="w-full sm:w-[360px]">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search worker/id/type/status" disabled={decideMut.isPending} />
            </div>
          </div>
        </div>
      )}

      {canDecide && isWriteLocked && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Subscription required</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade your plan to approve or reject leave applications.</p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
            >
              Go to Pricing
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{kpis.total}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All leave applications</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl">{kpis.pending}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Awaiting decision</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-2xl">{kpis.approved}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Approved leaves</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rejected</CardDescription>
            <CardTitle className="text-2xl">{kpis.rejected}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Rejected leaves</CardContent>
        </Card>
      </div>

      {isWorker && (
        <div className="bg-card rounded-2xl border border-border/60 p-5 mb-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Apply Leave</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
              className="h-11 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm"
            >
              <option value="Annual">Annual</option>
              <option value="Sick">Sick</option>
              <option value="Emergency">Emergency</option>
            </select>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "h-11 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm flex items-center justify-between",
                    !form.startDate && "text-muted-foreground"
                  )}
                >
                  <span>{form.startDate ? format(form.startDate, "PPP") : "Start date"}</span>
                  <CalendarIcon className="h-4 w-4 opacity-70" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.startDate ?? undefined} onSelect={(d) => setForm((p) => ({ ...p, startDate: d ?? null }))} />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "h-11 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm flex items-center justify-between",
                    !form.endDate && "text-muted-foreground"
                  )}
                >
                  <span>{form.endDate ? format(form.endDate, "PPP") : "End date"}</span>
                  <CalendarIcon className="h-4 w-4 opacity-70" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.endDate ?? undefined} onSelect={(d) => setForm((p) => ({ ...p, endDate: d ?? null }))} />
              </PopoverContent>
            </Popover>
            <button
              onClick={() =>
                applyMut.mutate({
                  leaveType: form.leaveType,
                  startDate: form.startDate ? form.startDate.toISOString().slice(0, 10) : "",
                  endDate: form.endDate ? form.endDate.toISOString().slice(0, 10) : "",
                })
              }
              disabled={applyMut.isPending || !form.startDate || !form.endDate}
              className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          {canDecide && selectedPendingIds.length ? (
            <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Selected: <span className="font-semibold text-foreground">{selectedPendingIds.length}</span> pending item(s)
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  disabled={decideMut.isPending || isWriteLocked}
                  onClick={() => {
                    const ids = selectedPendingIds.slice();
                    ids.forEach((id) => decideMut.mutate({ id, status: "Approved" }));
                    clearSelection();
                  }}
                >
                  Approve Selected
                </Button>
                <Button
                  variant="destructive"
                  disabled={decideMut.isPending || isWriteLocked}
                  onClick={() => {
                    const ids = selectedPendingIds.slice();
                    ids.forEach((id) => decideMut.mutate({ id, status: "Rejected" }));
                    clearSelection();
                  }}
                >
                  Reject Selected
                </Button>
                <Button variant="outline" disabled={decideMut.isPending} onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredRows.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  {canDecide && (
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      <input
                        type="checkbox"
                        disabled={decideMut.isPending || isWriteLocked || pendingIds.size === 0}
                        checked={allPendingSelected}
                        onChange={(e) => toggleAllPending(e.target.checked)}
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Start</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">End</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  {canDecide && (
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    {canDecide && (
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          disabled={decideMut.isPending || isWriteLocked || String((r as any).status) !== "Pending"}
                          checked={!!(selectedIds as any)[(r as any).id]}
                          onChange={(e) => toggleOne((r as any).id, e.target.checked)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{r.workerId}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.leaveType}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{(r as any).startFmt}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{(r as any).endFmt}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${r.status === "Approved" ? "bg-success/10 text-success" : r.status === "Rejected" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                        {r.status}
                      </span>
                    </td>
                    {canDecide && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setDetailRow(r as any);
                              setDetailOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-muted/40 text-foreground text-xs font-semibold"
                          >
                            View
                          </button>
                          <button
                            onClick={() => decideMut.mutate({ id: r.id, status: "Approved" })}
                            disabled={decideMut.isPending || isWriteLocked}
                            className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => decideMut.mutate({ id: r.id, status: "Rejected" })}
                            disabled={decideMut.isPending || isWriteLocked}
                            className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10">
              <div className="max-w-xl">
                <div className="text-base font-semibold text-foreground">No leave applications yet</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {isWorker ? "Apply Leave using the form above." : "When workers Apply Leave, you’ll see and approve them here."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Leave Application #{(detailRow as any)?.id}</DialogTitle>
            <DialogDescription>Review details and approve or reject.</DialogDescription>
          </DialogHeader>

          {detailRow ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Worker</div>
                <div className="font-semibold text-foreground">{(detailRow as any).workerId}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Type</div>
                <div className="font-semibold text-foreground">{(detailRow as any).leaveType}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Start</div>
                <div className="font-semibold text-foreground">{(detailRow as any).startFmt ?? "—"}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">End</div>
                <div className="font-semibold text-foreground">{(detailRow as any).endFmt ?? "—"}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-semibold text-foreground">{String((detailRow as any).status ?? "Pending")}</div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            {detailRow && String((detailRow as any).status ?? "") === "Pending" ? (
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end w-full">
                <Button
                  disabled={decideMut.isPending || isWriteLocked}
                  onClick={() => {
                    decideMut.mutate({ id: (detailRow as any).id, status: "Approved" });
                    setDetailOpen(false);
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  disabled={decideMut.isPending || isWriteLocked}
                  onClick={() => {
                    decideMut.mutate({ id: (detailRow as any).id, status: "Rejected" });
                    setDetailOpen(false);
                  }}
                >
                  Reject
                </Button>
              </div>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
