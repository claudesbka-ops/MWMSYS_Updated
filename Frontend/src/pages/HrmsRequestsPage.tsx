import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";
import { downloadCsv, downloadPdfSimpleTable } from "@/lib/exporters";
import {
  decideExpenseClaim,
  decideOvertimeRequest,
  getExpenseClaims,
  getOvertimeRequests,
  type ExpenseClaimRow,
  type OvertimeRequestRow,
} from "@/services/hrmsService";

type TabKey = "overtime" | "expenses";

export default function HrmsRequestsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overtime");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [q, setQ] = useState<string>("");

  const [selectedIds, setSelectedIds] = useState<Record<TabKey, Record<number, true>>>({
    overtime: {},
    expenses: {},
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<{ type: TabKey; row: OvertimeRequestRow | ExpenseClaimRow } | null>(null);

  const { data: overtime = [], isLoading: otLoading } = useQuery({
    queryKey: ["hrms_overtime"],
    queryFn: getOvertimeRequests,
    enabled: tab === "overtime",
  });

  const { data: expenses = [], isLoading: expLoading } = useQuery({
    queryKey: ["hrms_expenses"],
    queryFn: getExpenseClaims,
    enabled: tab === "expenses",
  });

  const decideOt = useMutation({
    mutationFn: (params: { id: number; status: "Approved" | "Rejected" }) => decideOvertimeRequest(params),
    onSuccess: async () => {
      toast.success("Decision saved");
      await qc.invalidateQueries({ queryKey: ["hrms_overtime"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Unable to save"),
  });

  const decideExp = useMutation({
    mutationFn: (params: { id: number; status: "Approved" | "Rejected" }) => decideExpenseClaim(params),
    onSuccess: async () => {
      toast.success("Decision saved");
      await qc.invalidateQueries({ queryKey: ["hrms_expenses"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Unable to save"),
  });

  const busy = decideOt.isPending || decideExp.isPending;

  const selectedForTab = useMemo(() => {
    return selectedIds[tab] ?? {};
  }, [selectedIds, tab]);

  const filteredOvertime = useMemo(() => {
    const s = q.trim().toLowerCase();
    const byStatus = statusFilter === "__all__" ? overtime : overtime.filter((r) => String(r.status) === statusFilter);
    if (!s) return byStatus;
    return byStatus.filter((r) => {
      const hay = `${r.id} ${(r.workerId ?? "").toString()} ${(r.workerName ?? "").toString()} ${(r.reason ?? "").toString()}`.toLowerCase();
      return hay.includes(s);
    });
  }, [overtime, statusFilter, q]);

  const filteredExpenses = useMemo(() => {
    const s = q.trim().toLowerCase();
    const byStatus = statusFilter === "__all__" ? expenses : expenses.filter((r) => String(r.status) === statusFilter);
    if (!s) return byStatus;
    return byStatus.filter((r) => {
      const hay = `${r.id} ${(r.workerId ?? "").toString()} ${(r.workerName ?? "").toString()} ${(r.category ?? "").toString()} ${(r.description ?? "").toString()}`.toLowerCase();
      return hay.includes(s);
    });
  }, [expenses, statusFilter, q]);

  const statusOptions = ["Pending", "Approved", "Rejected"];

  const tabRows = useMemo(() => {
    return tab === "overtime" ? (filteredOvertime as any[]) : (filteredExpenses as any[]);
  }, [tab, filteredOvertime, filteredExpenses]);

  const pendingIdsForTab = useMemo(() => {
    return new Set<number>(
      (tabRows ?? [])
        .filter((r: any) => String(r.status) === "Pending")
        .map((r: any) => Number(r.id))
        .filter((id: any) => Number.isFinite(id) && id > 0)
    );
  }, [tabRows]);

  const selectedPendingIds = useMemo(() => {
    return Object.keys(selectedForTab)
      .map((k) => Number(k))
      .filter((id) => pendingIdsForTab.has(id));
  }, [selectedForTab, pendingIdsForTab]);

  const allPendingSelected = useMemo(() => {
    if (pendingIdsForTab.size === 0) return false;
    for (const id of pendingIdsForTab) {
      if (!(selectedForTab as any)[id]) return false;
    }
    return true;
  }, [pendingIdsForTab, selectedForTab]);

  const toggleOne = (id: number, checked: boolean) => {
    if (!Number.isFinite(id) || id <= 0) return;
    setSelectedIds((prev) => {
      const cur = { ...(prev[tab] ?? {}) } as Record<number, true>;
      if (checked) cur[id] = true;
      else delete cur[id];
      return { ...prev, [tab]: cur };
    });
  };

  const toggleAllPending = (checked: boolean) => {
    setSelectedIds((prev) => {
      const cur = { ...(prev[tab] ?? {}) } as Record<number, true>;
      if (checked) {
        for (const id of pendingIdsForTab) cur[id] = true;
      } else {
        for (const id of pendingIdsForTab) delete cur[id];
      }
      return { ...prev, [tab]: cur };
    });
  };

  const clearSelection = () => {
    setSelectedIds((prev) => ({ ...prev, [tab]: {} }));
  };

  const kpis = useMemo(() => {
    if (tab === "overtime") {
      const pending = overtime.filter((r) => String(r.status) === "Pending").length;
      const approvedHours = overtime
        .filter((r) => String(r.status) === "Approved")
        .reduce((acc, r) => acc + Number(r.hours ?? 0), 0);
      const rejected = overtime.filter((r) => String(r.status) === "Rejected").length;
      return { pending, approvedHours, rejected };
    }
    const pending = expenses.filter((r) => String(r.status) === "Pending").length;
    const approvedAmount = expenses
      .filter((r) => String(r.status) === "Approved")
      .reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
    const rejected = expenses.filter((r) => String(r.status) === "Rejected").length;
    return { pending, approvedAmount, rejected };
  }, [tab, overtime, expenses]);

  const totalForTab = useMemo(() => {
    return tab === "overtime" ? overtime.length : expenses.length;
  }, [tab, overtime.length, expenses.length]);

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">HRMS Requests</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Overtime and expense approvals</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (tab === "overtime") {
                const headers = ["ID", "Worker", "Name", "Date", "Hours", "Status", "Reason"]; 
                const out = filteredOvertime.map((r) => [r.id, r.workerId, r.workerName ?? "", r.workDate, r.hours, r.status, r.reason ?? ""]);
                downloadCsv(`overtime_${new Date().toISOString().slice(0, 10)}.csv`, headers, out);
              } else {
                const headers = ["ID", "Worker", "Name", "Date", "Amount", "Status", "Category", "Description", "Receipts"]; 
                const out = filteredExpenses.map((r) => [r.id, r.workerId, r.workerName ?? "", r.claimDate, r.amount, r.status, r.category ?? "", r.description ?? "", (r.attachments ?? []).length]);
                downloadCsv(`expenses_${new Date().toISOString().slice(0, 10)}.csv`, headers, out);
              }
            }}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (tab === "overtime") {
                const headers = ["ID", "Worker", "Name", "Date", "Hours", "Status", "Reason"]; 
                const out = filteredOvertime.map((r) => [r.id, r.workerId, r.workerName ?? "", r.workDate, r.hours, r.status, r.reason ?? ""]);
                downloadPdfSimpleTable(`overtime_${new Date().toISOString().slice(0, 10)}.pdf`, "Overtime Requests", headers, out);
              } else {
                const headers = ["ID", "Worker", "Name", "Date", "Amount", "Status", "Category", "Description", "Receipts"]; 
                const out = filteredExpenses.map((r) => [r.id, r.workerId, r.workerName ?? "", r.claimDate, r.amount, r.status, r.category ?? "", r.description ?? "", (r.attachments ?? []).length]);
                downloadPdfSimpleTable(`expenses_${new Date().toISOString().slice(0, 10)}.pdf`, "Expense Claims", headers, out);
              }
            }}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button variant={tab === "overtime" ? "default" : "outline"} onClick={() => setTab("overtime")}>
            Overtime
          </Button>
          <Button variant={tab === "expenses" ? "default" : "outline"} onClick={() => setTab("expenses")}>
            Expenses
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant={statusFilter === "__all__" ? "default" : "outline"} disabled={busy} onClick={() => setStatusFilter("__all__")}>
          All ({totalForTab})
        </Button>
        <Button variant={statusFilter === "Pending" ? "default" : "outline"} disabled={busy} onClick={() => setStatusFilter("Pending")}>
          Pending ({(kpis as any).pending ?? 0})
        </Button>
        <Button variant={statusFilter === "Approved" ? "default" : "outline"} disabled={busy} onClick={() => setStatusFilter("Approved")}>
          Approved
        </Button>
        <Button variant={statusFilter === "Rejected" ? "default" : "outline"} disabled={busy} onClick={() => setStatusFilter("Rejected")}>
          Rejected ({(kpis as any).rejected ?? 0})
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl">{(kpis as any).pending ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Items awaiting approval</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{tab === "overtime" ? "Approved hours" : "Approved amount"}</CardDescription>
            <CardTitle className="text-2xl">
              {tab === "overtime" ? `${Number((kpis as any).approvedHours ?? 0).toFixed(1)}h` : Number((kpis as any).approvedAmount ?? 0).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Approved totals</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rejected</CardDescription>
            <CardTitle className="text-2xl">{(kpis as any).rejected ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Rejected totals</CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">Filters</div>
          <div className="w-full sm:flex sm:items-center sm:justify-end sm:gap-3">
            <div className="relative w-full sm:w-[320px]">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search worker/name/id" className="pl-9" disabled={busy} />
            </div>
            <div className="w-full sm:w-60 mt-3 sm:mt-0">
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={busy}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          {selectedPendingIds.length ? (
            <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Selected: <span className="font-semibold text-foreground">{selectedPendingIds.length}</span> pending item(s)
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  disabled={busy}
                  onClick={() => {
                    const ids = selectedPendingIds.slice();
                    if (!ids.length) return;
                    if (tab === "overtime") ids.forEach((id) => decideOt.mutate({ id, status: "Approved" }));
                    else ids.forEach((id) => decideExp.mutate({ id, status: "Approved" }));
                    clearSelection();
                  }}
                >
                  Approve Selected
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    const ids = selectedPendingIds.slice();
                    if (!ids.length) return;
                    if (tab === "overtime") ids.forEach((id) => decideOt.mutate({ id, status: "Rejected" }));
                    else ids.forEach((id) => decideExp.mutate({ id, status: "Rejected" }));
                    clearSelection();
                  }}
                >
                  Reject Selected
                </Button>
                <Button variant="outline" disabled={busy} onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          ) : null}

          {tab === "overtime" ? (
            otLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              filteredOvertime.length ? (
                <OvertimeTable
                  rows={filteredOvertime}
                  busy={busy}
                  onDecide={(id, status) => decideOt.mutate({ id, status })}
                  onView={(row) => {
                    setDetail({ type: "overtime", row });
                    setDetailOpen(true);
                  }}
                  selected={selectedForTab}
                  onToggleOne={toggleOne}
                  onToggleAllPending={toggleAllPending}
                  allPendingSelected={allPendingSelected}
                  pendingIds={pendingIdsForTab}
                />
              ) : (
                <div className="p-10">
                  <div className="max-w-xl">
                    <div className="text-base font-semibold text-foreground">No overtime requests found</div>
                    <div className="text-sm text-muted-foreground mt-1">Try changing the status filter or check again later.</div>
                  </div>
                </div>
              )
            )
          ) : expLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            filteredExpenses.length ? (
              <ExpensesTable
                rows={filteredExpenses}
                busy={busy}
                onDecide={(id, status) => decideExp.mutate({ id, status })}
                onView={(row) => {
                  setDetail({ type: "expenses", row });
                  setDetailOpen(true);
                }}
                selected={selectedForTab}
                onToggleOne={toggleOne}
                onToggleAllPending={toggleAllPending}
                allPendingSelected={allPendingSelected}
                pendingIds={pendingIdsForTab}
              />
            ) : (
              <div className="p-10">
                <div className="max-w-xl">
                  <div className="text-base font-semibold text-foreground">No expense claims found</div>
                  <div className="text-sm text-muted-foreground mt-1">Try changing the status filter or check again later.</div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detail?.type === "overtime" ? "Overtime Request" : "Expense Claim"} #{(detail?.row as any)?.id}
            </DialogTitle>
            <DialogDescription>Review details and approve or reject.</DialogDescription>
          </DialogHeader>

          {detail?.type === "overtime" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Worker</div>
                <div className="font-semibold text-foreground">{(detail.row as any).workerName ?? (detail.row as any).workerId}</div>
                <div className="text-xs text-muted-foreground font-mono">{(detail.row as any).workerId}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Work date</div>
                <div className="font-semibold text-foreground">
                  {(detail.row as any).workDate ? new Date(String((detail.row as any).workDate)).toLocaleDateString() : "—"}
                </div>
                <div className="text-xs text-muted-foreground">Hours: {(detail.row as any).hours}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Reason</div>
                <div className="text-foreground">{(detail.row as any).reason ?? "—"}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-semibold text-foreground">{String((detail.row as any).status ?? "Pending")}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Decision</div>
                <div className="text-foreground text-sm">
                  {(detail.row as any).decisionBy ? `By ${(detail.row as any).decisionBy}` : "—"}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Worker</div>
                <div className="font-semibold text-foreground">{(detail?.row as any).workerName ?? (detail?.row as any).workerId}</div>
                <div className="text-xs text-muted-foreground font-mono">{(detail?.row as any).workerId}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Claim date</div>
                <div className="font-semibold text-foreground">
                  {(detail?.row as any).claimDate ? new Date(String((detail?.row as any).claimDate)).toLocaleDateString() : "—"}
                </div>
                <div className="text-xs text-muted-foreground">Amount: {Number((detail?.row as any).amount ?? 0).toFixed(2)}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Category</div>
                <div className="text-foreground">{(detail?.row as any).category ?? "—"}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-semibold text-foreground">{String((detail?.row as any).status ?? "Pending")}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Description</div>
                <div className="text-foreground">{(detail?.row as any).description ?? "—"}</div>
              </div>
              <div className="rounded-xl border border-border/60 p-3 sm:col-span-2">
                <div className="text-xs text-muted-foreground">Receipts</div>
                {(detail?.row as any).attachments?.length ? (
                  <div className="flex flex-col gap-1 mt-1">
                    {((detail?.row as any).attachments ?? []).map((a: any) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {a.originalName ?? "receipt"}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mt-1">No receipts attached</div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {String((detail?.row as any)?.status ?? "") === "Pending" ? (
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end w-full">
                <Button
                  disabled={busy}
                  onClick={() => {
                    const id = Number((detail?.row as any)?.id ?? 0);
                    if (!id) return;
                    if (detail?.type === "overtime") decideOt.mutate({ id, status: "Approved" });
                    else decideExp.mutate({ id, status: "Approved" });
                    setDetailOpen(false);
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    const id = Number((detail?.row as any)?.id ?? 0);
                    if (!id) return;
                    if (detail?.type === "overtime") decideOt.mutate({ id, status: "Rejected" });
                    else decideExp.mutate({ id, status: "Rejected" });
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

function OvertimeTable({
  rows,
  busy,
  onDecide,
  onView,
  selected,
  onToggleOne,
  onToggleAllPending,
  allPendingSelected,
  pendingIds,
}: {
  rows: OvertimeRequestRow[];
  busy: boolean;
  onDecide: (id: number, status: "Approved" | "Rejected") => void;
  onView: (row: OvertimeRequestRow) => void;
  selected: Record<number, true>;
  onToggleOne: (id: number, checked: boolean) => void;
  onToggleAllPending: (checked: boolean) => void;
  allPendingSelected: boolean;
  pendingIds: Set<number>;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/30 border-b border-border/40">
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            <input
              type="checkbox"
              disabled={busy || pendingIds.size === 0}
              checked={allPendingSelected}
              onChange={(e) => onToggleAllPending(e.target.checked)}
            />
          </th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Date</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Hours</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Reason</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-muted/20 transition-colors">
            <td className="px-4 py-3.5">
              <input
                type="checkbox"
                disabled={busy || String(r.status) !== "Pending"}
                checked={!!(selected as any)[r.id]}
                onChange={(e) => onToggleOne(r.id, e.target.checked)}
              />
            </td>
            <td className="px-4 py-3.5">
              <div className="font-medium text-foreground">{r.workerName ?? r.workerId}</div>
              <div className="text-xs text-muted-foreground font-mono">{r.workerId}</div>
            </td>
            <td className="px-4 py-3.5 text-muted-foreground">{r.workDate ? new Date(String(r.workDate)).toLocaleDateString() : "—"}</td>
            <td className="px-4 py-3.5 text-muted-foreground">{r.hours}</td>
            <td className="px-4 py-3.5 text-muted-foreground max-w-[360px] truncate">{r.reason ?? "—"}</td>
            <td className="px-4 py-3.5">
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                  r.status === "Approved" ? "bg-success/10 text-success" : r.status === "Rejected" ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {r.status}
              </span>
            </td>
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onView(r)}>
                  View
                </Button>
                <Button size="sm" disabled={busy || r.status !== "Pending"} onClick={() => onDecide(r.id, "Approved")}>Approve</Button>
                <Button size="sm" variant="destructive" disabled={busy || r.status !== "Pending"} onClick={() => onDecide(r.id, "Rejected")}>
                  Reject
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExpensesTable({
  rows,
  busy,
  onDecide,
  onView,
  selected,
  onToggleOne,
  onToggleAllPending,
  allPendingSelected,
  pendingIds,
}: {
  rows: ExpenseClaimRow[];
  busy: boolean;
  onDecide: (id: number, status: "Approved" | "Rejected") => void;
  onView: (row: ExpenseClaimRow) => void;
  selected: Record<number, true>;
  onToggleOne: (id: number, checked: boolean) => void;
  onToggleAllPending: (checked: boolean) => void;
  allPendingSelected: boolean;
  pendingIds: Set<number>;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/30 border-b border-border/40">
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            <input
              type="checkbox"
              disabled={busy || pendingIds.size === 0}
              checked={allPendingSelected}
              onChange={(e) => onToggleAllPending(e.target.checked)}
            />
          </th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Date</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Category</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Description</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Receipts</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-muted/20 transition-colors">
            <td className="px-4 py-3.5">
              <input
                type="checkbox"
                disabled={busy || String(r.status) !== "Pending"}
                checked={!!(selected as any)[r.id]}
                onChange={(e) => onToggleOne(r.id, e.target.checked)}
              />
            </td>
            <td className="px-4 py-3.5">
              <div className="font-medium text-foreground">{r.workerName ?? r.workerId}</div>
              <div className="text-xs text-muted-foreground font-mono">{r.workerId}</div>
            </td>
            <td className="px-4 py-3.5 text-muted-foreground">{r.claimDate ? new Date(String(r.claimDate)).toLocaleDateString() : "—"}</td>
            <td className="px-4 py-3.5 text-muted-foreground">{Number(r.amount ?? 0).toFixed(2)}</td>
            <td className="px-4 py-3.5 text-muted-foreground">{r.category ?? "—"}</td>
            <td className="px-4 py-3.5 text-muted-foreground max-w-[360px] truncate">{r.description ?? "—"}</td>
            <td className="px-4 py-3.5 text-muted-foreground text-xs">
              {(r.attachments ?? []).length ? (
                <div className="flex flex-col gap-1">
                  {(r.attachments ?? []).slice(0, 2).map((a) => (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="underline">
                      {a.originalName ?? "receipt"}
                    </a>
                  ))}
                  {(r.attachments ?? []).length > 2 ? <span className="text-xs text-muted-foreground">+{(r.attachments ?? []).length - 2} more</span> : null}
                </div>
              ) : (
                "—"
              )}
            </td>
            <td className="px-4 py-3.5">
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                  r.status === "Approved" ? "bg-success/10 text-success" : r.status === "Rejected" ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {r.status}
              </span>
            </td>
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onView(r)}>
                  View
                </Button>
                <Button size="sm" disabled={busy || r.status !== "Pending"} onClick={() => onDecide(r.id, "Approved")}>Approve</Button>
                <Button size="sm" variant="destructive" disabled={busy || r.status !== "Pending"} onClick={() => onDecide(r.id, "Rejected")}>
                  Reject
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
