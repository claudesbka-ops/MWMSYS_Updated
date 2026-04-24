import { Bell, User, Search, Plus, Banknote, FileCheck, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/apiClient";
import { logout } from "@/services/authService";
import { alertsData } from "@/data/alertsData";
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

function readLocalIncidents() {
  try {
    const raw = localStorage.getItem(LOCAL_INCIDENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as typeof alertsData;
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
  const allIncidents = [...localIncidents, ...alertsData].sort((a, b) => b.id - a.id);
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

  return (
    <header className="h-16 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/55 border-b border-border/60 flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Dashboard</h2>
        <span className="text-muted-foreground/30">/</span>
        <span className="text-sm font-semibold text-foreground">{breadcrumbMap[currentRole]}</span>
        {(currentRole === "agency" || currentRole === "employer") && planLabel ? (
          <span className="ml-2 inline-flex items-center gap-2 text-[11px] font-semibold px-2.5 py-1 rounded-xl border border-border/60 bg-gradient-to-r from-primary/15 via-muted/40 to-accent/10 text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Plan: {planLabel}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {/* Quick Actions */}
        {(currentRole === "admin" || currentRole === "agency") && (
          <>
            <div className="hidden md:flex items-center gap-1.5 mr-1">
              <button onClick={() => handleQuickAction("worker")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 text-success text-xs font-semibold hover:bg-success/15 transition-colors">
                <Plus className="w-3 h-3" />
                New Worker
              </button>
              <button onClick={() => handleQuickAction("dispute")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-warning/10 text-warning text-xs font-semibold hover:bg-warning/15 transition-colors">
                <Banknote className="w-3 h-3" />
                Salary Dispute
              </button>
              <button onClick={() => handleQuickAction("attestation")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors">
                <FileCheck className="w-3 h-3" />
                Attestation
              </button>
            </div>
            <div className="w-px h-8 bg-border/60 mx-1 hidden md:block" />
          </>
        )}

        <div className="w-px h-8 bg-border/60 mx-1" />

        {/* CMD+K Search */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 hover:bg-muted/40 transition-colors premium-ring"
        >
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Search...</span>
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-muted/60 text-[10px] font-semibold text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="p-2.5 rounded-2xl border border-border/60 hover:bg-muted/40 transition-colors premium-ring premium-hover"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? (
            <Sun className="w-[18px] h-[18px] text-muted-foreground" />
          ) : (
            <Moon className="w-[18px] h-[18px] text-muted-foreground" />
          )}
        </button>

        <DropdownMenu onOpenChange={(open) => open && handleOpenNotifications()}>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2.5 rounded-2xl hover:bg-muted/60 transition-colors premium-ring premium-hover">
              <Bell className="w-[18px] h-[18px] text-muted-foreground" />
              {unreadCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96">
            <DropdownMenuLabel>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">Notifications</span>
                  <span className="text-xs text-muted-foreground">Latest incidents & updates</span>
                </div>
                <button
                  onClick={() => {
                    const newestId = allIncidents[0]?.id;
                    if (typeof newestId === "number") writeLastSeenId(newestId);

                    const newestBroadcastId = Math.max(...(broadcastRows ?? []).map((b) => Number(b.id ?? 0)).filter((x) => Number.isFinite(x)), 0);
                    if (newestBroadcastId > 0) writeLastBroadcastSeenId(newestBroadcastId);
                  }}
                  className="px-2.5 py-1 rounded-md border border-border/60 text-[11px] font-semibold text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  Mark all read
                </button>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allIncidents.length === 0 && (broadcastRows ?? []).length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">No notifications</p>
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
                      className={`mt-0.5 w-2.5 h-2.5 rounded-full ${(Number(b.id ?? 0) || 0) > lastBroadcastSeenId ? "bg-destructive" : "bg-muted"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground truncate">Broadcast: {b.senderName ?? "System"}</p>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">
                          {b.createdOn ? new Date(b.createdOn).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{b.message || (b.attachments?.length ? "Attachment" : "")}</p>
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
                      className={`mt-0.5 w-2.5 h-2.5 rounded-full ${n.id > lastSeenId ? "bg-destructive" : "bg-muted"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground truncate">{n.description || n.type}</p>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">{n.date}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{n.name}{n.idNumber ? ` · ${n.idNumber}` : ""}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/reports/problem")}>Open Problem Report</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="w-px h-8 bg-border/60 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted/60 transition-colors">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-sm ring-1 ring-border/50">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:inline">{userName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground truncate">{userName}</span>
                <span className="text-xs text-muted-foreground truncate">{breadcrumbMap[currentRole]}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/account")}>Manage Account</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleLogout}>
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
