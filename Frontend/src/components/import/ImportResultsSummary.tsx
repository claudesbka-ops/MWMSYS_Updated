import { CheckCircle, XCircle, Users, ArrowRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ImportError {
  row: number;
  reason: string;
}

interface ImportResultsSummaryProps {
  result: {
    successful: number;
    failed: number;
    errors: ImportError[];
  };
  onImportAnother: () => void;
}

export function ImportResultsSummary({ result, onImportAnother }: ImportResultsSummaryProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Import Complete</h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-xl border border-green-200 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-700">{result.successful}</p>
          <p className="text-sm text-green-600">Successfully Imported</p>
        </div>

        <div className={`rounded-xl border p-6 text-center ${result.failed > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${result.failed > 0 ? "bg-red-100" : "bg-slate-100"}`}>
            <XCircle className={`w-6 h-6 ${result.failed > 0 ? "text-red-600" : "text-slate-400"}`} />
          </div>
          <p className={`text-3xl font-bold ${result.failed > 0 ? "text-red-700" : "text-slate-500"}`}>
            {result.failed}
          </p>
          <p className={`text-sm ${result.failed > 0 ? "text-red-600" : "text-slate-500"}`}>
            Failed
          </p>
        </div>
      </div>

      {/* Errors List */}
      {result.failed > 0 && result.errors.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100">
            <h4 className="font-medium text-slate-800">Error Details</h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Row</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.errors.map((err, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-slate-500 w-16">{err.row}</td>
                    <td className="px-4 py-2 text-red-600">{err.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={() => navigate("/worker")}
          className="w-full sm:w-auto flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          View Imported Workers
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Button
          onClick={onImportAnother}
          className="w-full sm:w-auto flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Import Another File
        </Button>
      </div>
    </div>
  );
}
