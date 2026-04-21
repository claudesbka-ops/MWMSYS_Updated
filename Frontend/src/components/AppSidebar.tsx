import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRole, UserRole } from "@/contexts/RoleContext";
import {
  Home, Building2, Users, FileCheck, Search, CreditCard,
  Wallet, BarChart3, Shield, ChevronRight,
  FileText, HeartPulse, Eye, AlertTriangle, UserCheck, Menu, X, Clock,
  User, MessageSquare, Megaphone
} from "lucide-react";

interface NavItem {
  label: string;
  icon: typeof Home;
  path: string;
  roles: UserRole[];
  children?: { label: string; icon: typeof Home; path: string }[];
}

const navItems: NavItem[] = [
  { label: "Home", icon: Home, path: "/", roles: ["admin", "agency", "employer", "worker", "embassy_source", "embassy_destination", "labour"] },
  { label: "Broadcast", icon: Megaphone, path: "/broadcast", roles: ["admin", "agency", "employer", "worker", "embassy_source", "embassy_destination", "labour"] },
  { label: "Employer", icon: Building2, path: "/employer", roles: ["admin", "agency"] },
  { label: "Worker", icon: Users, path: "/worker", roles: ["admin", "agency", "employer"] },
  { label: "Attestation", icon: FileCheck, path: "/attestation", roles: ["admin", "agency"] },
  { label: "Search", icon: Search, path: "/search", roles: ["admin", "agency", "embassy_source", "embassy_destination", "labour"] },
  {
    label: "HRMS",
    icon: FileText,
    path: "/hrms",
    roles: ["admin", "agency", "employer", "worker"],
    children: [
      { label: "Attendance", icon: Clock, path: "/hrms/attendance" },
      { label: "Leave", icon: FileText, path: "/hrms/leave" },
      { label: "My Requests", icon: FileText, path: "/hrms/my-requests" },
      { label: "Payroll", icon: Wallet, path: "/hrms/payroll" },
      { label: "Contracts", icon: Shield, path: "/hrms/contracts" },
      { label: "Roster", icon: Clock, path: "/hrms/roster" },
      { label: "Timesheets", icon: BarChart3, path: "/hrms/timesheets" },
      { label: "Requests", icon: FileText, path: "/hrms/requests" },
      { label: "Report", icon: BarChart3, path: "/hrms/report" },
    ],
  },
  { label: "Pricing", icon: CreditCard, path: "/pricing", roles: ["agency", "employer"] },
  { label: "Account", icon: Wallet, path: "/account", roles: ["admin", "agency", "employer"] },
  {
    label: "Reports", icon: BarChart3, path: "/reports",
    roles: ["admin", "agency", "employer", "embassy_source", "embassy_destination", "labour"],
    children: [
      { label: "Entry Report", icon: FileText, path: "/reports/entry" },
      { label: "Insurance Expire", icon: HeartPulse, path: "/reports/insurance" },
      { label: "Visa Expire", icon: Eye, path: "/reports/visa" },
      { label: "Problem Report", icon: AlertTriangle, path: "/reports/problem" },
      { label: "User Entry Report", icon: UserCheck, path: "/reports/user-entry" },
    ]
  },
  { label: "Live Alerts", icon: AlertTriangle, path: "/admin/live-alerts", roles: ["admin"] },
  { label: "Users", icon: Users, path: "/users", roles: ["admin"] },
  { label: "Administration", icon: Shield, path: "/administration", roles: ["admin"] },
  // Worker-only items
  { label: "My Documents", icon: FileText, path: "/my-documents", roles: ["worker"] },
  { label: "Panic Status", icon: AlertTriangle, path: "/panic-status", roles: ["worker"] },
];

export default function AppSidebar() {
  const location = useLocation();
  const { currentRole } = useRole();
  const [expandedItem, setExpandedItem] = useState<string | null>("Reports");
  const [collapsed, setCollapsed] = useState(false);

  const filteredItems = navItems.filter(item => item.roles.includes(currentRole));

  const allowedChildPath = (path: string): boolean => {
    // Worker should only see worker-relevant HRMS pages
    if (currentRole === "worker") {
      return new Set(["/hrms/leave", "/hrms/my-requests"]).has(path);
    }
    // Non-worker should not see worker-only entry
    if (path === "/hrms/my-requests") return false;
    return true;
  };

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 lg:hidden p-2.5 rounded-xl bg-card shadow-lg border border-border/60"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {collapsed && (
        <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-30 lg:hidden" onClick={() => setCollapsed(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 z-40 h-screen w-64 flex flex-col
        sidebar-gradient
        border-r border-sidebar-border/70 shadow-2xl shadow-foreground/[0.08]
        transition-transform duration-300 ease-out
        ${collapsed ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border/70">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-lg shadow-primary/25 ring-1 ring-white/10">
            <span className="text-primary-foreground font-bold text-sm">MW</span>
          </div>
          <div>
            <h1 className="text-sidebar-foreground font-bold text-base tracking-tight">MWMSYS</h1>
            <p className="text-sidebar-foreground/60 text-[11px] font-medium">Migrant Worker Assistance</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.children && item.children.some(c => location.pathname === c.path));
            const hasChildren = !!item.children;
            const isExpanded = expandedItem === item.label;

            return (
              <div key={item.label}>
                {hasChildren ? (
                  <button
                    onClick={() => setExpandedItem(isExpanded ? null : item.label)}
                    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 premium-ring
                      ${isActive
                        ? "bg-white/10 text-sidebar-foreground shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground"}
                    `}
                  >
                    <span className={`w-9 h-9 rounded-2xl flex items-center justify-center border transition-colors
                      ${isActive ? "bg-primary/15 border-primary/30" : "bg-white/5 border-white/10 group-hover:border-white/15"}
                    `}>
                      <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"}`} />
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <div className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                      <ChevronRight className="w-3.5 h-3.5 text-sidebar-foreground/60 group-hover:text-sidebar-foreground" />
                    </div>
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    onClick={() => setCollapsed(false)}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 premium-ring
                      ${isActive
                        ? "bg-white/10 text-sidebar-foreground shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground"}
                    `}
                  >
                    <span className={`w-9 h-9 rounded-2xl flex items-center justify-center border transition-colors
                      ${isActive ? "bg-primary/15 border-primary/30" : "bg-white/5 border-white/10 group-hover:border-white/15"}
                    `}>
                      <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"}`} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )}

                {hasChildren && isExpanded && (
                  <div className="ml-7 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                    {item.children!.filter((c) => allowedChildPath(c.path)).map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setCollapsed(false)}
                        className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200
                          ${location.pathname === child.path
                            ? "text-sidebar-foreground bg-white/10"
                            : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-white/5"}
                        `}
                      >
                        <child.icon className={`w-4 h-4 flex-shrink-0 ${location.pathname === child.path ? "text-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"}`} />
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-sidebar-border/70">
          <p className="text-[11px] text-sidebar-foreground/60 font-medium">© 2018 MWMSYS</p>
        </div>
      </aside>
    </>
  );
}
