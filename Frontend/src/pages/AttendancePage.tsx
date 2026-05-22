import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { getAttendance, getOvertimeSummary, type OvertimeSummaryRow } from "@/services/hrmsService";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";
import { downloadCsv, downloadPdfSimpleTable } from "@/lib/exporters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { AttendanceSummary } from "@/components/attendance/AttendanceSummary";

const MONTHLY_OT_LIMIT = 104;

function OvertimeTab() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const { data = [], isLoading } = useQuery({
    queryKey: ["overtime_summary", month],
    queryFn: () => getOvertimeSummary({ month }),
  });

  const rows = (data ?? []) as OvertimeSummaryRow[];

  const handleExportCsv = () => {
    const headers = ["Worker ID", "Name", "Regular Hrs", "Overtime Hrs", "Weekend Hrs", "Total Hrs"];
    const out = rows.map((r) => [
      r.workerId,
      r.name ?? "",
      r.regularHours.toFixed(2),
      r.overtimeHours.toFixed(2),
      r.weekendHours.toFixed(2),
      r.totalHours.toFixed(2),
    ]);
    downloadCsv(`overtime_${month}.csv`, headers, out);
  };

  const totalOt = rows.reduce((s, r) => s + r.overtimeHours + r.weekendHours, 0);
  const nearLimit = rows.filter((r) => r.overtimeHours + r.weekendHours >= MONTHLY_OT_LIMIT * 0.8).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Month</label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40 h-9 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Workers with overtime</CardDescription>
            <CardTitle className="text-2xl">{rows.filter((r) => r.overtimeHours + r.weekendHours > 0).length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">This month</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total overtime hours</CardDescription>
            <CardTitle className="text-2xl">{totalOt.toFixed(1)}h</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Weekday OT + weekend</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Near 104h limit</CardDescription>
            <CardTitle className={`text-2xl ${nearLimit > 0 ? "text-red-500" : ""}`}>{nearLimit}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">≥80% of monthly cap</CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Regular Hrs</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Overtime Hrs</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Weekend Hrs</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Total Hrs</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">OT Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r) => {
                  const ot = r.overtimeHours + r.weekendHours;
                  const pct = Math.min(100, Math.round((ot / MONTHLY_OT_LIMIT) * 100));
                  const atLimit = ot >= MONTHLY_OT_LIMIT;
                  const nearLimitRow = ot >= MONTHLY_OT_LIMIT * 0.8;
                  return (
                    <tr key={r.workerId} className={`transition-colors ${atLimit ? "bg-red-500/5" : nearLimitRow ? "bg-amber-500/5" : "hover:bg-muted/20"}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{r.name ?? r.workerId}</div>
                        {r.name && <div className="text-[11px] text-muted-foreground font-mono">{r.workerId}</div>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.regularHours.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        <span className={r.overtimeHours > 0 ? "text-amber-500" : "text-muted-foreground"}>
                          {r.overtimeHours.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        <span className={r.weekendHours > 0 ? "text-blue-500" : "text-muted-foreground"}>
                          {r.weekendHours.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">{r.totalHours.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-1.5 max-w-[80px]">
                            <div
                              className={`h-1.5 rounded-full transition-all ${atLimit ? "bg-red-500" : nearLimitRow ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-[11px] font-semibold tabular-nums ${atLimit ? "text-red-500" : nearLimitRow ? "text-amber-500" : "text-muted-foreground"}`}>
                            {ot.toFixed(0)}/{MONTHLY_OT_LIMIT}h
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-sm text-muted-foreground">No overtime data for this month.</div>
        )}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<"attendance" | "overtime">("attendance");

  const { data = [], isLoading } = useQuery({
    queryKey: ["hrms_attendance"],
    queryFn: getAttendance,
  });

  const rows = useMemo(() => {
    return (data ?? []).map((r) => {
      const checkIn = r.checkIn ? new Date(String(r.checkIn)).toLocaleString() : "";
      const checkOut = r.checkOut ? new Date(String(r.checkOut)).toLocaleString() : "";
      return {
        ...r,
        checkInFmt: checkIn,
        checkOutFmt: checkOut || "—",
      };
    });
  }, [data]);

  const totalWorkedHours = useMemo(() => {
    return rows.reduce((acc: number, r: any) => acc + Number(r.workedHours ?? 0), 0);
  }, [rows]);

  const lateCount = useMemo(() => {
    return rows.filter((r: any) => Number(r.lateMinutes ?? 0) > 0).length;
  }, [rows]);

  const earlyCount = useMemo(() => {
    return rows.filter((r: any) => Number(r.earlyLeaveMinutes ?? 0) > 0).length;
  }, [rows]);

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Attendance</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Clock-in/out records &amp; overtime tracking</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const headers = ["Worker", "Check In", "Check Out", "Worked Hours", "Late (min)", "Early Leave (min)", "Lat", "Lng"]; 
              const out = rows.map((r) => [
                r.workerId,
                r.checkInFmt,
                r.checkOutFmt,
                r.workedHours != null ? Number(r.workedHours).toFixed(2) : "",
                r.lateMinutes ?? "",
                r.earlyLeaveMinutes ?? "",
                r.lat ?? "",
                r.lng ?? "",
              ]);
              downloadCsv(`attendance_${new Date().toISOString().slice(0, 10)}.csv`, headers, out);
            }}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const headers = ["Worker", "Check In", "Check Out", "Worked Hours", "Late (min)", "Early Leave (min)", "Lat", "Lng"]; 
              const out = rows.map((r) => [
                r.workerId,
                r.checkInFmt,
                r.checkOutFmt,
                r.workedHours != null ? Number(r.workedHours).toFixed(2) : "",
                r.lateMinutes ?? "",
                r.earlyLeaveMinutes ?? "",
                r.lat ?? "",
                r.lng ?? "",
              ]);
              downloadPdfSimpleTable(
                `attendance_${new Date().toISOString().slice(0, 10)}.pdf`,
                "Attendance",
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

      <div className="flex gap-1 mb-5 border-b border-border/60">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "attendance" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Records
        </button>
        <button
          onClick={() => setActiveTab("overtime")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "overtime" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Overtime
        </button>
      </div>

      {activeTab === "overtime" ? <OvertimeTab /> : null}

      {activeTab === "attendance" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Records</CardDescription>
                <CardTitle className="text-2xl">{rows.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Total clock-in/out rows</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total worked</CardDescription>
                <CardTitle className="text-2xl">{totalWorkedHours.toFixed(1)}h</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Sum of worked hours</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Late arrivals</CardDescription>
                <CardTitle className="text-2xl">{lateCount}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Rows with late minutes</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Early leaves</CardDescription>
                <CardTitle className="text-2xl">{earlyCount}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Rows with early leave minutes</CardContent>
            </Card>
          </div>

          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : rows.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/40">
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Check In</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Check Out</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worked</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Late</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Early</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">GPS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{r.workerId}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.checkInFmt}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.checkOutFmt}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.workedHours != null ? Number(r.workedHours).toFixed(2) : "—"}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.lateMinutes ? `${r.lateMinutes}m` : "—"}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.earlyLeaveMinutes ? `${r.earlyLeaveMinutes}m` : "—"}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">
                          {r.lat != null && r.lng != null ? `${r.lat}, ${r.lng}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-10">
                  <div className="max-w-xl">
                    <div className="text-base font-semibold text-foreground">No attendance records yet</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Once workers clock in/out, you'll see time and GPS records here.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
