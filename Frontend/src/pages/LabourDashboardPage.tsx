import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ShieldCheck, Users, Building2, AlertTriangle, Scale,
  TrendingUp, TrendingDown, BarChart3, FileText, ArrowUpRight, Sparkles,
} from "lucide-react";
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

const TABS = ["Overview", "Compliance", "Disputes"] as const;
type Tab = (typeof TABS)[number];

export default function LabourDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["labour", "dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/Api/Authority/Labour/Dashboard");
      return res.data as LabourStats;
    },
  });

  const kpis = [
    {
      icon: Users,
      label: "Total Workers",
      value: stats?.totalWorkers ?? 0,
      trend: "+4%",
      up: true,
      accent: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
      text: "text-blue-600",
    },
    {
      icon: Building2,
      label: "Active Employers",
      value: stats?.totalEmployers ?? 0,
      trend: "+2%",
      up: true,
      accent: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
    },
    {
      icon: AlertTriangle,
      label: "Compliance Issues",
      value: stats?.complianceIssues ?? 0,
      trend: "-2%",
      up: false,
      accent: "from-red-500 to-red-600",
      bg: "bg-red-50",
      text: "text-red-600",
    },
    {
      icon: Scale,
      label: "Active Disputes",
      value: stats?.activeDisputes ?? 0,
      trend: "+1%",
      up: true,
      accent: "from-amber-500 to-amber-600",
      bg: "bg-amber-50",
      text: "text-amber-600",
    },
  ];

  return (
    <DashboardLayout>
      {/* Dark welcome banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 mb-6 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">Labour Department</p>
          <h1 className="text-2xl font-bold text-white">Workforce Oversight Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">National compliance monitoring &amp; labour analytics</p>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{isLoading ? "—" : (stats?.totalWorkers ?? 0)}</p>
            <p className="text-slate-400 text-xs mt-1">Workers</p>
          </div>
          <div className="w-px h-10 bg-slate-700" />
          <div className="text-center">
            <p className="text-3xl font-bold text-amber-400">{isLoading ? "—" : (stats?.activeDisputes ?? 0)}</p>
            <p className="text-slate-400 text-xs mt-1">Disputes</p>
          </div>
          <div className="w-px h-10 bg-slate-700" />
          <div className="text-center">
            <p className="text-3xl font-bold text-red-400">{isLoading ? "—" : (stats?.complianceIssues ?? 0)}</p>
            <p className="text-slate-400 text-xs mt-1">Issues</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map(({ icon: Icon, label, value, trend, up, bg, text }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}>
                  <Icon className={`w-5 h-5 ${text}`} />
                </div>
                <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {trend}
                </span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{value}</p>
              <p className="text-sm text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "Overview" && (
          <>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" /> Workforce Statistics
                </h2>
                <span className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer hover:text-blue-500">
                  View all <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
              <WorkforceStatsWidget />
            </div>
            
            {/* AI Copilot Widget */}
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500 text-white">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-purple-900">Labour Intelligence AI</h3>
                    <p className="text-sm text-purple-700">Analyze workforce compliance & risks</p>
                  </div>
                </div>
                <Link
                  to="/labour-copilot"
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
                >
                  Open AI
                </Link>
              </div>
            </div>
          </>
        )}

        {activeTab === "Compliance" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Compliance Overview
              </h2>
              <span className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer hover:text-emerald-500">
                View all <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            <ComplianceOverviewWidget />
          </div>
        )}

        {activeTab === "Disputes" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" /> Dispute Overview
              </h2>
              <span className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer hover:text-amber-500">
                View all <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            <DisputeOverviewWidget />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
