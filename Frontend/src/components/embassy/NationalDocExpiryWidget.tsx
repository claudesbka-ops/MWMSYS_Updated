import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Calendar } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface DocExpiry {
  workerId: string;
  name: string;
  passportNumber: string;
  documentType: string;
  expiryDate: string;
  daysRemaining: number;
  employerId: string;
}

export function NationalDocExpiryWidget() {
  const [filter, setFilter] = useState<"all" | "passport" | "permit" | "insurance">("all");
  
  const { data, isLoading } = useQuery({
    queryKey: ["embassy", "docExpiry", 60],
    queryFn: async () => {
      const res = await apiClient.get("/Api/Authority/Embassy/DocumentExpiry?days=60");
      return res.data.documents as DocExpiry[];
    },
  });

  const documents = data || [];

  const filteredDocs = documents.filter((d) => {
    if (filter === "all") return true;
    if (filter === "passport") return d.documentType === "Passport";
    if (filter === "permit") return d.documentType === "Work Permit";
    if (filter === "insurance") return d.documentType === "Insurance";
    return true;
  });

  const getDaysColor = (days: number) => {
    if (days <= 7) return "text-red-600 bg-red-50";
    if (days <= 30) return "text-amber-600 bg-amber-50";
    return "text-yellow-600 bg-yellow-50";
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-slate-900">Document Expiry Monitor</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-slate-900">Document Expiry Monitor</h3>
        </div>
        <span className="text-sm text-slate-500">
          {filteredDocs.length} documents expiring in 60 days
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "all", label: "All" },
          { key: "passport", label: "Passport" },
          { key: "permit", label: "Permit" },
          { key: "insurance", label: "Insurance" },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key as any)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {filteredDocs.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No documents expiring soon</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Worker</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Document</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Expiry Date</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Days Left</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Employer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map((doc) => (
                <tr key={`${doc.workerId}-${doc.documentType}`} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{doc.name}</p>
                    <p className="text-xs text-slate-500">{doc.passportNumber}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{doc.documentType}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {new Date(doc.expiryDate).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getDaysColor(
                        doc.daysRemaining
                      )}`}
                    >
                      {doc.daysRemaining <= 0
                        ? "Expired"
                        : `${doc.daysRemaining} days`}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{doc.employerId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
