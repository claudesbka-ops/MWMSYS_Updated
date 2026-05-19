import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Shield } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { ComplianceScoreCard } from "@/components/compliance/ComplianceScoreCard";
import { ComplianceAlertList } from "@/components/compliance/ComplianceAlertList";
import { EmployerScoreTable } from "@/components/compliance/EmployerScoreTable";
import { apiClient } from "@/services/apiClient";

interface DashboardSummary {
  criticalCount: number;
  highCount: number;
  avgScore: number;
  mostAtRiskEmployer: string | null;
  lastScannedAt: string | null;
}

interface ScanSummary {
  totalWorkers: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  scoresUpdated: number;
  scanRunAt: string;
}

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

interface EmployerScore {
  Id: number;
  Employer_Id: string;
  Score: number;
  Total_Workers: number;
  Expired_Docs: number;
  Expiring_Soon: number;
  Missing_Docs: number;
  Active_Disputes: number;
  Scanned_At: string;
}

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiClient.get("/Api/Compliance/Dashboard");
  return res.data;
}

async function runComplianceScan(): Promise<ScanSummary> {
  const res = await apiClient.post("/Api/Compliance/Scan");
  return res.data;
}

async function fetchAlerts(): Promise<{ alerts: Alert[]; total: number }> {
  const res = await apiClient.get("/Api/Compliance/Alerts", {
    params: { limit: 50 },
  });
  return res.data;
}

async function fetchScores(): Promise<{ scores: EmployerScore[] }> {
  const res = await apiClient.get("/Api/Compliance/Scores");
  return res.data;
}

async function resolveAlert(alertId: number): Promise<void> {
  await apiClient.patch(`/Api/Compliance/Alerts/${alertId}/Resolve`);
}

export default function ComplianceDashboardPage() {
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  // Queries
  const summaryQuery = useQuery({
    queryKey: ["compliance", "dashboard"],
    queryFn: fetchDashboardSummary,
  });

  const alertsQuery = useQuery({
    queryKey: ["compliance", "alerts"],
    queryFn: fetchAlerts,
  });

  const scoresQuery = useQuery({
    queryKey: ["compliance", "scores"],
    queryFn: fetchScores,
  });

  // Mutations
  const scanMutation = useMutation({
    mutationFn: runComplianceScan,
    onSuccess: (data) => {
      toast.success(
        `Scan complete: ${data.totalWorkers} workers checked, ${data.criticalAlerts} critical alerts`
      );
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: () => {
      toast.error("Scan failed. Please try again.");
    },
    onSettled: () => {
      setIsScanning(false);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", "alerts"] });
      queryClient.invalidateQueries({ queryKey: ["compliance", "dashboard"] });
    },
  });

  const handleScan = () => {
    setIsScanning(true);
    scanMutation.mutate();
  };

  const summary = summaryQuery.data;
  const alerts = alertsQuery.data?.alerts || [];
  const scores = scoresQuery.data?.scores || [];

  // Calculate workers at risk (critical + high alerts)
  const workersAtRisk = alerts.filter(
    (a) => !a.Is_Resolved && (a.Severity === "CRITICAL" || a.Severity === "HIGH")
  ).length;

  const isLoading =
    summaryQuery.isLoading || alertsQuery.isLoading || scoresQuery.isLoading;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-slate-900">Compliance Dashboard</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            AI-powered compliance monitoring and alerting
          </p>
        </div>
        <div className="flex items-center gap-3">
          {summary?.lastScannedAt && (
            <span className="text-xs text-slate-500">
              Last scanned: {new Date(summary.lastScannedAt).toLocaleString()}
            </span>
          )}
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "Scanning..." : "Run Compliance Scan"}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ComplianceScoreCard
          title="Critical Alerts"
          value={summary?.criticalCount || 0}
          subtitle="Expired documents"
          type="critical"
          icon="alert"
          isLoading={isLoading}
        />
        <ComplianceScoreCard
          title="High Priority"
          value={summary?.highCount || 0}
          subtitle="Expiring within 7 days"
          type="high"
          icon="alert"
          isLoading={isLoading}
        />
        <ComplianceScoreCard
          title="Avg Compliance Score"
          value={summary?.avgScore || 0}
          subtitle="Out of 100"
          type={summary && summary.avgScore >= 75 ? "good" : summary && summary.avgScore >= 50 ? "medium" : "critical"}
          icon="check"
          isLoading={isLoading}
        />
        <ComplianceScoreCard
          title="Workers at Risk"
          value={workersAtRisk}
          subtitle="Critical or high priority"
          type={workersAtRisk > 0 ? "high" : "good"}
          icon="users"
          isLoading={isLoading}
        />
      </div>

      {/* Employer Scores Table */}
      <div className="mb-6">
        <EmployerScoreTable scores={scores} isLoading={scoresQuery.isLoading} />
      </div>

      {/* Alerts List */}
      <div>
        <ComplianceAlertList
          alerts={alerts}
          isLoading={alertsQuery.isLoading}
          onResolve={(id) => resolveMutation.mutateAsync(id)}
        />
      </div>
    </DashboardLayout>
  );
}
