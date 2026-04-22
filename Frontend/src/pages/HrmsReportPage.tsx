import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { downloadCsv, downloadPdfSimpleTable } from "@/lib/exporters";
import { getHrmsSummary, type HrmsSummaryRow } from "@/services/hrmsService";

export default function HrmsReportPage() {
  const [range, setRange] = useState<{ from: Date; to: Date }>(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 29);
    return { from, to };
  });

  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["hrms_summary", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => getHrmsSummary({ from: range.from.toISOString(), to: range.to.toISOString() }),
  });

  const rows = useMemo(() => {
    const base = (query.data?.rows ?? []) as HrmsSummaryRow[];
    const s = q.trim().toLowerCase();
    if (!s) return base;
    return base.filter((r) => (r.workerId ?? "").toLowerCase().includes(s) || (r.name ?? "").toLowerCase().includes(s));
  }, [q, query.data]);

  const kpis = useMemo(() => {
    const workerCount = rows.length;
    const totalDays = rows.reduce((acc, r) => acc + Number(r.daysPresent ?? 0), 0);
    const totalHours = rows.reduce((acc, r) => acc + Number(r.workedHours ?? 0), 0);
    const totalOtApproved = rows.reduce((acc, r) => acc + Number(r.overtimeApprovedHours ?? 0), 0);
    const totalExpApproved = rows.reduce((acc, r) => acc + Number(r.expenseApproved ?? 0), 0);
    return { workerCount, totalDays, totalHours, totalOtApproved, totalExpApproved };
  }, [rows]);

  const exportRows = () => {
    const headers = [
      "Worker",
      "Name",
      "Days Present",
      "Worked Hours",
      "Late Count",
      "Early Leave Count",
      "OT Requested",
      "OT Approved",
      "Expense Claimed",
      "Expense Approved",
    ];
    const out = rows.map((r) => [
      r.workerId,
      r.name ?? "",
      r.daysPresent,
      r.workedHours,
      r.lateCount,
      r.earlyLeaveCount,
      r.overtimeRequestedHours,
      r.overtimeApprovedHours,
      r.expenseClaimed,
      r.expenseApproved,
    ]);
    return { headers, out };
  };

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">HRMS Report</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Consolidated attendance, overtime and expenses summary</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const { headers, out } = exportRows();
              downloadCsv(`hrms_report_${new Date().toISOString().slice(0, 10)}.csv`, headers, out);
            }}
            disabled={query.isLoading}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const { headers, out } = exportRows();
              downloadPdfSimpleTable(`hrms_report_${new Date().toISOString().slice(0, 10)}.pdf`, "HRMS Report", headers, out);
            }}
            disabled={query.isLoading}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <div className="bg-card rounded-2xl border border-border/60 p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">Filters</h3>

          <div className="space-y-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(range.from, "PPP")} - {format(range.to, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: range.from, to: range.to }}
                  onSelect={(v) => {
                    if (!v?.from || !v?.to) return;
                    setRange({ from: v.from, to: v.to });
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search worker/name" className="pl-9" />
            </div>

            <Button variant="outline" onClick={() => query.refetch().catch(() => undefined)}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Workers</CardDescription>
                <CardTitle className="text-2xl">{kpis.workerCount}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Matched by filters</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Days present</CardDescription>
                <CardTitle className="text-2xl">{kpis.totalDays}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Sum across workers</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Worked hours</CardDescription>
                <CardTitle className="text-2xl">{kpis.totalHours.toFixed(1)}h</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Sum across workers</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>OT approved</CardDescription>
                <CardTitle className="text-2xl">{kpis.totalOtApproved.toFixed(1)}h</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Approved overtime hours</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Expenses approved</CardDescription>
                <CardTitle className="text-2xl">{kpis.totalExpApproved.toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Approved expense amount</CardContent>
            </Card>
          </div>

          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              {rows.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/40">
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Days</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worked</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Late</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Early</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">OT Req</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">OT App</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Exp</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Exp App</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {(rows ?? []).map((r) => (
                      <tr key={r.workerId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{r.workerId}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.name ?? "—"}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.daysPresent}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{Number(r.workedHours ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.lateCount}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.earlyLeaveCount}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{Number(r.overtimeRequestedHours ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{Number(r.overtimeApprovedHours ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{Number(r.expenseClaimed ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{Number(r.expenseApproved ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-10">
                  <div className="max-w-xl">
                    <div className="text-base font-semibold text-foreground">No results for this range</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Try expanding the date range or clearing the search filter.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
