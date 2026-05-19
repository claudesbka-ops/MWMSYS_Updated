import { useQuery } from "@tanstack/react-query";
import { Shield, AlertTriangle } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/ui/skeleton";

interface ComplianceEmployer {
  employerId: string;
  employerName: string;
  workers: number;
  score: number;
  criticalAlerts: number;
  highAlerts: number;
  expiredDocs: number;
  status: string;
}

export function ComplianceOverviewWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["labour", "compliance"],
    queryFn: async () => {
      const res = await apiClient.get("/Api/Authority/Labour/ComplianceOverview");
      return res.data.employers as ComplianceEmployer[];
    },
  });

  const employers = data || [];

  const getScoreColor = (score: number, status: string) => {
    if (status === "critical" || score < 50) return "text-red-600 bg-red-50";
    if (status === "high" || score < 70) return "text-amber-600 bg-amber-50";
    return "text-green-600 bg-green-50";
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold text-slate-900">Compliance Overview</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
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
          <Shield className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold text-slate-900">Compliance Overview</h3>
        </div>
        <span className="text-sm text-slate-500">
          {employers.length} employers
        </span>
      </div>

      {employers.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No compliance data available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Employer</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Workers</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Score</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Critical</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">High</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employers.map((emp) => (
                <tr key={emp.employerId} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{emp.employerName}</p>
                    <p className="text-xs text-slate-500">{emp.employerId}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{emp.workers}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getScoreColor(
                        emp.score,
                        emp.status
                      )}`}
                    >
                      {emp.score}/100
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {emp.criticalAlerts > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3" />
                        {emp.criticalAlerts}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {emp.highAlerts > 0 ? (
                      <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        {emp.highAlerts}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getScoreColor(
                        emp.score,
                        emp.status
                      )}`}
                    >
                      {emp.status.toUpperCase()}
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
