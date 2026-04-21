import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { getAttendance } from "@/services/hrmsService";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadCsv, downloadPdfSimpleTable } from "@/lib/exporters";

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

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
