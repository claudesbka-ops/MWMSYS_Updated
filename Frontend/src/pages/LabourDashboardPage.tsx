import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Users, Building2, AlertTriangle, Scale } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { WorkforceStatsWidget } from "@/components/labour/WorkforceStatsWidget";
import { ComplianceOverviewWidget } from "@/components/labour/ComplianceOverviewWidget";
import { DisputeOverviewWidget } from "@/components/labour/DisputeOverviewWidget";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/ui/skeleton";

interface LabourStats {
  totalWorkers: number;
  totalEmployers: number;
  complianceIssues: number;
  activeDisputes: number;
}

export default function LabourDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["labour", "dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/Api/Authority/Labour/Dashboard");
      return res.data as LabourStats;
    },
  });

  const StatCard = ({
    icon: Icon,
    label,
    value,
    color,
  }: {
    icon: typeof ShieldCheck;
    label: string;
    value: number | string;
    color: string;
  }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Labour Department Dashboard</h1>
            <p className="text-sm text-slate-500">National workforce oversight and compliance monitoring</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Users}
            label="Total Workers"
            value={stats?.totalWorkers || 0}
            color="bg-blue-100 text-blue-600"
          />
          <StatCard
            icon={Building2}
            label="Active Employers"
            value={stats?.totalEmployers || 0}
            color="bg-green-100 text-green-600"
          />
          <StatCard
            icon={AlertTriangle}
            label="Compliance Issues"
            value={stats?.complianceIssues || 0}
            color="bg-red-100 text-red-600"
          />
          <StatCard
            icon={Scale}
            label="Active Disputes"
            value={stats?.activeDisputes || 0}
            color="bg-amber-100 text-amber-600"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-6">
        {/* Workforce Statistics */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Workforce Statistics
          </h2>
          <WorkforceStatsWidget />
        </section>

        {/* Compliance Overview */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-500" />
            Compliance Overview
          </h2>
          <ComplianceOverviewWidget />
        </section>

        {/* Dispute Overview */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Scale className="w-5 h-5 text-purple-500" />
            Dispute Overview
          </h2>
          <DisputeOverviewWidget />
        </section>
      </div>
    </DashboardLayout>
  );
}
