import { cn } from "@/lib/utils";

type StatusVariant =
  | "active" | "inactive" | "pending" | "approved" | "rejected"
  | "critical" | "high" | "medium" | "low"
  | "success" | "warning" | "danger" | "info"
  | "live" | "resolved" | "expired" | "expiring";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  pulse?: boolean;
  className?: string;
}

function inferVariant(status: string): StatusVariant {
  const s = status.toLowerCase();
  if (["active", "online", "connected", "enabled"].includes(s)) return "active";
  if (["live", "streaming"].includes(s)) return "live";
  if (["inactive", "offline", "disabled"].includes(s)) return "inactive";
  if (["pending", "processing", "in progress", "in_progress"].includes(s)) return "pending";
  if (["approved", "verified", "completed", "done", "passed"].includes(s)) return "approved";
  if (["rejected", "failed", "denied"].includes(s)) return "rejected";
  if (["critical", "panic", "sos"].includes(s)) return "critical";
  if (["high", "urgent"].includes(s)) return "high";
  if (["medium", "moderate"].includes(s)) return "medium";
  if (["low", "minor"].includes(s)) return "low";
  if (["expired"].includes(s)) return "expired";
  if (["expiring", "expiring soon"].includes(s)) return "expiring";
  if (["resolved"].includes(s)) return "resolved";
  return "info";
}

const variantStyles: Record<StatusVariant, { bg: string; color: string; dot: string; pulsing: boolean }> = {
  active:   { bg: "var(--status-success-bg)",  color: "var(--status-success)",  dot: "var(--status-success)",  pulsing: false },
  live:     { bg: "var(--status-danger-bg)",   color: "var(--status-danger)",   dot: "var(--status-danger)",   pulsing: true  },
  inactive: { bg: "var(--border-subtle)",       color: "var(--text-muted)",       dot: "var(--text-muted)",       pulsing: false },
  pending:  { bg: "var(--status-warning-bg)",  color: "var(--status-warning)",  dot: "var(--status-warning)",  pulsing: false },
  approved: { bg: "var(--status-success-bg)",  color: "var(--status-success)",  dot: "var(--status-success)",  pulsing: false },
  rejected: { bg: "var(--status-danger-bg)",   color: "var(--status-danger)",   dot: "var(--status-danger)",   pulsing: false },
  critical: { bg: "var(--status-danger-bg)",   color: "var(--status-danger)",   dot: "var(--status-danger)",   pulsing: true  },
  high:     { bg: "rgba(239,68,68,0.08)",       color: "#f87171",                 dot: "#f87171",                 pulsing: false },
  medium:   { bg: "var(--status-warning-bg)",  color: "var(--status-warning)",  dot: "var(--status-warning)",  pulsing: false },
  low:      { bg: "var(--status-info-bg)",     color: "var(--status-info)",     dot: "var(--status-info)",     pulsing: false },
  success:  { bg: "var(--status-success-bg)",  color: "var(--status-success)",  dot: "var(--status-success)",  pulsing: false },
  warning:  { bg: "var(--status-warning-bg)",  color: "var(--status-warning)",  dot: "var(--status-warning)",  pulsing: false },
  danger:   { bg: "var(--status-danger-bg)",   color: "var(--status-danger)",   dot: "var(--status-danger)",   pulsing: false },
  info:     { bg: "var(--status-info-bg)",     color: "var(--status-info)",     dot: "var(--status-info)",     pulsing: false },
  expired:  { bg: "var(--border-subtle)",       color: "var(--text-muted)",       dot: "var(--text-muted)",       pulsing: false },
  expiring: { bg: "var(--status-warning-bg)",  color: "var(--status-warning)",  dot: "var(--status-warning)",  pulsing: true  },
  resolved: { bg: "var(--status-success-bg)",  color: "var(--status-success)",  dot: "var(--status-success)",  pulsing: false },
};

export function StatusBadge({ status, variant, pulse, className }: StatusBadgeProps) {
  const v = variant ?? inferVariant(status);
  const styles = variantStyles[v];
  const shouldPulse = pulse ?? styles.pulsing;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold",
        className
      )}
      style={{ background: styles.bg, color: styles.color }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {shouldPulse && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ background: styles.dot }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-1.5 w-1.5"
          style={{ background: styles.dot }}
        />
      </span>
      {status}
    </span>
  );
}
