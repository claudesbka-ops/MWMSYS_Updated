import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveAttestation, getAttestationList, rejectAttestation, type AttestationRow } from "@/services/attestationService";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, FileCheck } from "lucide-react";

export default function AttestationPage() {
  const qc = useQueryClient();
  const [remarks, setRemarks] = useState<Record<number, string>>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["attestation_list"],
    queryFn: getAttestationList,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const approveMut = useMutation({
    mutationFn: (payload: { id: number }) => approveAttestation({ id: payload.id, remarks: remarks[payload.id] }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["attestation_list"] });
    },
  });

  const rejectMut = useMutation({
    mutationFn: (payload: { id: number }) => rejectAttestation({ id: payload.id, remarks: remarks[payload.id] }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["attestation_list"] });
    },
  });

  const isBusy = approveMut.isPending || rejectMut.isPending;

  const statusBadge = (status: string) => {
    const s = (status ?? "").toLowerCase();
    if (s === "approved") return "bg-success/10 text-success";
    if (s === "rejected") return "bg-destructive/10 text-destructive";
    if (s === "in review") return "bg-warning/10 text-warning";
    return "bg-muted text-muted-foreground";
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Attestation</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Approve or reject contract verification requests</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/40 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Requests</span>
          <span className="ml-auto text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg font-medium">{rows.length} records</span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Passport</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Document</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Remarks</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r: AttestationRow, idx: number) => {
                  const id = Number(r.AttestationId);
                  const s = (r.Status ?? "Submitted").toString();
                  const canAct = s.toLowerCase() === "submitted" || s.toLowerCase() === "in review";

                  return (
                    <tr key={id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{r.Worker_Id}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{(r.Passport_Number ?? "—").toString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{(r.DocumentType ?? "—").toString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadge(s)}`}>{s}</span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={remarks[id] ?? r.AdminRemarks ?? ""}
                          onChange={(e) => setRemarks((prev) => ({ ...prev, [id]: e.target.value }))}
                          placeholder="Optional remarks"
                          className="h-9 w-64 rounded-xl border border-border/60 bg-background px-3 text-xs"
                          disabled={!canAct || isBusy}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 text-success text-xs font-semibold hover:bg-success/15 transition-colors disabled:opacity-40"
                            disabled={!canAct || isBusy}
                            onClick={() => approveMut.mutate({ id })}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/15 transition-colors disabled:opacity-40"
                            disabled={!canAct || isBusy}
                            onClick={() => rejectMut.mutate({ id })}
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 text-[11px] text-muted-foreground">
        Note: If no requests exist yet, insert a few rows into <code>Tbl_Attestation</code> for testing.
      </div>
    </DashboardLayout>
  );
}
