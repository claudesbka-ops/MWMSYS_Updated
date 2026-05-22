import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardItem } from "@/lib/animations";
import type { LucideIcon } from "lucide-react";

type IconColor = "blue" | "green" | "red" | "purple" | "orange" | "cyan";

interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: IconColor;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const iconColorMap: Record<IconColor, { bg: string; color: string; glow: string }> = {
  blue:   { bg: "rgba(79,110,247,0.12)",   color: "#4f6ef7", glow: "rgba(79,110,247,0.25)" },
  green:  { bg: "rgba(16,185,129,0.12)",   color: "#10b981", glow: "rgba(16,185,129,0.20)" },
  red:    { bg: "rgba(239,68,68,0.12)",    color: "#ef4444", glow: "rgba(239,68,68,0.20)" },
  purple: { bg: "rgba(139,92,246,0.12)",   color: "#8b5cf6", glow: "rgba(139,92,246,0.20)" },
  orange: { bg: "rgba(245,158,11,0.12)",   color: "#f59e0b", glow: "rgba(245,158,11,0.20)" },
  cyan:   { bg: "rgba(6,182,212,0.12)",    color: "#06b6d4", glow: "rgba(6,182,212,0.20)" },
};

function useAnimatedCounter(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const shouldReduce = useReducedMotion();
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (shouldReduce) { setCount(target); return; }
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, shouldReduce]);

  return count;
}

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded animate-pulse", className)}
      style={{ background: "var(--border-subtle)" }}
    />
  );
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel = "vs last month",
  icon: Icon,
  iconColor = "blue",
  prefix,
  suffix,
  loading = false,
  onClick,
  className,
}: MetricCardProps) {
  const shouldReduce = useReducedMotion();
  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;
  const isNumeric = typeof value === "number" || !isNaN(numericValue);
  const displayCount = useAnimatedCounter(isNumeric ? numericValue : 0);
  const colors = iconColorMap[iconColor];

  const displayValue = isNumeric
    ? displayCount.toLocaleString()
    : String(value);

  const trendPositive = change !== undefined && change > 0;
  const trendNegative = change !== undefined && change < 0;
  const trendNeutral  = change !== undefined && change === 0;

  return (
    <motion.div
      variants={shouldReduce ? undefined : cardItem}
      whileHover={shouldReduce ? undefined : { y: -2, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={cn(
        "relative rounded-2xl p-5 overflow-hidden",
        "border transition-all duration-200",
        "group",
        onClick && "cursor-pointer",
        className
      )}
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-accent)";
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "var(--shadow-glow), var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-card)";
      }}
    >
      {/* Subtle radial gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background: `radial-gradient(ellipse at top right, ${colors.glow} 0%, transparent 65%)`,
          opacity: 0.45,
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: colors.bg,
            boxShadow: `0 0 0 1px ${colors.glow}`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: colors.color }} />
        </div>

        {/* Trend badge */}
        {change !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
              "trend-badge-shimmer"
            )}
            style={{
              background: trendPositive
                ? "var(--status-success-bg)"
                : trendNegative
                ? "var(--status-danger-bg)"
                : "var(--border-subtle)",
              color: trendPositive
                ? "var(--status-success)"
                : trendNegative
                ? "var(--status-danger)"
                : "var(--text-muted)",
            }}
          >
            {trendPositive && <TrendingUp className="w-3 h-3" />}
            {trendNegative && <TrendingDown className="w-3 h-3" />}
            {trendNeutral  && <Minus className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative mt-4">
        {loading ? (
          <SkeletonPulse className="h-8 w-28 mb-2" />
        ) : (
          <p
            className="font-display text-3xl font-bold tracking-tight leading-none"
            style={{ color: "var(--text-primary)" }}
          >
            {prefix && <span className="text-xl font-semibold" style={{ color: "var(--text-secondary)" }}>{prefix}</span>}
            {displayValue}
            {suffix && <span className="text-lg font-medium ml-1" style={{ color: "var(--text-secondary)" }}>{suffix}</span>}
          </p>
        )}
        <p
          className="mt-1.5 text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {loading ? <SkeletonPulse className="h-4 w-20" /> : title}
        </p>
        {change !== undefined && !loading && (
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            {changeLabel}
          </p>
        )}
      </div>
    </motion.div>
  );
}
