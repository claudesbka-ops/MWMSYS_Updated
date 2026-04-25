import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Building2, Mail, MapPin, Phone, Search, ChevronLeft, Users, BriefcaseBusiness, Link2 } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import LinkEntityModal, { type LinkSearchRow } from "@/components/LinkEntityModal";
import { agencyLinkEmployer, searchEmployers } from "@/services/relationshipService";
import { getAgenciesList } from "@/services/agencyService";
import { Skeleton } from "@/components/ui/skeleton";

type Agency = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  employerCount: number;
  workerCount: number;
};

export default function AgenciesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentRole } = useRole();
  const [search, setSearch] = useState("");
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [linkEmployerOpen, setLinkEmployerOpen] = useState(false);

  const { data: agenciesRows = [], isLoading } = useQuery({
    queryKey: ["agencies_list"],
    queryFn: getAgenciesList,
  });

  const agencies: Agency[] = useMemo(() => {
    return (agenciesRows ?? []).map((a) => ({
      id: (a.User_Id ?? "").toString(),
      name: (a.Agent_Organization_Name ?? a.Agent_Name ?? a.User_Id ?? "Agency").toString(),
      contact: (a.Agent_Name ?? "").toString(),
      phone: (a.Agent_ContactNumber ?? "").toString(),
      email: (a.Agent_EmailID ?? "").toString(),
      address: (a.Agent_CountryCode ?? "").toString(),
      employerCount: 0,
      workerCount: 0,
    }));
  }, [agenciesRows]);

  const q = search.trim().toLowerCase();
  const filtered = agencies.filter(
    (a) => !q || a.name.toLowerCase().includes(q) || a.contact.toLowerCase().includes(q)
  );

  const canLinkEmployer = currentRole === "agency";

  const handleSearchEmployers = async (q: string): Promise<LinkSearchRow[]> => {
    const results = await searchEmployers(q);
    return results.map((r) => ({
      id: r.id,
      primary: r.companyName || r.id,
      secondary: r.email || "—",
      meta: r.contactPerson ? `Contact: ${r.contactPerson}` : undefined,
    }));
  };

  const handleLinkEmployer = async (row: LinkSearchRow) => {
    await agencyLinkEmployer(row.id);
    // Invalidate lists so scoped worker views refresh under the new link.
    queryClient.invalidateQueries({ queryKey: ["workers_list"] });
    queryClient.invalidateQueries({ queryKey: ["employers_list"] });
  };

  if (selectedAgency) {
    return (
      <DashboardLayout>
        <button
          onClick={() => setSelectedAgency(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Directory
        </button>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(215,32%,22%)] to-[hsl(187,78%,25%)] p-7 mb-6 shadow-xl">
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(0,0%,100%)]/10 backdrop-blur-md flex items-center justify-center border border-[hsl(0,0%,100%)]/10">
                <Building2 className="w-7 h-7 text-[hsl(0,0%,100%)]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-[hsl(0,0%,100%)] truncate">{selectedAgency.name}</h1>
                <p className="text-[hsl(210,20%,75%)] text-sm truncate">Contact: {selectedAgency.contact}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {[
                { icon: BriefcaseBusiness, label: "Employers", value: selectedAgency.employerCount.toString() },
                { icon: Users, label: "Workers", value: selectedAgency.workerCount.toString() },
                { icon: Phone, label: "Phone", value: selectedAgency.phone },
                { icon: Mail, label: "Email", value: selectedAgency.email },
              ].map((item) => (
                <div
                  key={item.label}
                  className="px-3 py-2 rounded-xl bg-[hsl(0,0%,100%)]/10 backdrop-blur-md border border-[hsl(0,0%,100%)]/10"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <item.icon className="w-3 h-3 text-[hsl(210,20%,75%)]" />
                    <span className="text-[10px] text-[hsl(210,20%,75%)] uppercase tracking-wider font-medium">{item.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-[hsl(0,0%,100%)] truncate">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/20 blur-3xl" />
        </div>

        <div className="bg-card rounded-2xl border border-border/60 p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>{selectedAgency.address}</span>
          </div>
        </div>

        <div className="mt-6 bg-card rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-bold text-foreground mb-1">Directory Actions</h3>
          <p className="text-xs text-muted-foreground mb-4">Quick navigation for agency-level tasks</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/employer")}
              className="p-4 rounded-2xl border border-border/60 hover:bg-muted/30 transition-colors text-left"
            >
              <p className="text-sm font-semibold text-foreground">Browse Employers</p>
              <p className="text-xs text-muted-foreground mt-0.5">View employer directory and incident history</p>
            </button>
            <button
              onClick={() => navigate("/worker")}
              className="p-4 rounded-2xl border border-border/60 hover:bg-muted/30 transition-colors text-left"
            >
              <p className="text-sm font-semibold text-foreground">Browse Workers</p>
              <p className="text-xs text-muted-foreground mt-0.5">Search, filter and review worker records</p>
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Agency Directory</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} agencies registered</p>
        </div>
        {canLinkEmployer && (
          <button
            onClick={() => setLinkEmployerOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Link2 className="w-4 h-4" />
            Link Employer
          </button>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border/60 p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by agency name or contact..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/60 p-5">
              <div className="flex items-start gap-3 mb-4">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            No agencies registered yet.
          </div>
        ) : (
        filtered.map((agency) => (
          <button
            type="button"
            key={agency.id}
            onClick={() => setSelectedAgency(agency)}
            className="text-left group bg-card rounded-2xl border border-border/60 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{agency.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{agency.contact}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{agency.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{agency.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{agency.address}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <BriefcaseBusiness className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">{agency.employerCount} employers</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">{agency.workerCount} workers</span>
              </div>
            </div>
          </button>
        ))
        )}
      </div>

      <LinkEntityModal
        open={linkEmployerOpen}
        title="Link an Employer"
        subtitle="Search for an existing employer account by name, user ID, or email."
        placeholder="Search employer name, ID, or email…"
        onClose={() => setLinkEmployerOpen(false)}
        onSearch={handleSearchEmployers}
        onLink={handleLinkEmployer}
      />
    </DashboardLayout>
  );
}
