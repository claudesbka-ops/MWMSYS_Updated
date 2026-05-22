import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Globe2, Users, AlertTriangle, Calendar, FileCheck,
  TrendingUp, TrendingDown, ArrowUpRight, ShieldAlert, MapPin, Sparkles,
} from "lucide-react";
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

const TABS = ["Overview", "At-Risk", "Documents", "Workers"] as const;
type Tab = (typeof TABS)[number];

export default function EmbassyDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["embassy", "dashboard"],
    queryFn: async () => {
      const res = await apiClient.get("/Api/Authority/Embassy/Dashboard");
      return res.data as EmbassyStats;
    },
  });

  const kpis = [
    {
      icon: Users,
      label: "Total Nationals",
      value: stats?.totalNationals ?? 0,
      trend: "+3%",
      up: true,
      bg: "bg-blue-50",
      text: "text-blue-600",
    },
    {
      icon: ShieldAlert,
      label: "At Risk",
      value: stats?.atRiskCount ?? 0,
      trend: "-2%",
      up: false,
      bg: "bg-red-50",
      text: "text-red-600",
    },
    {
      icon: Calendar,
      label: "Docs Expiring Soon",
      value: stats?.docsExpiringCount ?? 0,
      trend: "+1%",
      up: false,
      bg: "bg-amber-50",
      text: "text-amber-600",
    },
    {
      icon: MapPin,
      label: "Countries Covered",
      value: "—",
      trend: "stable",
      up: true,
      bg: "bg-purple-50",
      text: "text-purple-600",
    },
  ];

  return (
    <DashboardLayout>
      {/* Dark welcome banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 p-6 mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe2 className="w-4 h-4 text-blue-400" />
            <p className="text-blue-300 text-sm">Embassy Portal</p>
          </div>
          <h1 className="text-2xl font-bold text-white">Nationals Monitoring Dashboard</h1>
          <p className="text-blue-200 text-sm mt-1">Track welfare, documents &amp; risk status of nationals abroad</p>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{isLoading ? "—" : (stats?.totalNationals ?? 0)}</p>
            <p className="text-blue-300 text-xs mt-1">Nationals</p>
          </div>
          <div className="w-px h-10 bg-blue-800" />
          <div className="text-center">
            <p className="text-3xl font-bold text-red-400">{isLoading ? "—" : (stats?.atRiskCount ?? 0)}</p>
            <p className="text-blue-300 text-xs mt-1">At Risk</p>
          </div>
          <div className="w-px h-10 bg-blue-800" />
          <div className="text-center">
            <p className="text-3xl font-bold text-amber-400">{isLoading ? "—" : (stats?.docsExpiringCount ?? 0)}</p>
            <p className="text-blue-300 text-xs mt-1">Expiring Docs</p>
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
                <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
                  trend === "stable" ? "bg-slate-100 text-slate-500" :
                  up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                }`}>
                  {trend !== "stable" && (up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" /> At-Risk Nationals
                  </h2>
                  <span onClick={() => setActiveTab("At-Risk")} className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer hover:text-red-500">
                    View all <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
                <AtRiskNationalsWidget />
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-500" /> Document Expiry Monitor
                  </h2>
                  <span onClick={() => setActiveTab("Documents")} className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer hover:text-amber-500">
                    View all <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
                <NationalDocExpiryWidget />
              </div>
            </div>
            
            {/* AI Copilot Widget */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500 text-white">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900">Ask Embassy AI</h3>
                    <p className="text-sm text-blue-700">Get insights about your nationals</p>
                  </div>
                </div>
                <Link
                  to="/embassy-copilot"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Open AI
                </Link>
              </div>
            </div>
          </div>
        )}

        {activeTab === "At-Risk" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> At-Risk Nationals
              </h2>
            </div>
            <AtRiskNationalsWidget />
          </div>
        )}

        {activeTab === "Documents" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" /> Document Expiry Monitor
              </h2>
            </div>
            <NationalDocExpiryWidget />
          </div>
        )}

        {activeTab === "Workers" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-500" /> National Workers List
              </h2>
            </div>
            <NationalWorkerTable />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
