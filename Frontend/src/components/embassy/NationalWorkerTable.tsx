import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, Download } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/exporters";
import { toast } from "sonner";

interface NationalWorker {
  workerId: string;
  name: string;
  passportNumber: string;
  employerId: string;
  agencyId: string;
  riskLevel: string;
  status: string;
}

export function NationalWorkerTable() {
  const [search, setSearch] = useState("");
  
  const { data, isLoading } = useQuery({
    queryKey: ["embassy", "workers", search],
    queryFn: async () => {
      const res = await apiClient.get(
        `/Api/Authority/Embassy/Workers?search=${encodeURIComponent(search)}&limit=100`
      );
      return res.data.workers as NationalWorker[];
    },
  });

  const workers = data || [];

  const handleExport = () => {
    if (workers.length === 0) {
      toast.error("No workers to export");
      return;
    }

    const headers = ["Worker ID", "Name", "Passport Number", "Employer ID", "Agency ID", "Risk Level", "Status"];
    const rows = workers.map((w) => [
      w.workerId,
      w.name,
      w.passportNumber,
      w.employerId,
      w.agencyId,
      w.riskLevel,
      w.status,
    ]);

    downloadCsv(`nationals-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success(`Exported ${workers.length} workers to CSV`);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-amber-100 text-amber-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-slate-900">National Workers</h3>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name or passport number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : workers.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No workers found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Passport</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Employer</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Agency</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.map((worker) => (
                <tr key={worker.workerId} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{worker.name}</p>
                    <p className="text-xs text-slate-500">{worker.workerId}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {worker.passportNumber}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{worker.employerId}</td>
                  <td className="px-3 py-3 text-slate-600">{worker.agencyId}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getRiskColor(
                        worker.riskLevel
                      )}`}
                    >
                      {worker.riskLevel?.toUpperCase() || "UNKNOWN"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
