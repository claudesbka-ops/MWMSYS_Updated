import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Briefcase, Building2, ShieldAlert, ShieldCheck, Users } from "lucide-react";

import { getProblems } from "@/services/problemService";
import { getWorkersList } from "@/services/workerService";
import { getEmployersList } from "@/services/employerService";
import { getAgenciesList } from "@/services/agencyService";

export default function LabourDeptView() {
  const navigate = useNavigate();
  const { data: problems = [] } = useQuery({
    queryKey: ["problems"],
    queryFn: getProblems,
  });

  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["workers", "labour"],
    queryFn: getWorkersList,
  });
  const { data: employers = [], isLoading: employersLoading } = useQuery({
    queryKey: ["employers", "labour"],
    queryFn: getEmployersList,
  });
  const { data: agencies = [], isLoading: agenciesLoading } = useQuery({
    queryKey: ["agencies", "labour"],
    queryFn: getAgenciesList,
  });

  const activeAlerts = problems.filter(
    (p) => !(p as any).IsResolved && ((p as any).ProbStatus !== "Resolved")
  ).length;

  const stats = [
    { icon: Users, value: workers.length, label: "Total Workers" },
    { icon: Building2, value: employers.length, label: "Total Employers" },
    { icon: Briefcase, value: agencies.length, label: "Total Agencies" },
    { icon: ShieldAlert, value: activeAlerts, label: "Active Alerts" },
  ];

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(215,32%,22%)] to-[hsl(243,75%,35%)] p-7 mb-7 shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-widest">Labour Department</span>
          </div>
          <h1 className="text-2xl font-bold text-[hsl(0,0%,100%)] mb-1.5">
            Labour Department — National Overview
          </h1>
          <p className="text-[hsl(210,20%,75%)] text-sm max-w-lg">
            Nationwide oversight across workers, employers, and recruitment agencies.
          </p>
        </div>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group bg-card rounded-2xl border border-border/60 p-5 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/10 group-hover:scale-110 transition-transform duration-300">
              <stat.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border/60 p-6 mb-6">
        <h3 className="text-sm font-bold text-foreground mb-1">Workers</h3>
        <p className="text-xs text-muted-foreground mb-4">All workers nationwide</p>
        {workersLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : workers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workers registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <th className="py-2 pr-3 font-medium">Worker ID</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Passport</th>
                  <th className="py-2 pr-3 font-medium">Country</th>
                  <th className="py-2 pr-3 font-medium">Employer</th>
                </tr>
              </thead>
              <tbody>
                {workers.slice(0, 100).map((w) => (
                  <tr
                    key={w.Worker_Id}
                    onClick={() => navigate(`/worker/${encodeURIComponent(w.Worker_Id)}`)}
                    className="cursor-pointer border-b border-border/40 hover:bg-muted/30"
                  >
                    <td className="py-2 pr-3 font-mono text-xs text-foreground">{w.Worker_Id}</td>
                    <td className="py-2 pr-3 text-foreground">{w.Name ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{w.Passport_Number ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{w.Country_Name ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {w.Company_Name ?? w.Employer_Id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border/60 p-6 mb-6">
        <h3 className="text-sm font-bold text-foreground mb-1">Employers</h3>
        <p className="text-xs text-muted-foreground mb-4">Registered employers</p>
        {employersLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : employers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employers registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <th className="py-2 pr-3 font-medium">ID</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Contact Person</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody>
                {employers.slice(0, 100).map((e) => (
                  <tr key={e.User_Id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2 pr-3 font-mono text-xs text-foreground">{e.User_Id}</td>
                    <td className="py-2 pr-3 text-foreground">{e.Employer_Name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{e.Employer_ContactPerson ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{e.Employer_EmailID ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {e.Employer_PIC_MobileNumber ?? e.Employer_OfficeNumber ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border/60 p-6">
        <h3 className="text-sm font-bold text-foreground mb-1">Agencies</h3>
        <p className="text-xs text-muted-foreground mb-4">Registered recruitment agencies</p>
        {agenciesLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : agencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agencies registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <th className="py-2 pr-3 font-medium">ID</th>
                  <th className="py-2 pr-3 font-medium">Agent</th>
                  <th className="py-2 pr-3 font-medium">Organization</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody>
                {agencies.slice(0, 100).map((a) => (
                  <tr key={a.User_Id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2 pr-3 font-mono text-xs text-foreground">{a.User_Id}</td>
                    <td className="py-2 pr-3 text-foreground">{a.Agent_Name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{a.Agent_Organization_Name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{a.Agent_EmailID}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{a.Agent_ContactNumber ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
