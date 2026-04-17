import { useRole, UserRole } from "@/contexts/RoleContext";
import { Shield, Building2, Briefcase, User, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const roles: { value: UserRole; label: string; icon: typeof Shield; desc: string }[] = [
  { value: "admin", label: "Admin", icon: Shield, desc: "Full system access" },
  { value: "agency", label: "Agency", icon: Briefcase, desc: "Agency portal view" },
  { value: "employer", label: "Employer", icon: Building2, desc: "Employer dashboard" },
  { value: "worker", label: "Worker", icon: User, desc: "Worker profile view" },
];

export default function RoleSwitcher() {
  const { currentRole, setCurrentRole } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = roles.find(r => r.value === currentRole)!;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
      >
        <current.icon className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-primary">{current.label}</span>
        <ChevronDown className={`w-3 h-3 text-primary/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-card rounded-xl border border-border/60 shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/40">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Switch Role</p>
          </div>
          {roles.map((role) => (
            <button
              key={role.value}
              onClick={() => { setCurrentRole(role.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                currentRole === role.value ? "bg-primary/10" : "hover:bg-muted/50"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                currentRole === role.value ? "bg-primary/20" : "bg-muted/60"
              }`}>
                <role.icon className={`w-4 h-4 ${currentRole === role.value ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${currentRole === role.value ? "text-primary" : "text-foreground"}`}>{role.label}</p>
                <p className="text-[11px] text-muted-foreground">{role.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
