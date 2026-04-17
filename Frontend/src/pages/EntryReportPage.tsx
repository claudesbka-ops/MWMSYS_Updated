import DashboardLayout from "@/components/DashboardLayout";
import { Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getEntryReport } from "@/services/reportService";
import { Skeleton } from "@/components/ui/skeleton";

export default function EntryReportPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["report_entry"],
    queryFn: () => getEntryReport({}),
  });

  const handleExport = (format: string) => {
    toast.success(`Export to ${format} initiated (placeholder)`);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Entry Report</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Worker entry records and registration data</p>
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

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-40" />
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
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Employer</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Entry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r, i) => (
                  <tr key={`${r.Worker_Id}-${i}`} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{(r.Name ?? r.Worker_Id).toString()}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{(r.Passport_Number ?? "—").toString()}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{(r.Company_Name ?? "—").toString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.Created_On ? new Date(String(r.Created_On)).toLocaleDateString() : "—"}</td>
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
