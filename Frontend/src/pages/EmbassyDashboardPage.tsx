import { useQuery } from "@tanstack/react-query";
import { Globe2, Users, AlertTriangle, Calendar, FileCheck } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { AtRiskNationalsWidget } from "@/components/embassy/AtRiskNationalsWidget";
import { NationalDocExpiryWidget } from "@/components/embassy/NationalDocExpiryWidget";
import { NationalWorkerTable } from "@/components/embassy/NationalWorkerTable";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/ui/skeleton";

interface EmbassyStats {
  totalNationals: number;
  atRiskCount: number;
  docsExpiringCount: number;
}

export default function EmbassyDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["embassy", "dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/Api/Authority/Embassy/Dashboard");
      return res.data as EmbassyStats;
    },
  });

  const StatCard = ({
    icon: Icon,
    label,
    value,
    color,
  }: {
    icon: typeof Globe2;
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
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Globe2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Embassy Dashboard</h1>
            <p className="text-sm text-slate-500">Monitor nationals working abroad</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={Users}
            label="Total Nationals"
            value={stats?.totalNationals || 0}
            color="bg-blue-100 text-blue-600"
          />
          <StatCard
            icon={AlertTriangle}
            label="At Risk"
            value={stats?.atRiskCount || 0}
            color="bg-red-100 text-red-600"
          />
          <StatCard
            icon={Calendar}
            label="Docs Expiring"
            value={stats?.docsExpiringCount || 0}
            color="bg-amber-100 text-amber-600"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-6">
        {/* At-Risk Section */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            At-Risk Nationals
          </h2>
          <AtRiskNationalsWidget />
        </section>

        {/* Document Expiry Section */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Document Expiry Monitor
          </h2>
          <NationalDocExpiryWidget />
        </section>

        {/* Workers List Section */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-500" />
            National Workers List
          </h2>
          <NationalWorkerTable />
        </section>
      </div>
    </DashboardLayout>
  );
}
