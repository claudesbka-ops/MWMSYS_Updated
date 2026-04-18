import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { getAttendance } from "@/services/hrmsService";
import { Skeleton } from "@/components/ui/skeleton";

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
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{r.workerId}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.checkInFmt}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.checkOutFmt}</td>
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
