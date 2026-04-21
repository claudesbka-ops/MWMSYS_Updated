import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download } from "lucide-react";
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

  const filteredOvertime = useMemo(() => {
    if (statusFilter === "__all__") return overtime;
    return overtime.filter((r) => String(r.status) === statusFilter);
  }, [overtime, statusFilter]);

  const filteredExpenses = useMemo(() => {
    if (statusFilter === "__all__") return expenses;
    return expenses.filter((r) => String(r.status) === statusFilter);
  }, [expenses, statusFilter]);

  const statusOptions = ["Pending", "Approved", "Rejected"];

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

      <div className="bg-card rounded-2xl border border-border/60 p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">Filters</div>
          <div className="w-full sm:w-60">
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

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          {tab === "overtime" ? (
            otLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <OvertimeTable
                rows={filteredOvertime}
                busy={busy}
                onDecide={(id, status) => decideOt.mutate({ id, status })}
              />
            )
          ) : expLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <ExpensesTable rows={filteredExpenses} busy={busy} onDecide={(id, status) => decideExp.mutate({ id, status })} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function OvertimeTable({
  rows,
  busy,
  onDecide,
}: {
  rows: OvertimeRequestRow[];
  busy: boolean;
  onDecide: (id: number, status: "Approved" | "Rejected") => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/30 border-b border-border/40">
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
}: {
  rows: ExpenseClaimRow[];
  busy: boolean;
  onDecide: (id: number, status: "Approved" | "Rejected") => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/30 border-b border-border/40">
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
