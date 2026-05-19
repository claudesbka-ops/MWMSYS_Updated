import { useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Shield } from "lucide-react";
import { toast } from "sonner";

interface Alert {
  Id: number;
  Worker_Id: string;
  Alert_Type: string;
  Severity: string;
  Days_Until_Expiry: number | null;
  Document_Type: string | null;
  Expiry_Date: string | null;
  Ai_Summary: string | null;
  Is_Resolved: boolean;
  Created_At: string;
}

interface ComplianceAlertListProps {
  alerts: Alert[];
  isLoading?: boolean;
  onResolve?: (alertId: number) => Promise<void>;
}

const severityConfig = {
  CRITICAL: {
    color: "bg-red-100 text-red-800 border-red-200",
    icon: AlertTriangle,
    label: "Critical",
  },
  HIGH: {
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: AlertTriangle,
    label: "High",
  },
  MEDIUM: {
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: Clock,
    label: "Medium",
  },
  LOW: {
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Shield,
    label: "Low",
  },
};

const documentTypeLabels: Record<string, string> = {
  passport: "Passport",
  work_permit: "Work Permit",
  insurance: "Insurance",
  contract: "Contract",
  medical: "Medical",
};

export function ComplianceAlertList({
  alerts,
  isLoading,
  onResolve,
}: ComplianceAlertListProps) {
  const [filter, setFilter] = useState<string>("all");
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const filteredAlerts =
    filter === "all" ? alerts : alerts.filter((a) => a.Severity === filter);

  const handleResolve = async (alertId: number) => {
    if (!onResolve) return;
    setResolvingId(alertId);
    try {
      await onResolve(alertId);
      toast.success("Alert resolved successfully");
    } catch (err) {
      toast.error("Failed to resolve alert");
    } finally {
      setResolvingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Compliance Alerts</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="all">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {/* Alert List */}
      <div className="divide-y divide-slate-100">
        {filteredAlerts.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No compliance alerts</p>
            <p className="text-sm text-slate-500 mt-1">
              All workers are in good standing
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const severity = severityConfig[alert.Severity as keyof typeof severityConfig] ||
              severityConfig.LOW;
            const SeverityIcon = severity.icon;

            return (
              <div
                key={alert.Id}
                className={`px-4 py-4 hover:bg-slate-50 transition-colors ${
                  alert.Is_Resolved ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${severity.color}`}
                  >
                    <SeverityIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severity.color}`}
                      >
                        {severity.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {documentTypeLabels[alert.Document_Type || ""] ||
                          alert.Document_Type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">
                      {alert.Ai_Summary || `${alert.Alert_Type} for worker ${alert.Worker_Id}`}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      {alert.Days_Until_Expiry !== null && (
                        <span>
                          {alert.Days_Until_Expiry <= 0
                            ? `Expired ${Math.abs(alert.Days_Until_Expiry)} days ago`
                            : `${alert.Days_Until_Expiry} days left`}
                        </span>
                      )}
                      {alert.Expiry_Date && (
                        <span>Expires: {new Date(alert.Expiry_Date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  {!alert.Is_Resolved && onResolve && (
                    <button
                      onClick={() => handleResolve(alert.Id)}
                      disabled={resolvingId === alert.Id}
                      className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {resolvingId === alert.Id ? "Resolving..." : "Resolve"}
                    </button>
                  )}
                  {alert.Is_Resolved && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
