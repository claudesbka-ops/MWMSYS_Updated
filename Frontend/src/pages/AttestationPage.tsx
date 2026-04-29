import { Fragment, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveAttestation, getAttestationList, rejectAttestation, type AttestationRow } from "@/services/attestationService";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Eye, FileCheck, Sparkles, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/apiClient";

function confidenceBadgeClass(c: string | null | undefined): string {
  const v = (c ?? "").toString().toLowerCase();
  if (v === "high") return "bg-success/10 text-success border-success/30";
  if (v === "medium") return "bg-warning/10 text-warning border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

function formatExpiry(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function AttestationPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

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

  const viewDocument = async (id: number) => {
    try {
      const res = await apiClient.get(`/Api/Attestation/${id}/Document`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error("View document failed", e);
    }
  };

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
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin
              ? "Approve or reject contract verification requests"
              : "View document verification requests (admin approval required)"}
          </p>
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
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Doc Type</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">AI</th>
                  {isAdmin && (
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Uploaded File</th>
                  )}
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Remarks</th>
                  {isAdmin && (
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r: AttestationRow, idx: number) => {
                  const id = Number(r.AttestationId);
                  const s = (r.Status ?? "Submitted").toString();
                  const canAct = s.toLowerCase() === "submitted" || s.toLowerCase() === "in review";
                  const isOpen = !!expanded[id];

                  const extractedName = (r.Extracted_Name ?? "").toString().trim();
                  const profileName = (r.Worker_Id ?? "").toString().trim();
                  const nameMismatch =
                    !!extractedName &&
                    !!profileName &&
                    extractedName.toLowerCase() !== profileName.toLowerCase();

                  const hasAi = !!r.Ai_Confidence || !!extractedName || !!r.Extracted_Document_Number;

                  return (
                    <Fragment key={id}>
                      <tr className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{r.Worker_Id}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{(r.Passport_Number ?? "—").toString()}</td>
                        <td className="px-4 py-3 text-muted-foreground">{(r.DocumentType ?? "—").toString()}</td>
                        <td className="px-4 py-3">
                          {hasAi ? (
                            <button
                              type="button"
                              onClick={() => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${confidenceBadgeClass(r.Ai_Confidence)}`}
                            >
                              <Sparkles className="w-3 h-3" />
                              {(r.Ai_Confidence ?? "low").toString().toUpperCase()}
                              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => viewDocument(id)}
                              disabled={!r.hasDocument}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors disabled:opacity-40"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Document
                            </button>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadge(s)}`}>{s}</span>
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            <input
                              value={remarks[id] ?? r.AdminRemarks ?? ""}
                              onChange={(e) => setRemarks((prev) => ({ ...prev, [id]: e.target.value }))}
                              placeholder="Optional remarks"
                              className="h-9 w-64 rounded-xl border border-border/60 bg-background px-3 text-xs"
                              disabled={!canAct || isBusy}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">{r.AdminRemarks ?? "—"}</span>
                          )}
                        </td>
                        {isAdmin && (
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
                        )}
                      </tr>
                      {isOpen && hasAi && (
                        <tr className="bg-muted/10">
                          <td colSpan={isAdmin ? 9 : 7} className="px-4 py-4">
                            <div className="rounded-xl border border-border/60 bg-card p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <span className="text-xs font-bold text-foreground">AI Extracted Data</span>
                                <span className={`ml-2 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${confidenceBadgeClass(r.Ai_Confidence)}`}>
                                  {(r.Ai_Confidence ?? "low").toString().toUpperCase()} CONFIDENCE
                                </span>
                                {nameMismatch && (
                                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-warning/15 text-warning border border-warning/30">
                                    <AlertTriangle className="w-3 h-3" />
                                    Name mismatch
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Extracted Name</p>
                                  <p className={`text-sm font-medium ${nameMismatch ? "text-warning" : "text-foreground"}`}>
                                    {extractedName || "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Document #</p>
                                  <p className="text-sm font-mono text-foreground">{r.Extracted_Document_Number ?? "—"}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Expiry (auto-filled)</p>
                                  <p className="text-sm font-medium text-foreground">{formatExpiry(r.Extracted_Expiry_Date)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Nationality</p>
                                  <p className="text-sm font-medium text-foreground">{r.Extracted_Nationality ?? "—"}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
