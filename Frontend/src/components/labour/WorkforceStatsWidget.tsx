import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, Building2, FileCheck } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkforceStats {
  nationalities: Array<{ nationality: number; count: number }>;
  employers: Array<{ employerId: string; employerName: string; count: number }>;
  complianceStatus: {
    valid: number;
    expiring: number;
    expired: number;
  };
}

const COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6"];

export function WorkforceStatsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["labour", "workforceStats"],
    queryFn: async () => {
      const res = await apiClient.get("/Api/Authority/Labour/WorkforceStats");
      return res.data as WorkforceStats;
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-slate-900">Workforce Statistics</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const nationalityData =
    data?.nationalities.map((n) => ({
      name: `Country ${n.nationality}`,
      count: n.count,
    })) || [];

  const employerData =
    data?.employers.slice(0, 10).map((e) => ({
      name: e.employerName.length > 20 ? e.employerName.slice(0, 20) + "..." : e.employerName,
      count: e.count,
    })) || [];

  const complianceData = [
    { name: "Valid", value: data?.complianceStatus.valid || 0, color: "#22c55e" },
    { name: "Expiring", value: data?.complianceStatus.expiring || 0, color: "#f59e0b" },
    { name: "Expired", value: data?.complianceStatus.expired || 0, color: "#ef4444" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-slate-900">Workforce Statistics</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nationality Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            By Nationality (Top 10)
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nationalityData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Employer Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            By Employer (Top 10)
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employerData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Compliance Status */}
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Document Compliance
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={complianceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {complianceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
