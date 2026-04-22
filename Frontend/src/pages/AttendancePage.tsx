import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { getAttendance } from "@/services/hrmsService";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadCsv, downloadPdfSimpleTable } from "@/lib/exporters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AttendancePage() {
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
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Attendance</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Clock-in/out records</p>
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
                  Once workers clock in/out, you’ll see time and GPS records here.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
