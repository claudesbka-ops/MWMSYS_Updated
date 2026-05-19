import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import { WorkerRiskTable } from "@/components/risk/WorkerRiskTable";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

interface DashboardSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgScore: number;
  topRiskWorkers: Array<{
    workerId: string;
    workerName: string | null;
    score: number;
    level: "low" | "medium" | "high" | "critical";
    topFactor: string;
  }>;
  lastCalculatedAt: string | null;
}

function StatCard({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type: "critical" | "high" | "medium" | "low";
}) {
  const colors = {
    critical: "bg-red-50 border-red-200 text-red-700",
    high: "bg-orange-50 border-orange-200 text-orange-700",
    medium: "bg-amber-50 border-amber-200 text-amber-700",
    low: "bg-green-50 border-green-200 text-green-700",
  };

  return (
    <div className={`rounded-2xl border p-5 ${colors[type]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs opacity-80 mt-1">{label}</p>
    </div>
  );
}

export default function RiskDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculatingAll, setCalculatingAll] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/Api/Risk/Dashboard");
      setSummary(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleCalculateAll = async () => {
    setCalculatingAll(true);
    try {
      const res = await apiClient.post("/Api/Risk/CalculateAll");
      toast.success(`Calculated ${res.data.calculated} worker risk scores`);
      fetchSummary();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to calculate");
    } finally {
      setCalculatingAll(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-slate-900">Risk Dashboard</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Worker risk assessment based on documents, disputes, and compliance
          </p>
        </div>
        <div className="flex items-center gap-3">
          {summary?.lastCalculatedAt && (
            <span className="text-xs text-slate-500">
              Last calculated: {new Date(summary.lastCalculatedAt).toLocaleString()}
            </span>
          )}
          <Button
            onClick={handleCalculateAll}
            disabled={calculatingAll}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${calculatingAll ? "animate-spin" : ""}`} />
            {calculatingAll ? "Calculating..." : "Calculate All"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Critical Risk" value={summary?.critical || 0} type="critical" />
        <StatCard label="High Risk" value={summary?.high || 0} type="high" />
        <StatCard label="Medium Risk" value={summary?.medium || 0} type="medium" />
        <StatCard label="Low Risk" value={summary?.low || 0} type="low" />
      </div>

      {/* Average Score */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">Average Risk Score</p>
            <p className="text-2xl font-bold text-slate-900">
              {summary?.avgScore || 0}
              <span className="text-sm font-normal text-slate-500"> /75</span>
            </p>
          </div>
          <div className="w-32 bg-slate-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${
                (summary?.avgScore || 0) > 56
                  ? "bg-red-500"
                  : (summary?.avgScore || 0) > 37
                  ? "bg-orange-500"
                  : (summary?.avgScore || 0) > 19
                  ? "bg-amber-500"
                  : "bg-green-500"
              }`}
              style={{ width: `${((summary?.avgScore || 0) / 75) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Workers Table */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Top Risk Workers</h2>
        <WorkerRiskTable
          workers={summary?.topRiskWorkers || []}
          isLoading={loading}
          onRecalculate={fetchSummary}
        />
      </div>
    </DashboardLayout>
  );
}
