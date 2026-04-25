import { useEffect, useMemo, useState } from "react";
import AlertCard, { type AlertData } from "@/components/AlertCard";
import { useQuery } from "@tanstack/react-query";
import { getProblemsFiltered, resolveProblem } from "@/services/problemService";
import { usePanicAlerts } from "@/contexts/PanicAlertsContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, Filter, Users, TrendingUp, TrendingDown,
  Clock, ArrowRight, Activity, UserCheck, Sparkles
} from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
  BarChart, Bar
} from "recharts";

const MapContainerAny = MapContainer as unknown as React.ComponentType<any>;
const TileLayerAny = TileLayer as unknown as React.ComponentType<any>;
const MarkerAny = Marker as unknown as React.ComponentType<any>;
const PopupAny = Popup as unknown as React.ComponentType<any>;

type AdminStatsResponse = {
  generatedAt: string;
  activeAlerts?: number;
  activePanicAlerts?: number;
  activeIssues?: number;
  totalUsers?: number;
  totalWorkers?: number;
  alertTrends: { key: string; month: string; alerts: number }[];
  workersByCountry: { name: string; value: number }[];
  weeklyOverview: { day: string; panic: number; issue: number }[];
  recentActivity: { id: string; eventType: "panic" | "issue" | "registration"; action: string; user: string; title: string | null; createdAt: string | null }[];
};

const COUNTRY_COLORS = [
  "hsl(187, 78%, 38%)",
  "hsl(38, 92%, 50%)",
  "hsl(152, 60%, 42%)",
  "hsl(270, 60%, 55%)",
  "hsl(0, 72%, 55%)",
  "hsl(215, 65%, 55%)",
];

const ITEMS_PER_PAGE = 6;

const tooltipStyle = {
  backgroundColor: "hsl(0, 0%, 100%)",
  border: "none",
  borderRadius: "12px",
  fontSize: "12px",
  boxShadow: "0 8px 30px -8px rgba(0,0,0,0.12)",
  padding: "8px 12px",
};

