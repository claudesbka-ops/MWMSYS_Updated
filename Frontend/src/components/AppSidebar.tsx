import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRole, UserRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home, Building2, Users, FileCheck, Search, CreditCard,
  Wallet, BarChart3, Shield, ChevronRight,
  FileText, HeartPulse, Eye, AlertTriangle, UserCheck, Menu, X, Clock,
  User, MessageSquare, Megaphone, BookOpen, Scale, Upload, Calendar, Globe2, ShieldCheck,
  Bell, Sparkles, MapPin, PenLine, LogOut
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logout } from "@/services/authService";
import { staggerChildren, sidebarItem } from "@/lib/animations";

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
  { label: "Import Workers", icon: Upload, path: "/bulk-import", roles: ["agency"] },
  { label: "Attestation", icon: FileCheck, path: "/attestation", roles: ["admin", "agency"] },
  { label: "Salary Disputes", icon: Scale, path: "/dispute", roles: ["admin", "agency", "employer", "worker", "labour"] },
  { label: "Risk Dashboard", icon: AlertTriangle, path: "/risk-dashboard", roles: ["admin", "agency"] },
  { label: "Search", icon: Search, path: "/search", roles: ["admin", "agency", "embassy_source", "embassy_destination", "labour"] },
  { label: "Notifications", icon: Bell, path: "/notification-settings", roles: ["admin", "agency", "employer", "worker"] },
  { label: "AI Copilot", icon: Sparkles, path: "/copilot", roles: ["admin", "agency"] },
  { label: "AI Copilot", icon: Sparkles, path: "/embassy-copilot", roles: ["embassy_source", "embassy_destination"] },
  { label: "AI Copilot", icon: Sparkles, path: "/labour-copilot", roles: ["labour"] },
  { label: "Audit Log", icon: ShieldCheck, path: "/audit-log", roles: ["admin"] },
  { label: "Billing", icon: CreditCard, path: "/billing", roles: ["agency", "employer"] },
  {
    label: "HRMS",
    icon: FileText,
    path: "/hrms",
    roles: ["admin", "agency", "employer", "worker"],
    children: [
      { label: "Overview", icon: FileText, path: "/hrms" },
      { label: "Attendance", icon: Clock, path: "/hrms/attendance" },
      { label: "Leave", icon: FileText, path: "/hrms/leave" },
      { label: "My Requests", icon: FileText, path: "/hrms/my-requests" },
      { label: "Payroll", icon: Wallet, path: "/hrms/payroll" },
      { label: "Contracts", icon: Shield, path: "/hrms/contracts" },
      { label: "Shift Schedule", icon: Calendar, path: "/hrms/roster" },
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
  { label: "Work Zones", icon: MapPin, path: "/geofences", roles: ["admin", "employer"] },
  { label: "Blog Editor", icon: PenLine, path: "/blog/editor", roles: ["admin"] },
  // Available to every role
  { label: "Blog", icon: BookOpen, path: "/blog", roles: ["admin", "agency", "employer", "worker", "embassy_source", "embassy_destination", "labour"] },
];

const roleLabelMap: Record<string, string> = {
  admin: "Administrator",
  agency: "Agency",
  employer: "Employer",
  worker: "Worker",
  embassy_source: "Embassy (Source)",
  embassy_destination: "Embassy (Dest.)",
  labour: "Labour Dept.",
};

export default function AppSidebar() {
  const location = useLocation();
  const { currentRole } = useRole();
  const { user } = useAuth();
  const navigate = useNavigate();
  const shouldReduce = useReducedMotion();
  const [expandedItem, setExpandedItem] = useState<string | null>("Reports");
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredItems = navItems.filter(item => item.roles.includes(currentRole));

  const allowedChildPath = (path: string): boolean => {
    if (currentRole === "worker") {
      return new Set(["/hrms", "/hrms/leave", "/hrms/my-requests"]).has(path);
    }
    if (path === "/hrms/my-requests") return false;
    return true;
  };

  const handleLogout = () => {
    logout();
    localStorage.setItem("mwmsys_logged_in", "false");
    navigate("/login");
  };

  const sidebarBg = "var(--bg-surface)";
  const borderColor = "var(--border-subtle)";

  const NavItemEl = ({ item }: { item: (typeof navItems)[0] }) => {
    const isActive =
      location.pathname === item.path ||
      (item.children && item.children.some(c => location.pathname === c.path));
    const hasChildren = !!item.children;
    const isExpanded = expandedItem === item.label;

    const activeBg = "rgba(79,110,247,0.12)";
    const activeColor = "var(--accent-color)";
    const inactiveColor = "var(--text-secondary)";
    const hoverBg = "var(--bg-hover)";

    const itemContent = (
      <>
        {/* Active left bar */}
        {isActive && (
          <motion.span
            layoutId="sidebar-active-bar"
            className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
            style={{ background: activeColor }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            background: isActive ? activeBg : "transparent",
          }}
        >
          <item.icon
            className="w-[17px] h-[17px] flex-shrink-0"
            style={{ color: isActive ? activeColor : inactiveColor }}
          />
        </span>
        <span
          className="flex-1 text-left text-sm font-medium"
          style={{ color: isActive ? "var(--text-primary)" : inactiveColor }}
        >
          {item.label}
        </span>
        {hasChildren && (
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight
              className="w-3.5 h-3.5"
              style={{ color: "var(--text-muted)" }}
            />
          </motion.span>
        )}
      </>
    );

    return (
      <motion.div variants={shouldReduce ? undefined : sidebarItem} key={item.label}>
        {hasChildren ? (
          <button
            onClick={() => setExpandedItem(isExpanded ? null : item.label)}
            className="relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors duration-150 group"
            style={{
              background: isActive ? activeBg : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = hoverBg;
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {itemContent}
          </button>
        ) : (
          <Link
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className="relative flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors duration-150 group"
            style={{ background: isActive ? activeBg : "transparent" }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = hoverBg;
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            }}
          >
            {itemContent}
          </Link>
        )}

        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden ml-4 mt-0.5 pl-3"
              style={{ borderLeft: "1px solid var(--border-subtle)" }}
            >
              {item.children!.filter((c) => allowedChildPath(c.path)).map((child) => {
                const childActive = location.pathname === child.path;
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150 my-0.5"
                    style={{
                      background: childActive ? activeBg : "transparent",
                      color: childActive ? activeColor : "var(--text-secondary)",
                    }}
                    onMouseEnter={(e) => {
                      if (!childActive) (e.currentTarget as HTMLAnchorElement).style.background = hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (!childActive) (e.currentTarget as HTMLAnchorElement).style.background = childActive ? activeBg : "transparent";
                    }}
                  >
                    <child.icon
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: childActive ? activeColor : "var(--text-muted)" }}
                    />
                    {child.label}
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const userName = user?.name ?? "User";
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden p-2.5 rounded-xl shadow-lg"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
        }}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen w-64 flex flex-col
          transition-transform duration-300 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        `}
        style={{
          background: sidebarBg,
          borderRight: `1px solid ${borderColor}`,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: `1px solid ${borderColor}` }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--accent-color) 0%, var(--accent-bright) 100%)",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            <span className="text-white font-bold text-xs tracking-wider">MW</span>
          </div>
          <div>
            <h1
              className="font-display font-bold text-sm tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              MWMSYS
            </h1>
            <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              Migrant Worker Assist.
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <motion.div
            className="space-y-0.5"
            variants={shouldReduce ? undefined : staggerChildren}
            initial="initial"
            animate="animate"
          >
            {filteredItems.map((item) => (
              <NavItemEl key={item.label} item={item} />
            ))}
          </motion.div>
        </nav>

        {/* User card */}
        <div
          className="px-3 py-3"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: "var(--bg-elevated)" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
              style={{
                background: "linear-gradient(135deg, var(--accent-color), var(--accent-bright))",
              }}
            >
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {userName}
              </p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                {roleLabelMap[currentRole] ?? currentRole}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
              title="Sign out"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--status-danger)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--status-danger-bg)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
