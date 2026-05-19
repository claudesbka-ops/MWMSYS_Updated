import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/ui/skeleton";

interface AtRiskWorker {
  workerId: string;
  name: string;
  passportNumber: string;
  employerId: string;
  riskScore: number;
  riskLevel: string;
  topFactor: string;
  calculatedAt: string;
}

export function AtRiskNationalsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["embassy", "atRisk"],
    queryFn: async () => {
      const res = await apiClient.get("/Api/Authority/Embassy/AtRisk");
      return res.data.workers as AtRiskWorker[];
    },
  });

  const workers = data || [];

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-green-100 text-green-800 border-green-200";
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-slate-900">At-Risk Nationals</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-slate-900">At-Risk Nationals</h3>
        </div>
        <span className="text-sm text-slate-500">
          {workers.length} workers with elevated risk
        </span>
      </div>

      {workers.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No risk scores calculated yet</p>
          <p className="text-sm mt-1">
            Risk scores are generated via Risk Dashboard
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Worker</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Passport</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Employer</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Risk</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Top Factor</th>
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
                  <td className="px-3 py-3 text-slate-600">
                    {worker.employerId}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            worker.riskScore > 56
                              ? "bg-red-500"
                              : worker.riskScore > 37
                              ? "bg-orange-500"
                              : "bg-amber-500"
                          }`}
                          style={{ width: `${(worker.riskScore / 75) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{worker.riskScore}</span>
                    </div>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium border ${getRiskColor(
                        worker.riskLevel
                      )}`}
                    >
                      {worker.riskLevel?.toUpperCase() || "UNKNOWN"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600 text-xs">
                    {worker.topFactor}
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
