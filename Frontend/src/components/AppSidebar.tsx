import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRole, UserRole } from "@/contexts/RoleContext";
import {
  Home, Building2, Users, FileCheck, Search, CreditCard,
  Wallet, BarChart3, Shield, ChevronRight,
  FileText, HeartPulse, Eye, AlertTriangle, UserCheck, Menu, X,
  User, MessageSquare
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
  { label: "Employer", icon: Building2, path: "/employer", roles: ["admin", "agency"] },
  { label: "Worker", icon: Users, path: "/worker", roles: ["admin", "agency", "employer"] },
  { label: "Attestation", icon: FileCheck, path: "/attestation", roles: ["admin", "agency"] },
  { label: "Search", icon: Search, path: "/search", roles: ["admin", "agency", "embassy_source", "embassy_destination", "labour"] },
  { label: "TopUp", icon: CreditCard, path: "/topup", roles: ["admin", "agency"] },
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
        bg-sidebar/70 backdrop-blur-xl supports-[backdrop-filter]:bg-sidebar/55
        border-r border-border/60 shadow-2xl
        transition-transform duration-300 ease-out
        ${collapsed ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border/60">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${isActive
                        ? "bg-primary/15 text-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}
                    `}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <div className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    onClick={() => setCollapsed(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${isActive
                        ? "bg-primary/15 text-primary shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}
                    `}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )}

                {hasChildren && isExpanded && (
                  <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-border/60 pl-3">
                    {item.children!.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setCollapsed(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200
                          ${location.pathname === child.path
                            ? "text-primary bg-primary/10"
                            : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}
                        `}
                      >
                        <child.icon className="w-4 h-4 flex-shrink-0" />
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
        <div className="px-5 py-4 border-t border-border/60">
          <p className="text-[11px] text-sidebar-foreground/60 font-medium">© 2018 MWMSYS</p>
        </div>
      </aside>
    </>
  );
}
