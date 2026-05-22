import { Bell, User, Search, Plus, Banknote, FileCheck, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/apiClient";
import { logout } from "@/services/authService";
import type { AlertData } from "@/components/AlertCard";
import { NotificationBell } from "./notifications/NotificationBell";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { getSubscriptionMe } from "@/services/subscriptionService";
import { createBroadcastSocket, getBroadcastFeed, type BroadcastMessage } from "@/services/broadcastService";
import type { Socket } from "socket.io-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOCAL_INCIDENTS_KEY = "mwmsys_local_incidents";
const LAST_NOTIF_SEEN_KEY = "mwmsys_last_notif_seen";
const LAST_BROADCAST_SEEN_KEY = "mwmsys_last_broadcast_seen";

function readLocalIncidents(): AlertData[] {
  try {
    const raw = localStorage.getItem(LOCAL_INCIDENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AlertData[];
  } catch {
    return [];
  }
}

function readLastSeenId() {
  const n = Number(localStorage.getItem(LAST_NOTIF_SEEN_KEY) ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function writeLastSeenId(id: number) {
  localStorage.setItem(LAST_NOTIF_SEEN_KEY, String(id));
}

function readLastBroadcastSeenId() {
  const n = Number(localStorage.getItem(LAST_BROADCAST_SEEN_KEY) ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function writeLastBroadcastSeenId(id: number) {
  localStorage.setItem(LAST_BROADCAST_SEEN_KEY, String(id));
}

const breadcrumbMap: Record<string, string> = {
  admin: "Admin Dashboard",
  agency: "Agency Portal",
  employer: "Employer Dashboard",
  worker: "Worker Profile",
};

export default function TopHeader() {
  const { currentRole } = useRole();
  const navigate = useNavigate();
  const { theme, setTheme, systemTheme } = useTheme();

  const [broadcastRows, setBroadcastRows] = useState<BroadcastMessage[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const subscriptionQuery = useQuery({
    queryKey: ["subscription_me"],
    queryFn: getSubscriptionMe,
    enabled: currentRole === "agency" || currentRole === "employer",
    retry: false,
    staleTime: 30_000,
  });

  const planLabel = subscriptionQuery.data?.planType;

  const { user } = useAuth();
  const userName = user?.name ?? "User";
  const localIncidents = readLocalIncidents();
  const allIncidents = [...localIncidents].sort((a, b) => b.id - a.id);
  const lastSeenId = readLastSeenId();
  const lastBroadcastSeenId = readLastBroadcastSeenId();
  const broadcastUnread = (broadcastRows ?? []).filter((b) => (Number(b.id ?? 0) || 0) > lastBroadcastSeenId).length;
  const unreadCount = allIncidents.filter((n) => n.id > lastSeenId).length + broadcastUnread;

  const handleQuickAction = (action: string) => {
    if (action === "worker") navigate("/worker");
    else if (action === "dispute") navigate("/dispute");
    else if (action === "attestation") navigate("/attestation");
  };

  const handleLogout = () => {
    logout();
    localStorage.setItem("mwmsys_logged_in", "false");
    navigate("/login");
  };

  const handleOpenNotifications = () => {
    const newestId = allIncidents[0]?.id;
    if (typeof newestId === "number") writeLastSeenId(newestId);

    const newestBroadcastId = Math.max(...(broadcastRows ?? []).map((b) => Number(b.id ?? 0)).filter((x) => Number.isFinite(x)), 0);
    if (newestBroadcastId > 0) writeLastBroadcastSeenId(newestBroadcastId);
  };

  const openIncident = (id: number) => {
    writeLastSeenId(Math.max(readLastSeenId(), id));
    navigate(`/incident/${id}`);
  };

  const openBroadcast = (id: number | null) => {
    if (id != null && Number.isFinite(Number(id))) {
      writeLastBroadcastSeenId(Math.max(readLastBroadcastSeenId(), Number(id)));
    }
    navigate("/broadcast");
  };

  useEffect(() => {
    getBroadcastFeed(30)
      .then((res) => setBroadcastRows(Array.isArray(res?.rows) ? res.rows : []))
      .catch(() => undefined);

    const baseUrl = apiClient.defaults.baseURL ?? "";
    const s = createBroadcastSocket(baseUrl);
    socketRef.current = s;

    const onMsg = (payload: any) => {
      const msg: BroadcastMessage = {
        id: payload?.id ?? null,
        senderRoleId: Number(payload?.senderRoleId ?? 0),
        senderKey: payload?.senderKey ?? null,
        senderName: payload?.senderName ?? null,
        message: String(payload?.message ?? ""),
        target: String(payload?.target ?? ""),
        createdOn: String(payload?.createdOn ?? new Date().toISOString()),
        attachments: Array.isArray(payload?.attachments) ? payload.attachments : [],
      };

      setBroadcastRows((prev) => {
        const next = [msg, ...(prev ?? [])];
        const seen = new Set<string>();
        return next.filter((x) => {
          const key = `${x.id ?? ""}|${x.createdOn}|${x.message}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
    };

    s.on("broadcast_message", onMsg);
    return () => {
      try {
        s.off("broadcast_message", onMsg);
        s.disconnect();
      } catch {
        // ignore
      }
      socketRef.current = null;
    };
  }, []);

  const resolvedTheme = (theme === "system" ? systemTheme : theme) ?? "light";
  const isDark = resolvedTheme === "dark";

  const divider = (
    <div
      className="w-px h-6 mx-1 flex-shrink-0"
      style={{ background: "var(--border-default)" }}
    />
  );

  return (
    <header
      className="h-16 flex items-center justify-between px-5 sticky top-0 z-20"
      style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Dashboard
        </span>
        <span style={{ color: "var(--border-default)" }}>/</span>
        <span
          className="text-xs font-semibold truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {breadcrumbMap[currentRole]}
        </span>
        {(currentRole === "agency" || currentRole === "employer") && planLabel ? (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-lg"
            style={{
              background: "var(--accent-glow)",
              color: "var(--text-accent)",
              border: "1px solid var(--border-accent)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent-color)" }}
            />
            {planLabel}
          </span>
        ) : null}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Quick Actions */}
        {(currentRole === "admin" || currentRole === "agency") && (
          <>
            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => handleQuickAction("worker")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                style={{ color: "var(--status-success)", background: "var(--status-success-bg)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.1)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.filter = "none")}
              >
                <Plus className="w-3 h-3" />
                New Worker
              </button>
              <button
                onClick={() => handleQuickAction("dispute")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                style={{ color: "var(--status-warning)", background: "var(--status-warning-bg)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.1)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.filter = "none")}
              >
                <Banknote className="w-3 h-3" />
                Dispute
              </button>
              <button
                onClick={() => handleQuickAction("attestation")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                style={{ color: "var(--text-accent)", background: "var(--accent-glow)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.1)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.filter = "none")}
              >
                <FileCheck className="w-3 h-3" />
                Attestation
              </button>
            </div>
            {divider}
          </>
        )}

        {/* CMD+K Search */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-150"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-accent)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 3px var(--accent-glow)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search...</span>
          <kbd
            className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: "var(--border-subtle)", color: "var(--text-muted)" }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="p-2 rounded-lg transition-all duration-150"
          style={{ color: "var(--text-secondary)" }}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
        >
          {isDark ? <Sun className="w-[17px] h-[17px]" /> : <Moon className="w-[17px] h-[17px]" />}
        </button>

        <NotificationBell />

        {/* Notification bell with unread dot */}
        <DropdownMenu onOpenChange={(open) => open && handleOpenNotifications()}>
          <DropdownMenuTrigger asChild>
            <button
              className="relative p-2 rounded-lg transition-all duration-150"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
              }}
            >
              <Bell className="w-[17px] h-[17px]" />
              {unreadCount > 0 ? (
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: "var(--status-danger)" }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2 w-2"
                    style={{ background: "var(--status-danger)" }}
                  />
                </span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96">
            <DropdownMenuLabel>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Notifications
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Latest incidents &amp; updates
                  </span>
                </div>
                <button
                  onClick={() => {
                    const newestId = allIncidents[0]?.id;
                    if (typeof newestId === "number") writeLastSeenId(newestId);
                    const newestBroadcastId = Math.max(
                      ...(broadcastRows ?? []).map((b) => Number(b.id ?? 0)).filter((x) => Number.isFinite(x)),
                      0
                    );
                    if (newestBroadcastId > 0) writeLastBroadcastSeenId(newestBroadcastId);
                  }}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors"
                  style={{
                    border: "1px solid var(--border-default)",
                    color: "var(--text-muted)",
                  }}
                >
                  Mark all read
                </button>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allIncidents.length === 0 && (broadcastRows ?? []).length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No notifications</p>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto p-1">
                {(broadcastRows ?? []).slice(0, 6).map((b, idx) => (
                  <DropdownMenuItem
                    key={`broadcast-${b.id ?? "x"}-${idx}`}
                    onClick={() => openBroadcast(b.id)}
                    className="items-start gap-3 py-2.5"
                  >
                    <div
                      className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: (Number(b.id ?? 0) || 0) > lastBroadcastSeenId
                          ? "var(--status-danger)"
                          : "var(--border-default)",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          Broadcast: {b.senderName ?? "System"}
                        </p>
                        <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                          {b.createdOn ? new Date(b.createdOn).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                        {b.message || (b.attachments?.length ? "Attachment" : "")}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
                {allIncidents.slice(0, 12).map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onClick={() => openIncident(n.id)}
                    className="items-start gap-3 py-2.5"
                  >
                    <div
                      className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: n.id > lastSeenId ? "var(--status-danger)" : "var(--border-default)",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {n.description || n.type}
                        </p>
                        <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                          {n.date}
                        </span>
                      </div>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                        {n.name}{n.idNumber ? ` · ${n.idNumber}` : ""}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/reports/problem")}>
              Open Problem Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {divider}

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150"
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
              }
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, var(--accent-color), var(--accent-bright))",
                  boxShadow: "0 0 0 2px var(--accent-glow)",
                }}
              >
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span
                className="text-sm font-medium hidden sm:inline"
                style={{ color: "var(--text-primary)" }}
              >
                {userName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, var(--accent-color), var(--accent-bright))",
                  }}
                >
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {userName}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {breadcrumbMap[currentRole]}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/account")}>Manage Account</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleLogout}
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
