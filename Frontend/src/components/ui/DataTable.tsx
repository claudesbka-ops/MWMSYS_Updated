import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tableRow, staggerChildrenFast } from "@/lib/animations";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey?: keyof T | ((row: T) => string | number);
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  pageSize?: number;
  selectable?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
  stickyHeader?: boolean;
}

type SortDir = "asc" | "desc" | null;

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded animate-pulse"
            style={{
              background: "var(--border-subtle)",
              width: i === 0 ? "60%" : i % 3 === 0 ? "40%" : "75%",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = "No data available",
  emptyIcon,
  pageSize = 10,
  selectable = false,
  onRowClick,
  className,
  stickyHeader = true,
}: DataTableProps<T>) {
  const shouldReduce = useReducedMotion();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  const getRowKey = (row: T, index: number): string | number => {
    if (!rowKey) return index;
    if (typeof rowKey === "function") return rowKey(row);
    return row[rowKey] as string | number;
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pageData = sortedData.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); return; }
    if (sortDir === "asc") { setSortDir("desc"); return; }
    setSortKey(null); setSortDir(null);
  };

  const toggleRow = (key: string | number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === pageData.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageData.map((r, i) => getRowKey(r, i))));
    }
  };

  const SortIcon = ({ col }: { col: Column<T> }) => {
    if (!col.sortable) return null;
    const k = String(col.key);
    if (sortKey === k) {
      return sortDir === "asc"
        ? <ChevronUp className="w-3.5 h-3.5 ml-1 flex-shrink-0" style={{ color: "var(--accent-color)" }} />
        : <ChevronDown className="w-3.5 h-3.5 ml-1 flex-shrink-0" style={{ color: "var(--accent-color)" }} />;
    }
    return <ChevronsUpDown className="w-3.5 h-3.5 ml-1 flex-shrink-0 opacity-30" />;
  };

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl", className)}
      style={{ border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
      {/* Table */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead
            className={cn(stickyHeader && "sticky top-0 z-10")}
            style={{
              background: "var(--bg-overlay)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pageData.length > 0 && selected.size === pageData.length}
                    onChange={toggleAll}
                    className="rounded"
                    style={{ accentColor: "var(--accent-color)" }}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap",
                    col.sortable && "cursor-pointer select-none",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right"
                  )}
                  style={{ color: "var(--text-muted)", width: col.width }}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    <SortIcon col={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {loading ? (
            <tbody>
              {Array.from({ length: pageSize < 5 ? pageSize : 5 }).map((_, i) => (
                <SkeletonRow key={i} columns={columns.length + (selectable ? 1 : 0)} />
              ))}
            </tbody>
          ) : pageData.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    {emptyIcon ?? <Inbox className="w-10 h-10" style={{ color: "var(--text-muted)" }} />}
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {emptyMessage}
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <AnimatePresence mode="wait">
              <motion.tbody
                key={`${page}-${sortKey}-${sortDir}`}
                variants={shouldReduce ? undefined : staggerChildrenFast}
                initial="initial"
                animate="animate"
              >
                {pageData.map((row, i) => {
                  const key = getRowKey(row, i);
                  const isSelected = selected.has(key);
                  return (
                    <motion.tr
                      key={key}
                      variants={shouldReduce ? undefined : tableRow}
                      className={cn(
                        "group transition-colors duration-100",
                        onRowClick && "cursor-pointer"
                      )}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        background: isSelected ? "var(--bg-hover)" : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                      }}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selectable && (
                        <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(key)}
                            className="rounded"
                            style={{ accentColor: "var(--accent-color)" }}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={String(col.key)}
                          className={cn(
                            "px-4 py-3",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right"
                          )}
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {col.render
                            ? col.render(row[col.key as keyof T], row, i)
                            : String(row[col.key as keyof T] ?? "—")}
                        </td>
                      ))}
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </AnimatePresence>
          )}
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-4 py-3 text-xs"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedData.length)} of{" "}
            {sortedData.length} rows
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
              }
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-7 h-7 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: page === p ? "var(--accent-color)" : "transparent",
                    color: page === p ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
              }
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
