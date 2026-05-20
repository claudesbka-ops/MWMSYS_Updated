import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { format } from "date-fns";
import { Shield, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";

interface AuditLog {
  Id: number;
  User_Id: string | null;
  User_Role: string | null;
  Action: string;
  Entity: string | null;
  Entity_Id: string | null;
  Ip_Address: string | null;
  User_Agent: string | null;
  Status: "success" | "failed" | "blocked";
  Details: string | null;
  Created_At: string;
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    action: "",
    status: "",
    startDate: "",
    endDate: "",
    page: 1,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.action) params.append("action", filters.action);
      if (filters.status) params.append("status", filters.status);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      params.append("page", String(filters.page));
      params.append("limit", "50");
      
      const res = await apiClient.get(`/Api/Audit/Log?${params.toString()}`);
      return res.data;
    },
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      success: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      blocked: "bg-orange-100 text-orange-800",
    };
    const icons = {
      success: <CheckCircle className="w-3 h-3" />,
      failed: <XCircle className="w-3 h-3" />,
      blocked: <AlertCircle className="w-3 h-3" />,
    };
    return (
      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || "bg-gray-100"}`}>
        {icons[status as keyof typeof icons]}
        {status}
      </span>
    );
  };

  const getActionColor = (action: string) => {
    if (action.startsWith("login_") || action.startsWith("logout") || action.startsWith("otp_") || action.startsWith("password_")) {
      return "text-blue-600";
    }
    if (action.includes("worker") || action.includes("import") || action.includes("document") || action.includes("upload")) {
      return "text-green-600";
    }
    if (action.includes("compliance") || action.includes("risk") || action.includes("alert")) {
      return "text-purple-600";
    }
    return "text-gray-600";
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold">Audit Log</h1>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Action</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters(f => ({ ...f, action: e.target.value, page: 1 }))}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">All Actions</option>
            <optgroup label="Auth">
              <option value="login_success">Login Success</option>
              <option value="login_failed">Login Failed</option>
              <option value="login_blocked">Login Blocked</option>
              <option value="logout">Logout</option>
              <option value="otp_verified">OTP Verified</option>
              <option value="password_changed">Password Changed</option>
            </optgroup>
            <optgroup label="Data">
              <option value="worker_created">Worker Created</option>
              <option value="worker_linked">Worker Linked</option>
              <option value="bulk_import_executed">Bulk Import</option>
              <option value="document_uploaded">Document Uploaded</option>
              <option value="document_verified">Document Verified</option>
              <option value="document_rejected">Document Rejected</option>
            </optgroup>
            <optgroup label="Compliance">
              <option value="compliance_scan_run">Compliance Scan</option>
              <option value="risk_score_calculated">Risk Score</option>
              <option value="alert_resolved">Alert Resolved</option>
            </optgroup>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value, page: 1 }))}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value, page: 1 }))}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.logs?.map((log: AuditLog) => (
                <tr key={log.Id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(log.Created_At), "yyyy-MM-dd HH:mm:ss")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{log.User_Id || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{log.User_Role || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${getActionColor(log.Action)}`}>
                      {log.Action}
                    </span>
                    {log.Entity && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {log.Entity}: {log.Entity_Id}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(log.Status)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {log.Ip_Address || "-"}
                  </td>
                </tr>
              ))}
              {!data?.logs?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No audit logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                  disabled={filters.page <= 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.min(data.pagination.totalPages, f.page + 1) }))}
                  disabled={filters.page >= data.pagination.totalPages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
