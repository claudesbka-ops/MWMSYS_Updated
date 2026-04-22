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
import { getTimesheets, type TimesheetSummaryRow } from "@/services/timesheetsService";

export default function TimesheetsPage() {
  const [range, setRange] = useState<{ from: Date; to: Date }>(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    return { from, to };
  });

  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["hrms_timesheets", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => getTimesheets({ from: range.from.toISOString(), to: range.to.toISOString() }),
  });

  const rows = useMemo(() => {
    const base = (query.data?.rows ?? []) as TimesheetSummaryRow[];
    const s = q.trim().toLowerCase();
    if (!s) return base;
    return base.filter((r) => {
      return (r.workerId ?? "").toLowerCase().includes(s) || (r.name ?? "").toLowerCase().includes(s);
    });
  }, [q, query.data]);

  const kpis = useMemo(() => {
    const workerCount = rows.length;
    const planned = rows.reduce((acc, r) => acc + Number(r.plannedHours ?? 0), 0);
    const actual = rows.reduce((acc, r) => acc + Number(r.actualHours ?? 0), 0);
    const overtime = rows.reduce((acc, r) => acc + Number(r.overtimeHours ?? 0), 0);
    const days = rows.reduce((acc, r) => acc + Number(r.days ?? 0), 0);
    return { workerCount, planned, actual, overtime, days };
  }, [rows]);

  const exportRows = () => {
    const headers = ["Worker", "Name", "Planned", "Actual", "Overtime", "Days"]; 
    const out = rows.map((r) => [
      r.workerId,
      r.name ?? "",
      r.plannedHours,
      r.actualHours,
      r.overtimeHours,
      r.days,
    ]);
    return { headers, out };
  };

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Timesheets</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Planned vs actual hours and overtime</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const { headers, out } = exportRows();
              downloadCsv(`timesheets_${new Date().toISOString().slice(0, 10)}.csv`, headers, out);
            }}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const { headers, out } = exportRows();
              downloadPdfSimpleTable(
                `timesheets_${new Date().toISOString().slice(0, 10)}.pdf`,
                "Timesheets",
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

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <div className="bg-card rounded-2xl border border-border/60 p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">Filters</h3>

          <div className="space-y-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start")}>
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
                <CardDescription>Planned hours</CardDescription>
                <CardTitle className="text-2xl">{kpis.planned.toFixed(1)}h</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Sum of planned hours</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Actual hours</CardDescription>
                <CardTitle className="text-2xl">{kpis.actual.toFixed(1)}h</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Sum of actual hours</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Overtime hours</CardDescription>
                <CardTitle className="text-2xl">{kpis.overtime.toFixed(1)}h</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Sum of overtime hours</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Worker-days</CardDescription>
                <CardTitle className="text-2xl">{kpis.days}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Total days counted</CardContent>
            </Card>
          </div>

          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            {query.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : query.isError ? (
              <div className="p-6 text-sm text-muted-foreground">Unable to load timesheets</div>
            ) : rows.length ? (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/40">
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Planned</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actual</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Overtime</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {rows.map((r) => (
                      <tr key={r.workerId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="text-sm font-semibold text-foreground">{r.name ?? r.workerId}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{r.workerId}</div>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{Number(r.plannedHours ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{Number(r.actualHours ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[11px] font-semibold",
                              (r.overtimeHours ?? 0) > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                            )}
                          >
                            {Number(r.overtimeHours ?? 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10">
                <div className="max-w-xl">
                  <div className="text-base font-semibold text-foreground">No timesheet data in this range</div>
                  <div className="text-sm text-muted-foreground mt-1">Try expanding the date range or clearing the search filter.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
