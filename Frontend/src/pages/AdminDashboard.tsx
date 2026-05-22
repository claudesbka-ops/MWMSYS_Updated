import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Users, Building2, AlertTriangle, ShieldCheck,
  Scale, FileText, RefreshCw, Download, ExternalLink,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { usePanicAlerts } from "@/contexts/PanicAlertsContext";
import { apiClient } from "@/services/apiClient";
import { getWorkersList } from "@/services/workerService";
import { getEmployersList } from "@/services/employerService";
import { getAllDisputes } from "@/services/disputeService";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { GlassCard } from "@/components/ui/GlassCard";
import { staggerChildren, cardItem, fadeInUp } from "@/lib/animations";

/* ── helpers ── */
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function fmtDate(str: string | null | undefined) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ── chart helpers ── */
function buildActivityData(disputes: any[], panic: any[]) {
  const map: Record<string, { date: string; disputes: number; sos: number }> = {};
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    map[key] = { date: key.slice(5), disputes: 0, sos: 0 };
  }
  disputes.forEach((d) => {
    const k = (d.submittedAt ?? "").slice(0, 10);
    if (map[k]) map[k].disputes++;
  });
  panic.forEach((p) => {
    const raw = (p.Date ?? p.createdAt ?? p.Updated_On ?? "");
    const k = String(raw).slice(0, 10);
    if (map[k]) map[k].sos++;
  });
  return Object.values(map);
}

/* ── custom tooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs space-y-1"
      style={{
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-lg)",
        color: "var(--text-primary)",
      }}
    >
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: "var(--text-secondary)" }}>{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── risk donut tooltip ── */
function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-lg)",
        color: "var(--text-primary)",
      }}
    >
      <span className="font-semibold">{payload[0].name}: </span>
      <span>{payload[0].value}</span>
    </div>
  );
}

const RISK_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"];
const RISK_LABELS = ["Critical", "High", "Medium", "Low"];

