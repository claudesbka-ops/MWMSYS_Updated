import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewRow {
  full_name: string;
  passport_number: string;
  nationality: string;
  date_of_birth: string;
  employer_id: string;
  phone_number: string;
  email?: string;
  [key: string]: any;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportPreviewTableProps {
  preview: {
    totalRows: number;
    validRows: number;
    sampleRows: PreviewRow[];
    errors: ValidationError[];
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export function ImportPreviewTable({ preview, onConfirm, onCancel }: ImportPreviewTableProps) {
  const errorsByRow = new Map<number, ValidationError[]>();
  preview.errors.forEach((err) => {
    const existing = errorsByRow.get(err.row) || [];
    existing.push(err);
    errorsByRow.set(err.row, existing);
  });

  const hasErrors = preview.errors.length > 0;
  const canImport = preview.validRows > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Import Preview</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            {preview.validRows} valid
          </span>
          {hasErrors && (
            <span className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-red-500" />
              {preview.errors.length} errors
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className={`p-4 rounded-lg ${hasErrors ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
        <div className="flex items-start gap-3">
          {hasErrors ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          )}
          <div>
            <p className={`font-medium ${hasErrors ? "text-amber-800" : "text-green-800"}`}>
              {hasErrors
                ? `Found ${preview.errors.length} errors in ${preview.totalRows} rows`
                : `All ${preview.totalRows} rows are valid and ready to import`}
            </p>
            {!canImport && (
              <p className="text-sm text-amber-700 mt-1">
                Please fix errors before importing
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sample Rows Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">#</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Full Name</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Passport</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Nationality</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">DOB</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Employer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.sampleRows.map((row, idx) => {
                const rowNum = idx + 2; // Row 1 is header
                const rowErrors = errorsByRow.get(rowNum) || [];
                const hasRowErrors = rowErrors.length > 0;

                return (
                  <tr key={idx} className={hasRowErrors ? "bg-red-50/50" : ""}>
                    <td className="px-4 py-2 text-slate-500">{rowNum}</td>
                    <td className="px-4 py-2">
                      {hasRowErrors ? (
                        <XCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </td>
                    <td className="px-4 py-2">{row.full_name}</td>
                    <td className="px-4 py-2">{row.passport_number}</td>
                    <td className="px-4 py-2">{row.nationality}</td>
                    <td className="px-4 py-2">{row.date_of_birth}</td>
                    <td className="px-4 py-2">{row.employer_id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Errors List */}
      {hasErrors && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <h4 className="font-medium text-red-800 mb-2">Errors</h4>
          <ul className="space-y-1 text-sm text-red-700">
            {preview.errors.slice(0, 10).map((err, idx) => (
              <li key={idx}>
                Row {err.row}, {err.field}: {err.message}
              </li>
            ))}
            {preview.errors.length > 10 && (
              <li className="text-red-600">
                ...and {preview.errors.length - 10} more errors
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={!canImport}>
          Import {preview.validRows} Workers
        </Button>
      </div>
    </div>
  );
}
