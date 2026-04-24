import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Download, FileText, Eye, HeartPulse, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getInsuranceExpireReport, getVisaExpireReport } from "@/services/reportService";
import { Skeleton } from "@/components/ui/skeleton";

type ReportType = "insurance" | "visa";

type ExpiryBand = {
  label: "Expired" | "Critical (≤30d)" | "Warning (≤60d)" | "Caution (≤90d)" | "Valid" | "Unknown";
  color: string;
  daysLeft: number | null;
};

function classifyExpiry(raw?: string | Date | null): ExpiryBand {
  if (!raw) return { label: "Unknown", color: "bg-muted text-muted-foreground", daysLeft: null };
  const d = raw instanceof Date ? raw : new Date(String(raw));
  if (!Number.isFinite(d.getTime())) return { label: "Unknown", color: "bg-muted text-muted-foreground", daysLeft: null };
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Expired", color: "bg-destructive/10 text-destructive", daysLeft: diffDays };
  if (diffDays <= 30) return { label: "Critical (≤30d)", color: "bg-destructive/10 text-destructive", daysLeft: diffDays };
  if (diffDays <= 60) return { label: "Warning (≤60d)", color: "bg-warning/15 text-warning", daysLeft: diffDays };
  if (diffDays <= 90) return { label: "Caution (≤90d)", color: "bg-warning/10 text-warning", daysLeft: diffDays };
  return { label: "Valid", color: "bg-success/10 text-success", daysLeft: diffDays };
}

export default function ExpiryReportPage() {
  const [reportType, setReportType] = useState<ReportType>("insurance");

  const visaQuery = useQuery({
    queryKey: ["report_visa_expire", reportType],
    queryFn: () => getVisaExpireReport({ days: 90 }),
    enabled: reportType === "visa",
  });

  const insuranceQuery = useQuery({
    queryKey: ["report_insurance_expire", reportType],
    queryFn: () => getInsuranceExpireReport({ days: 90 }),
    enabled: reportType === "insurance",
  });

  const handleExport = (format: string) => {
    toast.success(`Export to ${format} initiated (placeholder)`);
  };

  const title = reportType === "insurance" ? "Contract / Insurance Expiry Report" : "Visa/Permit Expiry Report";
  const Icon = reportType === "insurance" ? HeartPulse : Eye;

  const activeRows = useMemo(() => {
    if (reportType === "visa") {
      return (visaQuery.data?.rows ?? []).map((r) => ({
        workerId: (r.Worker_Id ?? "").toString(),
        name: (r.Name ?? r.Worker_Id ?? "").toString(),
        passport: (r.Passport_Number ?? "").toString(),
        company: (r.Company_Name ?? "").toString(),
        date: r.Permit_Expire_Date ?? null,
      }));
    }
    return (insuranceQuery.data?.rows ?? []).map((r) => ({
      workerId: (r.Worker_Id ?? "").toString(),
      name: (r.Name ?? r.Worker_Id ?? "").toString(),
      passport: (r.Passport_Number ?? "").toString(),
      company: (r.Company_Name ?? "").toString(),
      date: r.Contract_Expiry_Date ?? null,
    }));
  }, [reportType, visaQuery.data, insuranceQuery.data]);

  const counts = useMemo(() => {
    let expired = 0;
    let soon = 0; // ≤90d, not expired
    let valid = 0;
    for (const r of activeRows) {
      const band = classifyExpiry(r.date);
      if (band.label === "Expired") expired++;
      else if (band.label === "Valid") valid++;
      else if (band.label !== "Unknown") soon++;
    }
    return { expired, soon, valid };
  }, [activeRows]);

  const isLoading = reportType === "visa" ? visaQuery.isLoading : insuranceQuery.isLoading;

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

      {reportType === "insurance" && (
        <div className="mb-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
          Insurance expiry date — currently using <span className="font-mono text-foreground">Tbl_Worker_EmployerInfo.Contract_Expiry_Date</span> as a proxy.
          Update schema to add a dedicated insurance expiry column when available.
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {isLoading ? (
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
            { label: "Expired", count: counts.expired, color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
            { label: "Expiring ≤90d", count: counts.soon, color: "text-warning", bg: "bg-warning/10", icon: Icon },
            { label: "Valid", count: counts.valid, color: "text-success", bg: "bg-success/10", icon: Icon },
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
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Passport</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Company</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    {reportType === "insurance" ? "Contract / Insurance Expiry" : "Permit Expiry"}
                  </th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {activeRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No records in this window.
                    </td>
                  </tr>
                ) : (
                  activeRows.map((r, i) => {
                    const band = classifyExpiry(r.date);
                    return (
                      <tr key={`${r.workerId}-${i}`} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{r.name || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.passport || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{r.company || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.date ? new Date(String(r.date)).toLocaleDateString() : "—"}
                          {band.daysLeft != null && r.date ? (
                            <span className="ml-2 text-[11px] text-muted-foreground">
                              ({band.daysLeft < 0 ? `${Math.abs(band.daysLeft)}d ago` : `${band.daysLeft}d left`})
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${band.color}`}>
                            {band.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
