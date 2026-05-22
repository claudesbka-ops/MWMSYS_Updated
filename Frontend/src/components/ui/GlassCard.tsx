import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glow" | "gradient-top";
  noPadding?: boolean;
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", noPadding = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl transition-all duration-200",
          "bg-[var(--bg-elevated)] border border-[var(--border-subtle)]",
          "shadow-[var(--shadow-card)]",
          !noPadding && "p-5",
          variant === "glow" && "border-[var(--border-accent)] shadow-[var(--shadow-glow),var(--shadow-card)]",
          variant === "gradient-top" && "border-t-[var(--border-accent)] border-t-2",
          className
        )}
        {...props}
      >
        {variant === "gradient-top" && (
          <div
            className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--accent-color), transparent)",
            }}
          />
        )}
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard };
