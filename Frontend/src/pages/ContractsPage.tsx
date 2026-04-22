import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { getContractsExpiring } from "@/services/hrmsService";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContractsPage() {
  const [days, setDays] = useState(90);

  const { data, isLoading } = useQuery({
    queryKey: ["hrms_contracts_expiring", days],
    queryFn: () => getContractsExpiring(days),
  });

  const rows = useMemo(() => {
    return (data?.rows ?? []).map((r) => {
      const exp = r.Contract_Expiry_Date ? new Date(String(r.Contract_Expiry_Date)).toLocaleDateString() : "";
      const iss = r.Contract_issue_Date ? new Date(String(r.Contract_issue_Date)).toLocaleDateString() : "";
      return { ...r, expFmt: exp, issFmt: iss };
    });
  }, [data]);

  const uniqueEmployers = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const n = (r as any).Employer_Name;
      if (n != null && String(n).trim()) s.add(String(n));
    }
    return s.size;
  }, [rows]);

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Contracts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Expiring contracts window</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 90)}
            className="h-11 w-24 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm"
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expiring contracts</CardDescription>
            <CardTitle className="text-2xl">{rows.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Within the selected window</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Window</CardDescription>
            <CardTitle className="text-2xl">{days}d</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Days until expiry cutoff</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Employers impacted</CardDescription>
            <CardTitle className="text-2xl">{uniqueEmployers}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Unique employer names in results</CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Employer</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Issue</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r) => (
                  <tr key={r.Worker_Id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{r.Worker_Id}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.Employer_Name ?? "—"}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{(r as any).issFmt || "—"}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{(r as any).expFmt || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10">
              <div className="max-w-xl">
                <div className="text-base font-semibold text-foreground">No contracts expiring in this window</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Increase the days filter to widen the window, or check again later.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
