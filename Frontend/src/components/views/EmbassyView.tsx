import { useQuery } from "@tanstack/react-query";
import { getProblems } from "@/services/problemService";
import { AlertTriangle, Globe2, ShieldAlert, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function EmbassyView({ variant }: { variant: "source" | "destination" }) {
  const navigate = useNavigate();
  const { data: problems = [] } = useQuery({
    queryKey: ["problems"],
    queryFn: getProblems,
  });

  const panicCount = problems.filter((p) => (p.Title as string | undefined)?.toLowerCase().includes("panic")).length;
  const issueCount = problems.length;

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(215,32%,22%)] to-[hsl(187,78%,25%)] p-7 mb-7 shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Globe2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-widest">
              Embassy Portal ({variant === "source" ? "Source" : "Destination"})
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[hsl(0,0%,100%)] mb-1.5">International Incidents</h1>
          <p className="text-[hsl(210,20%,75%)] text-sm max-w-lg">
            Monitor cross-border worker incidents and escalation requests.
          </p>
        </div>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {[{ icon: ShieldAlert, value: panicCount, label: "Panic Alerts" }, { icon: AlertTriangle, value: issueCount, label: "Open Incidents" }, { icon: Clock, value: 8, label: "Avg Response (min)" }, { icon: Globe2, value: 4, label: "Countries" }].map(
          (stat) => (
            <div
              key={stat.label}
              className="group bg-card rounded-2xl border border-border/60 p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/10 group-hover:scale-110 transition-transform duration-300">
                <stat.icon className="w-5 h-5 text-primary" />
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
        <h3 className="text-sm font-bold text-foreground mb-1">International Incident Feed</h3>
        <p className="text-xs text-muted-foreground mb-4">Recent worker reports requiring embassy coordination</p>

        {problems.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium text-foreground">No incidents to review</p>
            <p className="text-xs text-muted-foreground mt-1">This feed will populate when new escalations arrive.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {problems.slice(0, 10).map((p) => (
              <button
                type="button"
                key={String(p.ProblemAndActionId)}
                onClick={() => navigate(`/incident/${String(p.ProblemAndActionId)}`)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{(p.Title as string | undefined) ?? "Incident"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{(p.MemberName as string | undefined) ?? (p.FullName as string | undefined) ?? "Unknown"}</p>
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
