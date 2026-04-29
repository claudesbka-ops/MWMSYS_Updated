import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  FileCheck,
  Sparkles,
  Upload,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitAttestation, type AttestationSubmitResponse } from "@/services/attestationService";
import { getMyWorkerDocuments, type WorkerDocumentRow } from "@/services/workerService";

const DOC_TYPES: Array<{ value: string; label: string }> = [
  { value: "passport", label: "Passport" },
  { value: "permit", label: "Work Permit" },
  { value: "insurance", label: "Insurance" },
  { value: "contract", label: "Contract" },
  { value: "medical", label: "Medical" },
  { value: "demand_letter", label: "Demand Letter" },
];

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 15 * 1024 * 1024;

function confidenceBadgeClass(c: string | null | undefined): string {
  const v = (c ?? "").toString().toLowerCase();
  if (v === "high") return "bg-success/15 text-success border-success/40";
  if (v === "medium") return "bg-warning/15 text-warning border-warning/40";
  return "bg-destructive/15 text-destructive border-destructive/40";
}

function formatExpiry(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function statusBadgeClass(status: string | null | undefined): string {
  const s = (status ?? "").toString().toLowerCase();
  if (s === "approved") return "bg-success/10 text-success border-success/30";
  if (s === "rejected") return "bg-destructive/10 text-destructive border-destructive/30";
  if (s === "submitted" || s === "in review") return "bg-warning/10 text-warning border-warning/30";
  return "bg-muted text-muted-foreground border-border/60";
}

export default function WorkerAttestationSubmitPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("passport");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttestationSubmitResponse | null>(null);

  const { data: docsRes, isLoading: docsLoading } = useQuery({
    queryKey: ["my_worker_documents"],
    queryFn: getMyWorkerDocuments,
  });

  const documents = (docsRes?.documents ?? []) as WorkerDocumentRow[];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error("File must be JPG, PNG, WebP, or PDF");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("File must be smaller than 15 MB");
      e.target.value = "";
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !file) return;

    setSubmitting(true);
    setResult(null);
    try {
      const res = await submitAttestation({ file, documentType: docType });
      setResult(res);
      await qc.invalidateQueries({ queryKey: ["my_worker_documents"] });
      toast.success("Document uploaded for review");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const confidence = result?.extracted.confidence ?? null;
  const isLow = confidence === "low";
  const hasExtraction =
    !!result &&
    !!(
      result.extracted.name ||
      result.extracted.documentNumber ||
      result.extracted.expiryDate ||
      result.extracted.nationality
    );

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(215,32%,22%)] to-[hsl(243,75%,35%)] p-7 mb-6 shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <FileCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-widest">
              Document Verification
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[hsl(0,0%,100%)] mb-1.5">
            Upload a document for review
          </h1>
          <p className="text-[hsl(210,20%,75%)] text-sm max-w-xl">
            Our AI reads passports, permits, insurance, and contracts to fill
            expiry dates automatically. The agency still reviews and signs off.
          </p>
        </div>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-card rounded-2xl border border-border/60 p-6 space-y-5"
        >
          <div className="space-y-2">
            <Label>Document type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center cursor-pointer hover:bg-muted/30 transition"
            >
              <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">
                {file ? file.name : "Click to choose a file"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                JPG, PNG, WebP or PDF. Up to 15 MB.
              </p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={!file || submitting}>
            {submitting ? "Uploading…" : "Submit for review"}
          </Button>
        </form>

        <div className="space-y-4">
          {result && hasExtraction ? (
            <div className="bg-card rounded-2xl border border-success/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-success" />
                <span className="text-sm font-bold text-foreground">
                  AI extracted the following data
                </span>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Name
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {result.extracted.name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Document Number
                  </p>
                  <p className="text-sm font-mono text-foreground">
                    {result.extracted.documentNumber ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                    Expiry Date
                    {result.autoFilled && (
                      <span className="inline-flex items-center gap-0.5 text-success normal-case">
                        <CheckCircle2 className="w-3 h-3" /> auto-filled
                      </span>
                    )}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {formatExpiry(result.extracted.expiryDate)}
                  </p>
                </div>
                {result.extracted.nationality && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      Nationality
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {result.extracted.nationality}
                    </p>
                  </div>
                )}
                <div className="pt-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${confidenceBadgeClass(confidence)}`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {(confidence ?? "low").toUpperCase()} CONFIDENCE
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {result && isLow && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-warning">
                    Image quality is low
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please upload a clearer photo for accurate extraction. The
                    agency will review this submission manually.
                  </p>
                </div>
              </div>
            </div>
          )}

          {result && !hasExtraction && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    Could not read document automatically
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The agency will verify your submission manually.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-card rounded-2xl border border-border/60 p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">My Document Checklist</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track uploaded, submitted, and admin-approved document status.
            </p>
          </div>
        </div>

        {docsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {documents.map((d) => {
              const status = d.attestationStatus ?? (d.hasFile ? "Uploaded" : "Missing");
              return (
                <div key={d.type} className="rounded-xl border border-border/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{d.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {d.filename ?? (d.attestationStatus ? "Submitted for verification" : "No file uploaded")}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${statusBadgeClass(status)}`}>
                      {status}
                    </span>
                  </div>

                  {(d.submittedOn || d.verifiedOn || d.adminRemarks) && (
                    <div className="mt-3 pt-3 border-t border-border/40 space-y-1 text-xs text-muted-foreground">
                      {d.submittedOn && <p>Submitted: {new Date(String(d.submittedOn)).toLocaleDateString()}</p>}
                      {d.verifiedOn && <p>Updated: {new Date(String(d.verifiedOn)).toLocaleDateString()}</p>}
                      {d.adminRemarks && <p>Remarks: {d.adminRemarks}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
