import { workersData } from "@/data/workersData";
import { alertsData } from "@/data/alertsData";
import {
  Eye, HeartPulse, Banknote, Users, TrendingDown, TrendingUp,
  Sparkles, Clock, AlertTriangle, FileText, ArrowRight, Building2
} from "lucide-react";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";

const monthlyIssues = [
  { month: "Jan", visa: 1, insurance: 2, salary: 1 },
  { month: "Feb", visa: 0, insurance: 1, salary: 2 },
  { month: "Mar", visa: 2, insurance: 0, salary: 1 },
  { month: "Apr", visa: 1, insurance: 1, salary: 3 },
  { month: "May", visa: 0, insurance: 2, salary: 0 },
  { month: "Jun", visa: 1, insurance: 0, salary: 1 },
];

const tooltipStyle = {
  backgroundColor: "hsl(0, 0%, 100%)",
  border: "none",
  borderRadius: "12px",
  fontSize: "12px",
  boxShadow: "0 8px 30px -8px rgba(0,0,0,0.12)",
  padding: "8px 12px",
};

export default function EmployerView() {
  const employerName = localStorage.getItem("mwmsys_employer_name") || "ACME Construction SDN BHD";
  const myWorkers = workersData.filter(w => (w.employer ?? "").toLowerCase() === employerName.toLowerCase());
  const issueAlerts = alertsData.filter(
    (a) => a.type !== "Panic Alert" && (a.employer ?? "").toLowerCase() === employerName.toLowerCase()
  );
  const visaExpiring = 3;
  const insuranceExpiring = 2;
  const unpaidIssues = issueAlerts.filter(a => a.description?.toLowerCase().includes("salary") || a.description?.toLowerCase().includes("unpaid")).length;

  return (
    <>
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(152,40%,20%)] to-[hsl(152,60%,25%)] p-7 mb-7 shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-success" />
            <span className="text-xs font-medium text-success uppercase tracking-widest">Employer Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-[hsl(0,0%,100%)] mb-1.5">Your Workforce Overview</h1>
          <p className="text-[hsl(210,20%,75%)] text-sm max-w-lg">Monitor visa statuses, insurance compliance, and worker issues at a glance.</p>
        </div>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-success/20 blur-3xl" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {[
          { icon: Users, value: myWorkers.length, label: "My Workers", trend: "+2", trendDir: "up", iconBg: "bg-primary/10", iconColor: "text-primary" },
          { icon: Eye, value: visaExpiring, label: "Visa Expiring", trend: "+1", trendDir: "up", iconBg: "bg-warning/10", iconColor: "text-warning" },
          { icon: HeartPulse, value: insuranceExpiring, label: "Insurance Expiring", trend: "-1", trendDir: "down", iconBg: "bg-destructive/10", iconColor: "text-destructive" },
          { icon: Banknote, value: unpaidIssues, label: "Unpaid Issues", trend: "-2", trendDir: "down", iconBg: "bg-success/10", iconColor: "text-success" },
        ].map((stat) => (
          <div key={stat.label} className="group bg-card rounded-2xl border border-border/60 p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.iconBg} group-hover:scale-110 transition-transform duration-300`}>
              <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium ${stat.trendDir === "down" ? "text-success" : "text-destructive"}`}>
              {stat.trendDir === "down" ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              <span>{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Workers Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-7">
        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-bold text-foreground mb-1">Issue Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">Visa, Insurance & Salary issues by month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyIssues} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="visa" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} barSize={10} name="Visa" />
              <Bar dataKey="insurance" fill="hsl(0, 72%, 55%)" radius={[4, 4, 0, 0]} barSize={10} name="Insurance" />
              <Bar dataKey="salary" fill="hsl(187, 78%, 38%)" radius={[4, 4, 0, 0]} barSize={10} name="Salary" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-3 justify-center">
            {[{ label: "Visa", color: "bg-warning" }, { label: "Insurance", color: "bg-destructive" }, { label: "Salary", color: "bg-primary" }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${l.color}`} />
                <span className="text-[11px] text-muted-foreground font-medium">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">Worker Status</h3>
            <button className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1">
            {myWorkers.slice(0, 6).map((w) => (
              <div key={w.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{w.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{w.name}</p>
                  <p className="text-[11px] text-muted-foreground">{w.passportNo} · {w.country}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${w.status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="bg-card rounded-2xl border border-border/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Reported Issues</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Worker-reported problems requiring attention</p>
          </div>
          <span className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg font-medium">{issueAlerts.length} issues</span>
        </div>
        <div className="space-y-1">
          {issueAlerts.slice(0, 8).map((alert) => (
            <div key={alert.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{alert.description || alert.type}</p>
                <p className="text-[11px] text-muted-foreground">{alert.name} · {alert.date}</p>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground flex-shrink-0">
                <Clock className="w-3 h-3" />
                <span className="text-[11px] font-medium">{alert.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-border/40 text-center">
        <p className="text-[11px] text-muted-foreground/60">Copyright © 2018 MWMSYS All Rights Reserved</p>
      </div>
    </>
  );
}
