import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scale, Filter } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface Dispute {
  disputeId: number;
  workerId: string;
  workerName: string;
  employerId: string;
  expectedAmount: number;
  receivedAmount: number;
  disputeMonth: string;
  description: string;
  status: string;
  aiSeverity: string;
  submittedDate: string;
}

export function DisputeOverviewWidget() {
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["labour", "disputes", severityFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (severityFilter) params.append("severity", severityFilter);
      if (statusFilter) params.append("status", statusFilter);
      const res = await apiClient.get(`/Api/Authority/Labour/DisputeOverview?${params}`);
      return res.data.disputes as Dispute[];
    },
  });

  const disputes = data || [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-amber-100 text-amber-800";
      case "low":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Resolved":
        return "bg-green-100 text-green-800";
      case "Pending":
        return "bg-amber-100 text-amber-800";
      case "Escalated":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold text-slate-900">Dispute Overview</h3>
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
          <Scale className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold text-slate-900">Dispute Overview</h3>
        </div>
        <span className="text-sm text-slate-500">
          {disputes.length} disputes
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Resolved">Resolved</option>
          <option value="Escalated">Escalated</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSeverityFilter("");
            setStatusFilter("");
          }}
        >
          Clear
        </Button>
      </div>

      {disputes.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Scale className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No disputes found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Worker</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Employer</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Amount</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">AI Severity</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {disputes.map((dispute) => (
                <tr key={dispute.disputeId} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{dispute.workerName}</p>
                    <p className="text-xs text-slate-500">{dispute.workerId}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{dispute.employerId}</td>
                  <td className="px-3 py-3 text-slate-600">
                    <p className="text-xs text-slate-500">Expected</p>
                    <p className="font-medium">${Number(dispute.expectedAmount).toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">Received</p>
                    <p>${Number(dispute.receivedAmount).toLocaleString()}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getSeverityColor(
                        dispute.aiSeverity
                      )}`}
                    >
                      {dispute.aiSeverity?.toUpperCase() || "UNKNOWN"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                        dispute.status
                      )}`}
                    >
                      {dispute.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600 text-xs">
                    {dispute.submittedDate
                      ? new Date(dispute.submittedDate).toLocaleDateString()
                      : "—"}
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