/* ════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const { alerts, resolve } = usePanicAlerts();
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();
  const [lastRefresh] = useState(() => new Date());

  /* data queries */
  const workersQ = useQuery({ queryKey: ["workers_list"], queryFn: getWorkersList, staleTime: 60_000 });
  const employersQ = useQuery({ queryKey: ["employers_list"], queryFn: getEmployersList, staleTime: 60_000 });
  const disputesQ = useQuery({ queryKey: ["dispute_list"], queryFn: () => getAllDisputes(), staleTime: 30_000 });

  const workers = workersQ.data ?? [];
  const employers = employersQ.data ?? [];
  const disputes = disputesQ.data ?? [];
  const panicAlerts = alerts ?? [];

  /* derived metrics */
  const activeAlerts = panicAlerts.filter((a: any) =>
    String(a.ProbStatus ?? "").toLowerCase() === "pending"
  ).length;

  const pendingDisputes = disputes.filter((d) => d.status === "Pending").length;

  /* expiring documents (next 30 days) */
  const expiringWorkers = useMemo(() => {
    return workers
      .filter((w) => {
        const days = daysUntil(w.Permit_Expire_Date);
        return days !== null && days >= 0 && days <= 30;
      })
      .sort((a, b) => {
        const da = daysUntil(a.Permit_Expire_Date) ?? 999;
        const db = daysUntil(b.Permit_Expire_Date) ?? 999;
        return da - db;
      })
      .slice(0, 5);
  }, [workers]);

  /* risk distribution mock (derive from disputes severity) */
  const riskDistribution = useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    disputes.forEach((d) => {
      if (d.aiSeverity === "critical") counts.Critical++;
      else if (d.aiSeverity === "high") counts.High++;
      else if (d.aiSeverity === "medium") counts.Medium++;
      else if (d.aiSeverity === "low") counts.Low++;
    });
    if (Object.values(counts).every((v) => v === 0)) {
      counts.Low = workers.length;
    }
    return RISK_LABELS.map((name, i) => ({
      name,
      value: counts[name as keyof typeof counts],
      color: RISK_COLORS[i],
    })).filter((d) => d.value > 0);
  }, [disputes, workers]);

  /* activity chart data */
  const activityData = useMemo(
    () => buildActivityData(disputes, panicAlerts),
    [disputes, panicAlerts]
  );

  /* recent SOS (last 5) */
  const recentSOS = panicAlerts.slice(0, 5);

  /* recent disputes (last 5) */
  const recentDisputes = [...disputes]
    .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime())
    .slice(0, 5);

  const minutesAgo = Math.floor((Date.now() - lastRefresh.getTime()) / 60_000);
  const refreshLabel = minutesAgo === 0 ? "just now" : `${minutesAgo}m ago`;

  const isLoading = workersQ.isLoading || employersQ.isLoading;

  return (
    <DashboardLayout>
      <motion.div
        className="space-y-6 pb-8"
        variants={shouldReduce ? undefined : fadeInUp}
        initial="initial"
        animate="animate"
      >
        {/* ── Page Header ── */}
        <PageHeader
          title="Operations Overview"
          subtitle={`Last updated ${refreshLabel}`}
          breadcrumb={[{ label: "Admin" }, { label: "Dashboard" }]}
          actions={
            <>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                style={{
                  border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)",
                  background: "var(--bg-elevated)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-accent)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                }}
                onClick={() => navigate("/admin/live-alerts")}
              >
                <RefreshCw className="w-3 h-3" />
                Run Compliance Scan
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 text-white"
                style={{ background: "var(--accent-color)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.1)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.filter = "none")
                }
              >
                <Download className="w-3 h-3" />
                Export
              </button>
            </>
          }
        />

        {/* ── Row 1: Metric Cards ── */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          variants={shouldReduce ? undefined : staggerChildren}
          initial="initial"
          animate="animate"
        >
          <MetricCard
            title="Total Workers"
            value={workers.length}
            icon={Users}
            iconColor="blue"
            loading={isLoading}
            onClick={() => navigate("/worker")}
          />
          <MetricCard
            title="Employers"
            value={employers.length}
            icon={Building2}
            iconColor="purple"
            loading={isLoading}
            onClick={() => navigate("/employer")}
          />
          <MetricCard
            title="Active SOS Alerts"
            value={activeAlerts}
            icon={AlertTriangle}
            iconColor={activeAlerts > 0 ? "red" : "green"}
            loading={isLoading}
            onClick={() => navigate("/admin/live-alerts")}
          />
          <MetricCard
            title="Pending Disputes"
            value={pendingDisputes}
            icon={Scale}
            iconColor="orange"
            loading={isLoading}
            onClick={() => navigate("/dispute")}
          />
        </motion.div>

        {/* ── Row 2: Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Activity chart (60%) */}
          <motion.div
            className="lg:col-span-3"
            variants={shouldReduce ? undefined : cardItem}
            initial="initial"
            animate="animate"
          >
            <GlassCard noPadding>
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold font-display" style={{ color: "var(--text-primary)" }}>
                    Activity — Last 30 Days
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Disputes &amp; SOS events
                  </p>
                </div>
              </div>
              <div className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={activityData} margin={{ top: 4, right: 12, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradDisputes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradSOS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.30} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                      tickLine={false}
                      axisLine={false}
                      interval={6}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-default)", strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="disputes"
                      name="Disputes"
                      stroke="#4f6ef7"
                      strokeWidth={2}
                      fill="url(#gradDisputes)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#4f6ef7" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sos"
                      name="SOS"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="url(#gradSOS)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#ef4444" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </motion.div>

          {/* Risk donut (40%) */}
          <motion.div
            className="lg:col-span-2"
            variants={shouldReduce ? undefined : cardItem}
            initial="initial"
            animate="animate"
          >
            <GlassCard noPadding className="h-full">
              <div className="px-5 pt-5 pb-3">
                <p className="text-sm font-semibold font-display" style={{ color: "var(--text-primary)" }}>
                  Risk Distribution
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  By AI severity score
                </p>
              </div>
              <div className="flex flex-col items-center pb-4">
                <div className="relative">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={riskDistribution.length ? riskDistribution : [{ name: "No data", value: 1, color: "var(--border-subtle)" }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {(riskDistribution.length ? riskDistribution : [{ color: "var(--border-subtle)" }]).map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<DonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
                      {riskDistribution.reduce((s, d) => s + d.value, 0)}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>workers</span>
                  </div>
                </div>
                <div className="px-5 w-full space-y-1.5 mt-1">
                  {riskDistribution.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                        <span style={{ color: "var(--text-secondary)" }}>{d.name}</span>
                      </div>
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* ── Row 3: Activity lists ── */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
          variants={shouldReduce ? undefined : staggerChildren}
          initial="initial"
          animate="animate"
        >
          {/* Recent SOS Alerts */}
          <motion.div variants={shouldReduce ? undefined : cardItem}>
            <GlassCard noPadding className="h-full">
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <div>
                  <p className="text-sm font-semibold font-display" style={{ color: "var(--text-primary)" }}>
                    Recent SOS Alerts
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Last 5 triggers</p>
                </div>
                <button
                  onClick={() => navigate("/admin/live-alerts")}
                  className="text-xs font-semibold flex items-center gap-1 transition-colors"
                  style={{ color: "var(--text-accent)" }}
                >
                  View all <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {recentSOS.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No active alerts</p>
                  </div>
                ) : (
                  recentSOS.map((a: any) => {
                    const isPending = String(a.ProbStatus ?? "").toLowerCase() === "pending";
                    return (
                      <div
                        key={Number(a.ID)}
                        className="flex items-center gap-3 px-5 py-3 transition-colors"
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLDivElement).style.background = "transparent")
                        }
                        onClick={() => navigate(`/incident/${Number(a.ID)}`)}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                          style={{ background: isPending ? "var(--status-danger)" : "var(--status-success)" }}
                        >
                          {String(a.MemberName ?? a.FullName ?? "?")[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                            {String(a.Title ?? a.MemberName ?? a.FullName ?? "Panic Alert")}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                            {a.Date ?? fmtDate(a.Updated_On)}
                            {a.Company_Name ? ` · ${a.Company_Name}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={isPending ? "Pending" : "Resolved"} />
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>
          </motion.div>

          {/* Expiring Documents */}
          <motion.div variants={shouldReduce ? undefined : cardItem}>
            <GlassCard noPadding className="h-full">
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <div>
                  <p className="text-sm font-semibold font-display" style={{ color: "var(--text-primary)" }}>
                    Expiring Permits
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Next 30 days</p>
                </div>
                <button
                  onClick={() => navigate("/reports/visa")}
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{ color: "var(--text-accent)" }}
                >
                  View all <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {expiringWorkers.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {isLoading ? "Loading…" : "No permits expiring soon"}
                    </p>
                  </div>
                ) : (
                  expiringWorkers.map((w) => {
                    const days = daysUntil(w.Permit_Expire_Date)!;
                    const urgent = days <= 7;
                    return (
                      <div
                        key={w.Worker_Id}
                        className="flex items-center gap-3 px-5 py-3 transition-colors"
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLDivElement).style.background = "transparent")
                        }
                        onClick={() => navigate(`/worker/${w.Worker_Id}`)}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                          style={{
                            background: urgent ? "var(--status-danger)" : "var(--status-warning)",
                          }}
                        >
                          {String(w.Name ?? "?")[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                            {w.Name ?? w.Worker_Id}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                            {fmtDate(w.Permit_Expire_Date)}
                          </p>
                        </div>
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: urgent ? "var(--status-danger-bg)" : "var(--status-warning-bg)",
                            color: urgent ? "var(--status-danger)" : "var(--status-warning)",
                          }}
                        >
                          {days}d
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>
          </motion.div>

          {/* Recent Disputes */}
          <motion.div variants={shouldReduce ? undefined : cardItem}>
            <GlassCard noPadding className="h-full">
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <div>
                  <p className="text-sm font-semibold font-display" style={{ color: "var(--text-primary)" }}>
                    Recent Disputes
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Latest submissions</p>
                </div>
                <button
                  onClick={() => navigate("/dispute")}
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{ color: "var(--text-accent)" }}
                >
                  View all <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {recentDisputes.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Scale className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {disputesQ.isLoading ? "Loading…" : "No disputes yet"}
                    </p>
                  </div>
                ) : (
                  recentDisputes.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 px-5 py-3 transition-colors"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.background = "transparent")
                      }
                      onClick={() => navigate("/dispute")}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                        style={{ background: "var(--accent-color)" }}
                      >
                        {String(d.workerName ?? "?")[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {d.workerName ?? d.workerId}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                          {d.disputeMonth} · ${d.expectedAmount - d.receivedAmount} gap
                        </p>
                      </div>
                      {d.aiSeverity && (
                        <StatusBadge status={d.aiSeverity} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>

        {/* ── Live Panic Alerts (original functionality preserved) ── */}
        {panicAlerts.length > 0 && (
          <motion.div variants={shouldReduce ? undefined : cardItem} initial="initial" animate="animate">
            <GlassCard noPadding>
              <div
                className="px-5 py-4 flex items-center gap-3"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: "var(--status-danger)" }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2.5 w-2.5"
                    style={{ background: "var(--status-danger)" }}
                  />
                </span>
                <p className="text-sm font-semibold font-display" style={{ color: "var(--text-primary)" }}>
                  Live Panic Alerts
                </p>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--status-danger-bg)", color: "var(--status-danger)" }}
                >
                  {panicAlerts.length}
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {panicAlerts.map((a: any) => (
                  <div key={Number(a.ID)} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {String(a.Title ?? "Panic Alert")}
                          </p>
                          <StatusBadge
                            status={String(a.ProbStatus ?? "pending").toLowerCase() === "pending" ? "Pending" : "Resolved"}
                          />
                        </div>
                        {a.Description ? (
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {String(a.Description)}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {a.worker_ID && <span>Worker: {String(a.worker_ID)}</span>}
                          {a.Company_Name && <span>Company: {String(a.Company_Name)}</span>}
                          {a.Current_Location && <span>Location: {String(a.Current_Location)}</span>}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                            style={{
                              background: "var(--status-success-bg)",
                              color: "var(--status-success)",
                            }}
                            onClick={() => resolve(Number(a.ID))}
                          >
                            Resolve
                          </button>
                          {String(a.ProbStatus ?? "").toLowerCase() === "pending" && (
                            <button
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                              style={{
                                background: "var(--accent-glow)",
                                color: "var(--text-accent)",
                              }}
                              onClick={async () => {
                                await apiClient.post("/Api/Incidents/Approve", { id: Number(a.ID) });
                              }}
                            >
                              Verify &amp; Approve
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] whitespace-nowrap flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                        {a.Updated_On ? new Date(String(a.Updated_On)).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
