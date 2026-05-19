import { AlertTriangle, Clock, Users, CheckCircle } from "lucide-react";

interface ComplianceScoreCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  type: "critical" | "high" | "medium" | "low" | "good" | "neutral";
  icon?: "alert" | "clock" | "users" | "check";
  isLoading?: boolean;
}

const colorMap = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: "text-red-600",
    badge: "bg-red-100 text-red-800",
  },
  high: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    icon: "text-orange-600",
    badge: "bg-orange-100 text-orange-800",
  },
  medium: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: "text-amber-600",
    badge: "bg-amber-100 text-amber-800",
  },
  low: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    icon: "text-blue-600",
    badge: "bg-blue-100 text-blue-800",
  },
  good: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    icon: "text-green-600",
    badge: "bg-green-100 text-green-800",
  },
  neutral: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    icon: "text-slate-600",
    badge: "bg-slate-100 text-slate-800",
  },
};

export function ComplianceScoreCard({
  title,
  value,
  subtitle,
  type,
  icon = "alert",
  isLoading,
}: ComplianceScoreCardProps) {
  const colors = colorMap[type];

  const IconComponent = {
    alert: AlertTriangle,
    clock: Clock,
    users: Users,
    check: CheckCircle,
  }[icon];

  if (isLoading) {
    return (
      <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5`}>
        <div className="animate-pulse flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl ${colors.bg}`} />
          <div className="space-y-2">
            <div className="h-7 w-16 bg-slate-200 rounded" />
            <div className="h-3 w-20 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-white/60`}>
          <IconComponent className={`w-5 h-5 ${colors.icon}`} />
        </div>
        <div>
          <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
          <p className="text-xs text-slate-600">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
