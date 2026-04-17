import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Building2, Users, Phone, Mail, MapPin, Search, ArrowRight, AlertTriangle, Clock, ChevronLeft, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getEmployerIncidentCounts, getEmployersList } from "@/services/employerService";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/apiClient";

export default function EmployerPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: employerRows = [], isLoading } = useQuery({
    queryKey: ["employers_list"],
    queryFn: getEmployersList,
  });

  const { data: incidentCounts = {}, isLoading: countsLoading } = useQuery({
    queryKey: ["employer_incident_counts"],
    queryFn: getEmployerIncidentCounts,
  });

  const employersData = useMemo(() => {
    return (employerRows ?? []).map((e, idx) => ({
      id: idx + 1,
      name: (e.Employer_Name ?? e.User_Id).toString(),
      contact: (e.Employer_ContactPerson ?? "").toString(),
      phone: (e.Employer_PIC_MobileNumber ?? e.Employer_OfficeNumber ?? "").toString(),
      email: (e.Employer_EmailID ?? "").toString(),
      address: (e.Employer_Address ?? "").toString(),
      workerCount: 0,
    }));
  }, [employerRows]);

  const [selectedEmployer, setSelectedEmployer] = useState<(typeof employersData)[0] | null>(null);

  const filtered = employersData.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) || e.contact.toLowerCase().includes(search.toLowerCase())
  );

  const incidentsQuery = useQuery({
    queryKey: ["employer_incidents", selectedEmployer?.name],
    queryFn: async () => {
      const companyName = selectedEmployer?.name ?? "";
      if (!companyName) return [] as any[];
      const res = await apiClient.get<any[]>("/Api/Employer/Incidents", {
        params: { companyName },
      });
      return res.data ?? [];
    },
    enabled: !!selectedEmployer?.name,
  });

  if (selectedEmployer) {
    const incidents = incidentsQuery.data ?? [];
    return (
      <DashboardLayout>
        <button onClick={() => setSelectedEmployer(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Directory
        </button>

        {/* Company Profile Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(152,40%,20%)] to-[hsl(152,60%,25%)] p-7 mb-6 shadow-xl">
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(0,0%,100%)]/10 backdrop-blur-md flex items-center justify-center border border-[hsl(0,0%,100%)]/10">
                <Building2 className="w-7 h-7 text-[hsl(0,0%,100%)]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[hsl(0,0%,100%)]">{selectedEmployer.name}</h1>
                <p className="text-[hsl(210,20%,75%)] text-sm">Contact: {selectedEmployer.contact}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {[
                { icon: Users, label: "Workers", value: selectedEmployer.workerCount.toString() },
                { icon: Phone, label: "Phone", value: selectedEmployer.phone },
                { icon: Mail, label: "Email", value: selectedEmployer.email },
                { icon: AlertTriangle, label: "Incidents", value: (incidents?.length ?? 0).toString() },
              ].map(item => (
                <div key={item.label} className="px-3 py-2 rounded-xl bg-[hsl(0,0%,100%)]/10 backdrop-blur-md border border-[hsl(0,0%,100%)]/10">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <item.icon className="w-3 h-3 text-[hsl(210,20%,75%)]" />
                    <span className="text-[10px] text-[hsl(210,20%,75%)] uppercase tracking-wider font-medium">{item.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-[hsl(0,0%,100%)] truncate">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-success/20 blur-3xl" />
        </div>

        {/* Address */}
        <div className="bg-card rounded-2xl border border-border/60 p-5 mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>{selectedEmployer.address}</span>
          </div>
        </div>

        {/* Incidents */}
        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-foreground">Incident History</h3>
            <span className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg font-medium">{incidents.length} records</span>
          </div>
          {incidentsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (incidents?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No incidents reported for this company.</p>
          ) : (
            <div className="space-y-1">
              {incidents.map((inc: any) => {
                const id = Number(inc?.ID ?? 0);
                const type = (inc?.Type ?? "Issue").toString();
                const title = (inc?.Title ?? inc?.Description ?? type).toString();
                const updated = inc?.Updated_On ? new Date(String(inc.Updated_On)) : null;
                const date = updated ? updated.toLocaleDateString() : "";
                const time = updated ? updated.toLocaleTimeString() : "";
                const isPanic = type.toLowerCase() === "panic";

                return (
                  <div
                    key={id}
                    onClick={() => (id ? navigate(`/incident/${id}`) : undefined)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer group"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPanic ? "bg-destructive/10" : "bg-warning/10"}`}>
                      <AlertTriangle className={`w-4 h-4 ${isPanic ? "text-destructive" : "text-warning"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{title}</p>
                      <p className="text-[11px] text-muted-foreground">{type} · {date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className="text-[11px]">{time}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Employer Directory</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} companies registered</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-card rounded-2xl border border-border/60 p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by company name or contact person..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Employer Cards */}
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
        ) : (
        filtered.map(emp => {
          const incidentCount = Number(incidentCounts?.[emp.name] ?? 0);
          return (
            <div
              key={emp.id}
              onClick={() => setSelectedEmployer(emp)}
              className="group bg-card rounded-2xl border border-border/60 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{emp.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{emp.contact}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{emp.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{emp.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border/40">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">{emp.workerCount} workers</span>
                </div>
                {!countsLoading && incidentCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                    <span className="text-xs font-semibold text-warning">{incidentCount} incidents</span>
                  </div>
                )}
                <div className="ml-auto">
                  <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          );
        })
        )}
      </div>
    </DashboardLayout>
  );
}
