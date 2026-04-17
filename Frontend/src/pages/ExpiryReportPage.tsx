import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { workersData } from "@/data/workersData";
import { Download, FileText, Eye, HeartPulse, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getVisaExpireReport } from "@/services/reportService";
import { Skeleton } from "@/components/ui/skeleton";

type ReportType = "insurance" | "visa";

export default function ExpiryReportPage() {
  const [reportType, setReportType] = useState<ReportType>("insurance");

  const visaQuery = useQuery({
    queryKey: ["report_visa_expire", reportType],
    queryFn: () => getVisaExpireReport({ days: 90 }),
    enabled: reportType === "visa",
  });

  const handleExport = (format: string) => {
    toast.success(`Export to ${format} initiated (placeholder)`);
  };

  const expiryField = reportType === "insurance" ? "insuranceExpiry" : "permitExpiry";
  const title = reportType === "insurance" ? "Insurance Expiry Report" : "Visa/Permit Expiry Report";
  const Icon = reportType === "insurance" ? HeartPulse : Eye;

  // Simple expiry classification for demo
  const getExpiryStatus = (dateStr?: string) => {
    if (!dateStr) return { label: "Unknown", color: "bg-muted text-muted-foreground" };
    const parts = dateStr.split("/");
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: "Expired", color: "bg-destructive/10 text-destructive" };
    if (diffDays < 90) return { label: "Expiring Soon", color: "bg-warning/10 text-warning" };
    return { label: "Valid", color: "bg-success/10 text-success" };
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Track document expiration dates</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport("CSV")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={() => handleExport("PDF")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex gap-1.5 bg-muted/40 p-1 rounded-xl mb-4 w-fit">
        {([
          { key: "insurance" as ReportType, label: "Insurance", icon: HeartPulse },
          { key: "visa" as ReportType, label: "Visa/Permit", icon: Eye },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setReportType(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${reportType === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {reportType === "visa" && visaQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/60 p-5 flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))
        ) : (
          [
            { label: "Expired", count: workersData.filter(w => getExpiryStatus(w[expiryField]).label === "Expired").length, color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
            { label: "Expiring Soon", count: workersData.filter(w => getExpiryStatus(w[expiryField]).label === "Expiring Soon").length, color: "text-warning", bg: "bg-warning/10", icon: Icon },
            { label: "Valid", count: workersData.filter(w => getExpiryStatus(w[expiryField]).label === "Valid").length, color: "text-success", bg: "bg-success/10", icon: Icon },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-2xl border border-border/60 p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.bg}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          {reportType === "visa" ? (
            visaQuery.isLoading ? (
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
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">#</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Passport</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Company</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Permit Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(visaQuery.data?.rows ?? []).map((r, i) => (
                    <tr key={`${r.Worker_Id}-${i}`} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{(r.Name ?? r.Worker_Id).toString()}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{(r.Passport_Number ?? "—").toString()}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{(r.Company_Name ?? "—").toString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.Permit_Expire_Date
                          ? new Date(String(r.Permit_Expire_Date)).toLocaleDateString()
                          : (r.StatusLabel ?? "Missing Data").toString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Passport</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Country</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Employer</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">{reportType === "insurance" ? "Insurance Expiry" : "Permit Expiry"}</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {workersData.map((w, i) => {
                  const expiry = getExpiryStatus(w[expiryField]);
                  return (
                    <tr key={w.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{w.passportNo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{w.country}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{w.employer || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{w[expiryField] || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${expiry.color}`}>
                          {expiry.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