const defaultMarkerIcon = L.icon({
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const panicPulseIcon = L.divIcon({
  className: "",
  html: '<div class="panic-pulse-marker"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function AdminView({ title = "Mission Control" }: { title?: string }) {
  const { alerts: panicAlerts, resolve: resolvePanic } = usePanicAlerts();
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState<"active" | "resolved" | "all">("active");
  const [searchText, setSearchText] = useState("");

  const { data: problems = [], refetch: refetchProblems } = useQuery({
    queryKey: ["problems", statusFilter, searchText],
    queryFn: () =>
      getProblemsFiltered({
        status: statusFilter,
        type: "all",
        q: searchText,
        limit: 500,
      }),
  });

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = useMemo(() => {
    return async () => {
      setStatsLoading(true);
      try {
        const res = await apiClient.get<AdminStatsResponse>("/api/admin/stats");
        setStats(res.data);
      } finally {
        setStatsLoading(false);
      }
    };
  }, []);

  useEffect(() => {
    fetchStats();

    const t = window.setInterval(() => {
      fetchStats();
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(t);
    };
  }, [fetchStats]);

  useEffect(() => {
    if (!panicAlerts || panicAlerts.length === 0) return;
    fetchStats();
  }, [panicAlerts?.[0]?.ID, fetchStats]);

  const monthlyData = useMemo(() => {
    return (stats?.alertTrends ?? []).map((x) => ({ month: x.month, alerts: Number(x.alerts ?? 0) }));
  }, [stats]);

  const countryData = useMemo(() => {
    return (stats?.workersByCountry ?? []).map((x, i) => ({
      name: x.name,
      value: Number(x.value ?? 0),
      color: COUNTRY_COLORS[i % COUNTRY_COLORS.length]!,
    }));
  }, [stats]);

  const trendData = useMemo(() => {
    return (stats?.weeklyOverview ?? []).map((x) => ({
      day: x.day,
      panic: Number(x.panic ?? 0),
      issue: Number(x.issue ?? 0),
    }));
  }, [stats]);

  const formatTimeAgo = useMemo(() => {
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    return (iso: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      const diffMs = d.getTime() - Date.now();
      const diffSec = Math.round(diffMs / 1000);
      const absSec = Math.abs(diffSec);
      if (absSec < 60) return rtf.format(diffSec, "second");
      const diffMin = Math.round(diffSec / 60);
      if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
      const diffHour = Math.round(diffMin / 60);
      if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
      const diffDay = Math.round(diffHour / 24);
      return rtf.format(diffDay, "day");
    };
  }, []);

  const recentActivity = useMemo(() => {
    return (stats?.recentActivity ?? []).map((x) => {
      const type = x.eventType === "panic" ? ("panic" as const) : x.eventType === "issue" ? ("issue" as const) : ("info" as const);
      const action = x.title ? `${x.action} - ${x.title}` : x.action;
      return {
        id: x.id,
        action,
        user: x.user,
        time: formatTimeAgo(x.createdAt),
        type,
      };
    });
  }, [stats, formatTimeAgo]);

  const panicMarkers = useMemo(() => {
    return (panicAlerts ?? [])
      .map((p) => {
        const lat = Number((p as any)?.Lat);
        const lng = Number((p as any)?.Lng);
        return {
          id: Number(p.ID ?? 0),
          title: (p.Title ?? "Panic").toString(),
          name: (p.worker_ID ?? "Worker").toString(),
          date: p.Updated_On ? new Date(String(p.Updated_On)).toLocaleDateString() : "",
          lat: Number.isFinite(lat) ? lat : Number.NaN,
          lng: Number.isFinite(lng) ? lng : Number.NaN,
          passportPhoto: (p.passportPhoto ?? "").toString(),
        };
      })
      .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
  }, [panicAlerts]);

  const alerts: AlertData[] = useMemo(() => {
    const panicAsAlerts: AlertData[] = (panicAlerts ?? []).map((p) => {
      const updatedOn = p.Updated_On ? new Date(p.Updated_On as any) : new Date();
      return {
        id: Number(p.ID),
        name: (p.worker_ID ?? "Worker").toString(),
        idNumber: (p.Prob_ID ?? "").toString(),
        workerId: (p.worker_ID ?? "").toString(),
        type: "Panic Alert",
        status: "active",
        description: (p.Description ?? "").toString(),
        employer: (p.Company_Name ?? undefined) as any,
        date: updatedOn.toLocaleDateString(),
        time: updatedOn.toLocaleTimeString(),
        by: "Worker",
        comments: 0,
      };
    });

    const issuesAsAlerts: AlertData[] = (problems ?? []).map((p) => {
      const title = (p.Title as string | undefined) ?? "";
      const resolvedRaw = (p as any)?.IsResolved;
      const isResolved = resolvedRaw === true || resolvedRaw === 1 || resolvedRaw === "1";
      return {
        id: Number(p.ProblemAndActionId),
        name: (p.MemberName as string | undefined) ?? (p.FullName as string | undefined) ?? "Unknown",
        idNumber: (p.PassportNumber as string | undefined) ?? "",
        type: "Issue",
        status: isResolved ? "resolved" : "active",
        description: (p.Description as string | undefined) ?? title,
        employer: (p.EmployerName as string | undefined) ?? undefined,
        lat: p.Lat != null ? Number(p.Lat as any) : Number.NaN,
        lng: p.Lng != null ? Number(p.Lng as any) : Number.NaN,
        date: (p.Date as string | undefined) ?? "",
        time: (p.Time as string | undefined) ?? "",
        by: (p.ReporterName as string | undefined) ?? "System",
        comments: 0,
      };
    });

    return [...panicAsAlerts, ...issuesAsAlerts].sort((a, b) => b.id - a.id);
  }, [panicAlerts, problems]);

  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  const visibleAlerts = useMemo(() => {
    if (dismissedIds.length === 0) return alerts;
    return alerts.filter((a) => !dismissedIds.includes(a.id));
  }, [alerts, dismissedIds]);

  const [filter, setFilter] = useState<"all" | "panic" | "issue">("all");
  const [page, setPage] = useState(1);

  const filtered = visibleAlerts
    .filter((a) => {
      if (filter === "panic") return a.type === "Panic Alert";
      if (filter === "issue") return a.type !== "Panic Alert";
      return true;
    });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const panicCount = Number(stats?.activePanicAlerts ?? (panicAlerts ?? []).length);
  const issueCount = Number(stats?.activeIssues ?? visibleAlerts.filter(a => a.type !== "Panic Alert").length);
  const workerCount = Number(
    stats?.totalWorkers ?? stats?.workersByCountry?.reduce((sum, x) => sum + Number(x.value ?? 0), 0) ?? 0
  );
  const activeAlertsCount = Number(stats?.activeAlerts ?? visibleAlerts.length);

  return (
    <>
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(215,32%,22%)] to-[hsl(187,78%,25%)] p-7 mb-7 shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-widest">{title}</span>
          </div>
          <h1 className="text-2xl font-bold text-[hsl(0,0%,100%)] mb-1.5">Welcome back, {user?.name ?? "there"}</h1>
          <p className="text-[hsl(210,20%,75%)] text-sm max-w-lg">Here's what's happening with your migrant workers today. Stay on top of alerts and manage your workforce efficiently.</p>
          <div className="flex gap-3 mt-5">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(0,0%,100%)]/10 text-[hsl(0,0%,100%)] text-xs font-medium backdrop-blur-md border border-[hsl(0,0%,100%)]/10">
              <Activity className="w-3.5 h-3.5" />
              {alerts.length} Active Alerts
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(0,0%,100%)]/10 text-[hsl(0,0%,100%)] text-xs font-medium backdrop-blur-md border border-[hsl(0,0%,100%)]/10">
              <Users className="w-3.5 h-3.5" />
              {workerCount} Workers
            </span>
          </div>
        </div>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-8 w-44 h-44 rounded-full bg-primary/10 blur-2xl" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            </div>
          ))
        ) : (
          [
            { icon: AlertTriangle, value: activeAlertsCount, label: "Total Alerts", trend: "", trendDir: "down", iconBg: "bg-primary/10", iconColor: "text-primary" },
            { icon: AlertTriangle, value: panicCount, label: "Panic Alerts", trend: "", trendDir: "up", iconBg: "bg-destructive/10", iconColor: "text-destructive" },
            { icon: Filter, value: issueCount, label: "Issues Reported", trend: "", trendDir: "down", iconBg: "bg-warning/10", iconColor: "text-warning" },
            { icon: Users, value: workerCount, label: "Total Workers", trend: "", trendDir: "up", iconBg: "bg-success/10", iconColor: "text-success" },
          ].map((stat) => (
            <div key={stat.label} className="group relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br from-primary/25 via-foreground/5 to-warning/15 shadow-xl shadow-foreground/[0.06]">
              <div className="rounded-2xl glass-surface premium-ring p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
                <div className="flex-1">
                  <p className="text-3xl font-bold text-foreground tracking-tight leading-none">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
                {stat.trend ? (
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold premium-field trend-badge-shimmer ${
                      stat.trendDir === "up" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {stat.trendDir === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span className="relative z-10">{stat.trend}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border/60 p-6 mb-7">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Active Panic Alerts</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Live alerts stay here until resolved</p>
          </div>
          <span className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg font-medium">
            {(panicAlerts ?? []).length} active
          </span>
        </div>

        {(panicAlerts ?? []).length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium text-foreground">No active panic alerts</p>
            <p className="text-xs text-muted-foreground mt-1">New panic alerts will appear here in real time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(panicAlerts ?? []).slice(0, 12).map((p) => {
              const updatedOn = p.Updated_On ? new Date(p.Updated_On as any) : new Date();
              const alert: AlertData = {
                id: Number(p.ID),
                name: (p.worker_ID ?? "Worker").toString(),
                idNumber: (p.Prob_ID ?? "").toString(),
                workerId: (p.worker_ID ?? "").toString(),
                type: "Panic Alert",
                description: (p.Description ?? "").toString(),
                employer: (p.Company_Name ?? undefined) as any,
                date: updatedOn.toLocaleDateString(),
                time: updatedOn.toLocaleTimeString(),
                by: "Worker",
                comments: 0,
              };

              return (
                <div key={p.ID} className="relative">
                  <AlertCard
                    alert={alert}
                    onDismiss={() => {
                      resolvePanic(Number(p.ID));
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Operations Map */}
      <div className="bg-card rounded-2xl border border-border/60 p-6 mb-7">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Live Operations Map</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Active panic alerts with last known GPS location</p>
          </div>
          <span className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg font-medium">
            {visibleAlerts.filter((a) => a.type === "Panic Alert").length} panic alerts
          </span>
        </div>

        {panicMarkers.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium text-foreground">No mappable panic incidents</p>
            <p className="text-xs text-muted-foreground mt-1">Panic alerts will appear here once GPS coordinates are available.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-border/60">
            <MapContainerAny
              center={[
                (panicMarkers[0]?.lat as number) ?? 3.139,
                (panicMarkers[0]?.lng as number) ?? 101.6869,
              ]}
              zoom={11}
              scrollWheelZoom
              style={{ height: 360, width: "100%" }}
            >
              <TileLayerAny
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {panicMarkers.map((a) => (
                  <MarkerAny
                    key={a.id}
                    position={[a.lat as number, a.lng as number]}
                    icon={panicPulseIcon ?? defaultMarkerIcon}
                  >
                    <PopupAny>
                      <div>
                        <div style={{ fontWeight: 700 }}>{a.name}</div>
                        <div style={{ fontSize: 12, marginTop: 6 }}>{a.date}</div>
                      </div>
                    </PopupAny>
                  </MarkerAny>
                ))}
            </MapContainerAny>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-foreground">Alert Trends</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Monthly overview of all alerts</p>
            </div>
            <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg font-medium">Last 12 months</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(187, 78%, 38%)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(187, 78%, 38%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 93%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="alerts" stroke="hsl(187, 78%, 38%)" fill="url(#colorAlerts)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-bold text-foreground mb-1">Workers by Country</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribution overview</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={countryData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} dataKey="value" paddingAngle={5} strokeWidth={0}>
                {countryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 justify-center">
            {countryData.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-[11px] text-muted-foreground font-medium">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-bold text-foreground mb-1">Weekly Overview</h3>
          <p className="text-xs text-muted-foreground mb-4">Panic vs Issues this week</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={trendData} barGap={3}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="panic" fill="hsl(0, 72%, 55%)" radius={[6, 6, 0, 0]} barSize={12} />
              <Bar dataKey="issue" fill="hsl(38, 92%, 50%)" radius={[6, 6, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-3 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-[11px] text-muted-foreground font-medium">Panic</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-[11px] text-muted-foreground font-medium">Issues</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-foreground">Recent Activity</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Latest events and updates</p>
            </div>
            <button className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-0.5">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors group">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
                  item.type === "panic" ? "bg-destructive/10" :
                  item.type === "issue" ? "bg-warning/10" :
                  "bg-primary/10"
                }`}>
                  {item.type === "panic" ? <AlertTriangle className="w-4 h-4 text-destructive" /> :
                   item.type === "issue" ? <Filter className="w-4 h-4 text-warning" /> :
                   <UserCheck className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium">{item.action}</p>
                  <p className="text-[11px] text-muted-foreground">by {item.user}</p>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  <span className="text-[11px] font-medium">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">Alert Feed</h2>
          <span className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg font-medium">{filtered.length} total</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(1);
            }}
            placeholder="Search alerts…"
            className="h-9 w-48 rounded-xl border border-border/60 bg-background px-3 text-xs"
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="h-9 rounded-xl border border-border/60 bg-background px-3 text-xs"
          >
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>

          <div className="flex gap-1.5 bg-muted/40 p-1 rounded-xl">
            {(["all", "panic", "issue"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setPage(1);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  filter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "All" : f === "panic" ? "Panic" : "Issues"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {paginated.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onDismiss={async (id) => {
              if (alert.type === "Panic Alert") {
                await resolvePanic(id);
                return;
              }

              await resolveProblem(id);
              setDismissedIds((prev) => [...prev, id]);
              refetchProblems();
            }}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-7">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2.5 rounded-xl bg-card border border-border/60 hover:bg-muted disabled:opacity-30 transition-colors">
            ←
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 rounded-xl text-xs font-semibold transition-all ${page === p ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border/60 text-foreground hover:bg-muted"}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2.5 rounded-xl bg-card border border-border/60 hover:bg-muted disabled:opacity-30 transition-colors">
            →
          </button>
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-border/40 text-center">
        <p className="text-[11px] text-muted-foreground/60">Copyright © 2018 MWMSYS All Rights Reserved</p>
      </div>
    </>
  );
}
