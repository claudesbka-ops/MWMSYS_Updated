import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPayroll, uploadPayroll } from "@/services/hrmsService";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/contexts/RoleContext";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadCsv, downloadPdfSimpleTable } from "@/lib/exporters";

export default function PayrollPage() {
  const { currentRole } = useRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const subscription = useSubscription();

  const { data = [], isLoading } = useQuery({
    queryKey: ["hrms_payroll"],
    queryFn: getPayroll,
  });

  const [form, setForm] = useState({
    workerId: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    amount: 0,
    voucherUrl: "",
    isPaid: true,
  });

  const canUpload = currentRole === "admin" || currentRole === "employer" || currentRole === "agency";
  const isWriteLocked = (currentRole === "agency" || currentRole === "employer") && !subscription.hasActivePlan;

  const uploadMut = useMutation({
    mutationFn: uploadPayroll,
    onSuccess: () => {
      toast.success("Payroll uploaded");
      qc.invalidateQueries({ queryKey: ["hrms_payroll"] }).catch(() => undefined);
    },
  });

  const rows = useMemo(() => {
    return (data ?? []).map((r) => ({
      ...r,
      period: `${String(r.month).padStart(2, "0")}/${r.year}`,
    }));
  }, [data]);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Payroll</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Vouchers and payment tracking</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const headers = ["Worker", "Period", "Amount", "Paid", "Voucher"]; 
              const out = rows.map((r: any) => [
                r.workerId,
                r.period,
                Number(r.amount ?? 0).toFixed(2),
                r.isPaid ? "Yes" : "No",
                r.voucherUrl ?? "",
              ]);
              downloadCsv(`payroll_${new Date().toISOString().slice(0, 10)}.csv`, headers, out);
            }}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const headers = ["Worker", "Period", "Amount", "Paid", "Voucher"]; 
              const out = rows.map((r: any) => [
                r.workerId,
                r.period,
                Number(r.amount ?? 0).toFixed(2),
                r.isPaid ? "Yes" : "No",
                r.voucherUrl ?? "",
              ]);
              downloadPdfSimpleTable(
                `payroll_${new Date().toISOString().slice(0, 10)}.pdf`,
                "Payroll",
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

      {canUpload && isWriteLocked && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Subscription required</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade your plan to upload payroll vouchers.</p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
            >
              Go to Pricing
            </button>
          </div>
        </div>
      )}

      {canUpload && (
        <div className="bg-card rounded-2xl border border-border/60 p-5 mb-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Upload Payroll Voucher</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              value={form.workerId}
              onChange={(e) => setForm({ ...form, workerId: e.target.value })}
              placeholder="Worker Id"
              className="h-11 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm md:col-span-2"
            />
            <select
              value={form.month}
              onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
              className="h-11 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {String(i + 1).padStart(2, "0")}
                </option>
              ))}
            </select>
            <select
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              className="h-11 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              placeholder="Amount"
              className="h-11 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm"
            />
            <button
              onClick={() =>
                uploadMut.mutate({
                  workerId: form.workerId,
                  month: form.month,
                  year: form.year,
                  amount: form.amount,
                  voucherUrl: form.voucherUrl || undefined,
                  isPaid: form.isPaid,
                })
              }
              disabled={uploadMut.isPending || isWriteLocked}
              className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
            >
              Upload
            </button>
          </div>
          <div className="mt-3">
            <input
              value={form.voucherUrl}
              onChange={(e) => setForm({ ...form, voucherUrl: e.target.value })}
              placeholder="Voucher URL (optional)"
              className="h-11 w-full px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm"
            />
          </div>
        </div>
      )}

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
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Period</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Paid</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{r.workerId}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{(r as any).period}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{Number(r.amount ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.isPaid ? "Yes" : "No"}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">
                      {r.voucherUrl ? (
                        <a href={r.voucherUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
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
