import { useQuery } from "@tanstack/react-query";
import { getProblems } from "@/services/problemService";
import { AlertTriangle, ShieldCheck, BadgeAlert, Users, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LabourDeptView() {
  const navigate = useNavigate();
  const { data: problems = [] } = useQuery({
    queryKey: ["problems"],
    queryFn: getProblems,
  });

  const complianceAlerts = problems.filter((p) => ((p.Title as string | undefined) ?? "").toLowerCase().includes("visa") || ((p.Description as string | undefined) ?? "").toLowerCase().includes("permit"));

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(152,32%,18%)] to-[hsl(152,60%,25%)] p-7 mb-7 shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span className="text-xs font-medium text-success uppercase tracking-widest">Labour Department</span>
          </div>
          <h1 className="text-2xl font-bold text-[hsl(0,0%,100%)] mb-1.5">Compliance Alerts</h1>
          <p className="text-[hsl(210,20%,75%)] text-sm max-w-lg">
            Track compliance risks, permit issues, and high-priority escalations.
          </p>
        </div>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-success/20 blur-3xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {[{ icon: BadgeAlert, value: complianceAlerts.length, label: "Compliance Alerts" }, { icon: AlertTriangle, value: problems.length, label: "Total Incidents" }, { icon: Users, value: 124, label: "Workers Monitored" }, { icon: Clock, value: 12, label: "Avg SLA (hrs)" }].map(
          (stat) => (
            <div
              key={stat.label}
              className="group bg-card rounded-2xl border border-border/60 p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-success/10 group-hover:scale-110 transition-transform duration-300">
                <stat.icon className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          )
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border/60 p-6">
        <h3 className="text-sm font-bold text-foreground mb-1">Compliance Queue</h3>
        <p className="text-xs text-muted-foreground mb-4">Incidents most likely to require compliance action</p>

        {complianceAlerts.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium text-foreground">No compliance alerts</p>
            <p className="text-xs text-muted-foreground mt-1">This queue will populate when permit/visa related incidents are detected.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {complianceAlerts.slice(0, 10).map((p) => (
              <button
                type="button"
                key={String(p.ProblemAndActionId)}
                onClick={() => navigate(`/incident/${String(p.ProblemAndActionId)}`)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{(p.Title as string | undefined) ?? "Compliance Alert"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{(p.EmployerName as string | undefined) ?? "Employer"}</p>
                </div>
                <div className="text-[11px] text-muted-foreground flex-shrink-0">{(p.Date as string | undefined) ?? ""}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
