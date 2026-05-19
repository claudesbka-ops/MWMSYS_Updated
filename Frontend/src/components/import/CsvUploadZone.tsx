import { useCallback, useState } from "react";
import { Upload, FileText, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

interface CsvUploadZoneProps {
  onUpload: (data: { jobId: number; preview: any }) => void;
  onError: (error: string) => void;
}

export function CsvUploadZone({ onUpload, onError }: CsvUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, []);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      onError("Please upload a CSV file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      onError("File size must be less than 2MB");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post("/Api/BulkImport/Upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      onUpload(response.data);
    } catch (err: any) {
      onError(err?.response?.data?.error || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await apiClient.get("/Api/BulkImport/Template", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "worker_import_template.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Failed to download template");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Upload Worker CSV</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadTemplate}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download Template
        </Button>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"}
          ${isUploading ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-5 h-5 text-slate-600" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">
              {isUploading ? "Uploading..." : "Drop your CSV file here"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              or click to browse (max 2MB, max 500 rows)
            </p>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            disabled={isUploading}
            className="hidden"
            id="csv-input"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={isUploading}
            onClick={() => document.getElementById("csv-input")?.click()}
          >
            <FileText className="w-4 h-4 mr-2" />
            Select File
          </Button>
        </div>
      </div>

      <div className="text-xs text-slate-500">
        <p className="font-medium">Required columns:</p>
        <p>full_name, passport_number, nationality, date_of_birth, employer_id, phone_number</p>
      </div>
    </div>
  );
}
