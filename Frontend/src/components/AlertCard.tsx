import { useNavigate } from "react-router-dom";
import { MessageSquare, X, AlertTriangle, Building2 } from "lucide-react";

export interface AlertData {
  id: number;
  name: string;
  idNumber: string;
  workerId?: string;
  type: string;
  description?: string;
  employer?: string;
  status?: "active" | "resolved";
  lat?: number;
  lng?: number;
  date: string;
  time: string;
  by: string;
  comments: number;
}

export default function AlertCard({ alert, onDismiss }: { alert: AlertData; onDismiss?: (id: number) => void }) {
  const navigate = useNavigate();
  const isPanic = alert.type === "Panic Alert";
  const status = alert.status ?? "active";

  const handleOpen = () => {
    if (isPanic) {
      // Panic alerts jump straight to the live map focused on the worker.
      const workerId = (alert.workerId || alert.name || alert.idNumber || String(alert.id)).toString().trim();
      const qs = new URLSearchParams();
      if (workerId) qs.set("focus", workerId);
      qs.set("alertId", String(alert.id));
      navigate(`/map?${qs.toString()}`);
      return;
    }
    navigate(`/incident/${alert.id}`);
  };

  return (
    <div
      onClick={handleOpen}
      className="group relative rounded-2xl overflow-hidden cursor-pointer glass-surface premium-ring premium-hover active:translate-y-0"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl ${isPanic ? "bg-destructive/15" : "bg-warning/15"}`} />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-3xl bg-primary/10" />
      </div>
      <div className={`h-1 ${isPanic ? "bg-gradient-to-r from-destructive to-destructive/60" : "bg-gradient-to-r from-warning to-warning/60"}`} />

      <button
        onClick={(e) => { e.stopPropagation(); onDismiss?.(alert.id); }}
        className="absolute top-3.5 right-3.5 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted/80 transition-all"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      <div className="p-5 space-y-3">
        <div className="pr-6">
          <p className="text-sm font-bold text-foreground">{alert.name}</p>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">{alert.idNumber}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
            isPanic ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
          }`}>
            <AlertTriangle className="w-3 h-3" />
            {alert.type}
          </span>

          <span
            className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
              status === "resolved" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            }`}
          >
            {status === "resolved" ? "Resolved" : "Active"}
          </span>
        </div>

        {alert.description && (
          <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2">{alert.description}</p>
        )}

        {alert.employer && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate font-medium">{alert.employer}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">{alert.date} · {alert.time}</p>
            <p className="text-[11px] text-muted-foreground">By {alert.by}</p>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg">
            <MessageSquare className="w-3 h-3" />
            <span className="text-[11px] font-semibold">{alert.comments}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
