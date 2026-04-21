import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { deleteWorkerDocument, getWorkerDocuments, getWorkerProfile, uploadWorkerDocument, type WorkerDocumentRow } from "@/services/workerService";

export default function WorkerProfilePage() {
  const { workerId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const id = (workerId ?? "").toString();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["hrms_worker_profile", id],
    queryFn: () => getWorkerProfile(id),
    enabled: !!id,
  });

  const { data: docsRes, isLoading: docsLoading } = useQuery({
    queryKey: ["hrms_worker_docs", id],
    queryFn: () => getWorkerDocuments(id),
    enabled: !!id,
  });

  const documents = useMemo(() => (docsRes?.documents ?? []) as WorkerDocumentRow[], [docsRes]);

  const [docType, setDocType] = useState<WorkerDocumentRow["type"]>("passport");
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const uploadMut = useMutation({
    mutationFn: async (params: { type: WorkerDocumentRow["type"]; file: File }) => {
      return uploadWorkerDocument({ workerId: id, docType: params.type, file: params.file });
    },
    onSuccess: async () => {
      toast.success("Document uploaded");
      await qc.invalidateQueries({ queryKey: ["hrms_worker_docs", id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Upload failed"),
  });

  const deleteMut = useMutation({
    mutationFn: async (type: WorkerDocumentRow["type"]) => {
      return deleteWorkerDocument({ workerId: id, docType: type });
    },
    onSuccess: async () => {
      toast.success("Document deleted");
      await qc.invalidateQueries({ queryKey: ["hrms_worker_docs", id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Delete failed"),
  });

  const busy = uploadMut.isPending || deleteMut.isPending;

  const personal = profile?.personal ?? null;
  const employerInfo = profile?.employerInfo ?? null;
  const permit = profile?.permit ?? null;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Worker Profile</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{id}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border/60 p-5">
          <h3 className="text-sm font-semibold text-foreground">Profile</h3>
          {(profileLoading || !profile) && (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          )}

          {!profileLoading && profile && (
            <div className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Name</div>
                  <div className="font-medium">{personal?.Name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Passport</div>
                  <div className="font-medium">{personal?.Passport_Number ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="font-medium">{personal?.Email_Id ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div className="font-medium">{[personal?.Contact_Number_Country_Code, personal?.Contact_Number].filter(Boolean).join(" ") || "—"}</div>
                </div>
              </div>

              <div className="pt-3 border-t border-border/40">
                <div className="text-xs text-muted-foreground">Employer</div>
                <div className="font-medium">{employerInfo?.Employer_Name ?? "—"}</div>
                <div className="text-xs text-muted-foreground mt-2">Permit Expiry</div>
                <div className="font-medium">
                  {permit?.Permit_Expire_Date ? new Date(String(permit.Permit_Expire_Date)).toLocaleDateString() : "—"}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Documents</h3>
            <div className="flex items-center gap-2">
              <div className="w-52">
                <Select value={docType} onValueChange={(v) => setDocType(v as any)} disabled={busy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport Copy</SelectItem>
                    <SelectItem value="permit">Work Permit</SelectItem>
                    <SelectItem value="insurance">Insurance Policy</SelectItem>
                    <SelectItem value="contract">Employment Contract</SelectItem>
                    <SelectItem value="demand_letter">Demand Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="default" disabled={busy} onClick={() => uploadRef.current?.click()}>
                Upload
              </Button>
            </div>
          </div>

          <input
            ref={uploadRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadMut.mutate({ type: docType, file: f });
              if (uploadRef.current) uploadRef.current.value = "";
            }}
          />

          {docsLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {documents.map((d) => (
                <div key={d.type} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{d.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.filename ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {d.hasFile ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/40"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted/50 text-muted-foreground">Missing</span>
                    )}
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setDocType(d.type);
                        uploadRef.current?.click();
                      }}
                    >
                      Replace
                    </Button>
                    <Button variant="destructive" disabled={busy || !d.hasFile} onClick={() => deleteMut.mutate(d.type)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
