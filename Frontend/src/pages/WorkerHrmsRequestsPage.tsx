import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { downloadCsv, downloadPdfSimpleTable } from "@/lib/exporters";
import {
  getMyExpenseClaims,
  getMyOvertimeRequests,
  submitExpenseClaim,
  uploadExpenseAttachments,
  submitOvertimeRequest,
  type ExpenseClaimRow,
  type OvertimeRequestRow,
} from "@/services/hrmsService";

type TabKey = "overtime" | "expenses";

export default function WorkerHrmsRequestsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overtime");

  // Overtime form
  const [otDate, setOtDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [otHours, setOtHours] = useState<string>("1");
  const [otReason, setOtReason] = useState<string>("");

  // Expense form
  const [exDate, setExDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [exAmount, setExAmount] = useState<string>("");
  const [exCategory, setExCategory] = useState<string>("");
  const [exDesc, setExDesc] = useState<string>("");
  const [exFiles, setExFiles] = useState<File[]>([]);

  const otQuery = useQuery({
    queryKey: ["hrms_worker_overtime"],
    queryFn: getMyOvertimeRequests,
  });

  const exQuery = useQuery({
    queryKey: ["hrms_worker_expenses"],
    queryFn: getMyExpenseClaims,
  });

  const submitOt = useMutation({
    mutationFn: async () => {
      const hours = Number(otHours);
      if (!Number.isFinite(hours) || hours <= 0) throw new Error("Hours must be > 0");
      return submitOvertimeRequest({
        workDate: otDate.toISOString(),
        hours,
        reason: otReason || undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Overtime request submitted");
      setOtReason("");
      await qc.invalidateQueries({ queryKey: ["hrms_worker_overtime"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? e?.message ?? "Unable to submit"),
  });

  const submitEx = useMutation({
    mutationFn: async () => {
      const amount = Number(exAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be > 0");
      const claim = await submitExpenseClaim({
        claimDate: exDate.toISOString(),
        amount,
        category: exCategory || undefined,
        description: exDesc || undefined,
      });

      const claimId = Number((claim as any)?.id ?? 0);
      if (exFiles.length && Number.isFinite(claimId) && claimId > 0) {
        await uploadExpenseAttachments({ claimId, files: exFiles });
      }
      return claim;
    },
    onSuccess: async () => {
      toast.success("Expense claim submitted");
      setExAmount("");
      setExCategory("");
      setExDesc("");
      setExFiles([]);
      await qc.invalidateQueries({ queryKey: ["hrms_worker_expenses"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? e?.message ?? "Unable to submit"),
  });

  const busy = submitOt.isPending || submitEx.isPending;

  const overtime = (otQuery.data ?? []) as OvertimeRequestRow[];
  const expenses = (exQuery.data ?? []) as ExpenseClaimRow[];

  const kpis = useMemo(() => {
    const pendingOt = overtime.filter((r) => String(r.status) === "Pending").length;
    const approvedOt = overtime.filter((r) => String(r.status) === "Approved").reduce((acc, r) => acc + Number(r.hours ?? 0), 0);
    const pendingExp = expenses.filter((r) => String(r.status) === "Pending").length;
    const approvedExp = expenses.filter((r) => String(r.status) === "Approved").reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
    return { pendingOt, approvedOt, pendingExp, approvedExp };
  }, [overtime, expenses]);

  const exportRows = () => {
    if (tab === "overtime") {
      const headers = ["ID", "Date", "Hours", "Status", "Reason"]; 
      const out = overtime.map((r) => [r.id, r.workDate, r.hours, r.status, r.reason ?? ""]);
      return { title: "My Overtime Requests", filename: "my_overtime", headers, out };
    }
    const headers = ["ID", "Date", "Amount", "Status", "Category", "Description"]; 
    const out = expenses.map((r) => [r.id, r.claimDate, r.amount, r.status, r.category ?? "", r.description ?? ""]);
    return { title: "My Expense Claims", filename: "my_expenses", headers, out };
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">My Requests</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Submit and track overtime & expense claims</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={busy} onClick={() => {
            const e = exportRows();
            downloadCsv(`${e.filename}_${new Date().toISOString().slice(0, 10)}.csv`, e.headers, e.out);
          }}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => {
            const e = exportRows();
            downloadPdfSimpleTable(`${e.filename}_${new Date().toISOString().slice(0, 10)}.pdf`, e.title, e.headers, e.out);
          }}>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending overtime</CardDescription>
            <CardTitle className="text-2xl">{kpis.pendingOt}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Awaiting approval</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved overtime</CardDescription>
            <CardTitle className="text-2xl">{kpis.approvedOt.toFixed(1)}h</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Total approved hours</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending expenses</CardDescription>
            <CardTitle className="text-2xl">{kpis.pendingExp}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Awaiting approval</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved expenses</CardDescription>
            <CardTitle className="text-2xl">{kpis.approvedExp.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Total approved amount</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border/60 p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">Submit {tab === "overtime" ? "Overtime" : "Expense"}</h3>

          {tab === "overtime" ? (
            <div className="space-y-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start")} disabled={busy}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(otDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={otDate} onSelect={(d) => d && setOtDate(d)} />
                </PopoverContent>
              </Popover>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Hours</div>
                <Input value={otHours} onChange={(e) => setOtHours(e.target.value)} placeholder="e.g. 2" disabled={busy} />
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reason</div>
                <Input value={otReason} onChange={(e) => setOtReason(e.target.value)} placeholder="Optional" disabled={busy} />
              </div>

              <Button disabled={busy} onClick={() => submitOt.mutate()}>
                Submit Overtime
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start")} disabled={busy}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(exDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={exDate} onSelect={(d) => d && setExDate(d)} />
                </PopoverContent>
              </Popover>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Amount</div>
                <Input value={exAmount} onChange={(e) => setExAmount(e.target.value)} placeholder="e.g. 50" disabled={busy} />
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Category</div>
                <Input value={exCategory} onChange={(e) => setExCategory(e.target.value)} placeholder="e.g. Transport" disabled={busy} />
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</div>
                <Input value={exDesc} onChange={(e) => setExDesc(e.target.value)} placeholder="Optional" disabled={busy} />
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Receipts</div>
                <Input
                  type="file"
                  multiple
                  disabled={busy}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setExFiles(files);
                  }}
                />
                <div className="text-xs text-muted-foreground mt-1">{exFiles.length ? `${exFiles.length} file(s) selected` : "Optional"}</div>
              </div>

              <Button disabled={busy} onClick={() => submitEx.mutate()}>
                Submit Expense
              </Button>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h3 className="text-sm font-bold text-foreground">History</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Track your submission status</p>
          </div>

          <div className="overflow-x-auto">
            {tab === "overtime" ? (
              <HistoryOvertime rows={overtime} loading={otQuery.isLoading} />
            ) : (
              <HistoryExpenses rows={expenses} loading={exQuery.isLoading} />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = (status ?? "").toString();
  const cls =
    s === "Approved"
      ? "bg-success/10 text-success"
      : s === "Rejected"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted/50 text-muted-foreground";
  return <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${cls}`}>{s || "Pending"}</span>;
}

function HistoryOvertime({ rows, loading }: { rows: OvertimeRequestRow[]; loading: boolean }) {
  const data = useMemo(() => rows ?? [], [rows]);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/30 border-b border-border/40">
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Date</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Hours</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Reason</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {loading ? (
          <tr>
            <td className="px-4 py-4 text-muted-foreground text-xs" colSpan={4}>
              Loading...
            </td>
          </tr>
        ) : data.length ? (
          data.map((r) => (
            <tr key={r.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.workDate ? new Date(String(r.workDate)).toLocaleDateString() : "—"}</td>
              <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.hours}</td>
              <td className="px-4 py-3.5 text-muted-foreground text-xs max-w-[260px] truncate">{r.reason ?? "—"}</td>
              <td className="px-4 py-3.5">
                <StatusPill status={String(r.status ?? "Pending")} />
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-4 py-4 text-muted-foreground text-xs" colSpan={4}>
              No overtime requests yet. Submit one from the form to start tracking approvals.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function HistoryExpenses({ rows, loading }: { rows: ExpenseClaimRow[]; loading: boolean }) {
  const data = useMemo(() => rows ?? [], [rows]);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/30 border-b border-border/40">
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Date</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Category</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Receipts</th>
          <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {loading ? (
          <tr>
            <td className="px-4 py-4 text-muted-foreground text-xs" colSpan={5}>
              Loading...
            </td>
          </tr>
        ) : data.length ? (
          data.map((r) => (
            <tr key={r.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.claimDate ? new Date(String(r.claimDate)).toLocaleDateString() : "—"}</td>
              <td className="px-4 py-3.5 text-muted-foreground text-xs">{Number(r.amount ?? 0).toFixed(2)}</td>
              <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.category ?? "—"}</td>
              <td className="px-4 py-3.5 text-muted-foreground text-xs">
                {(r.attachments ?? []).length ? (
                  <div className="flex flex-col gap-1">
                    {(r.attachments ?? []).slice(0, 3).map((a) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="underline">
                        {a.originalName ?? "receipt"}
                      </a>
                    ))}
                    {(r.attachments ?? []).length > 3 ? <span className="text-xs text-muted-foreground">+{(r.attachments ?? []).length - 3} more</span> : null}
                  </div>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3.5">
                <StatusPill status={String(r.status ?? "Pending")} />
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-4 py-4 text-muted-foreground text-xs" colSpan={5}>
              No expense claims yet. Add an expense and attach receipts (optional).
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
