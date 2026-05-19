import { useState } from "react";
import { Upload, FileSearch, CheckCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { CsvUploadZone } from "@/components/import/CsvUploadZone";
import { ImportPreviewTable } from "@/components/import/ImportPreviewTable";
import { ImportResultsSummary } from "@/components/import/ImportResultsSummary";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

type Step = "upload" | "preview" | "results";

interface PreviewData {
  jobId: number;
  preview: {
    totalRows: number;
    validRows: number;
    sampleRows: any[];
    errors: any[];
  };
}

interface ImportResult {
  successful: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
}

export default function BulkImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleUpload = (data: PreviewData) => {
    setPreviewData(data);
    setStep("preview");
  };

  const handleUploadError = (error: string) => {
    toast.error(error);
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;

    setIsImporting(true);
    try {
      // Get all rows from the preview (in production, we'd store them server-side)
      // For now, we need to re-parse and send all valid rows
      const response = await apiClient.post(
        `/Api/BulkImport/Execute/${previewData.jobId}`,
        { rows: previewData.preview.sampleRows } // This needs adjustment in real impl
      );

      setImportResult(response.data);
      setStep("results");
      toast.success(`Imported ${response.data.successful} workers`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setStep("upload");
    setPreviewData(null);
  };

  const handleImportAnother = () => {
    setStep("upload");
    setPreviewData(null);
    setImportResult(null);
  };

  const steps = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "preview", label: "Preview", icon: FileSearch },
    { id: "results", label: "Results", icon: CheckCircle },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bulk Import Workers</h1>
        <p className="text-sm text-slate-500 mt-1">
          Import multiple workers at once via CSV file
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-2">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isPast = steps.findIndex((x) => x.id === step) > idx;

            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                    isActive
                      ? "bg-primary text-white"
                      : isPast
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-2 ${
                      isPast ? "bg-green-300" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto">
        {step === "upload" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <CsvUploadZone onUpload={handleUpload} onError={handleUploadError} />
          </div>
        )}

        {step === "preview" && previewData && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <ImportPreviewTable
              preview={previewData.preview}
              onConfirm={handleConfirmImport}
              onCancel={handleCancel}
            />
            {isImporting && (
              <div className="mt-4 text-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-slate-500 mt-2">Importing workers...</p>
              </div>
            )}
          </div>
        )}

        {step === "results" && importResult && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <ImportResultsSummary
              result={importResult}
              onImportAnother={handleImportAnother}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
