import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn("pb-5 mb-6", className)}
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight
                  className="w-3.5 h-3.5"
                  style={{ color: "var(--text-muted)" }}
                />
              )}
              {item.href ? (
                <a
                  href={item.href}
                  className="text-xs font-medium transition-colors hover:underline"
                  style={{ color: "var(--text-muted)" }}
                >
                  {item.label}
                </a>
              ) : (
                <span
                  className={cn(
                    "text-xs font-medium",
                    i === breadcrumb.length - 1
                      ? ""
                      : ""
                  )}
                  style={{
                    color:
                      i === breadcrumb.length - 1
                        ? "var(--text-secondary)"
                        : "var(--text-muted)",
                  }}
                >
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="font-display text-2xl font-bold tracking-tight truncate text-gradient"
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
