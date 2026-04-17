import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getWorkersList } from "@/services/workerService";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", passport: "", dob: "", country: "", fromDate: "", toDate: "" });
  const [submitted, setSubmitted] = useState(false);

  const { data: workersRows = [], isLoading } = useQuery({
    queryKey: ["workers_list"],
    queryFn: getWorkersList,
  });

  const normalized = {
    name: form.name.trim().toLowerCase(),
    passport: form.passport.trim().toLowerCase(),
    dob: form.dob.trim(),
    country: form.country.trim().toLowerCase(),
  };

  const results = useMemo(() => {
    const rows = workersRows ?? [];
    return rows.filter((w) => {
      const name = (w.Worker_Id ?? "").toString();
      const passport = (w.Passport_Number ?? "").toString();
      const country = (w.Country_Name ?? "").toString();

      if (normalized.name && !name.toLowerCase().includes(normalized.name)) return false;
      if (normalized.passport && !passport.toLowerCase().includes(normalized.passport)) return false;
      if (normalized.country && country.toLowerCase() !== normalized.country) return false;
      return true;
    });
  }, [normalized.country, normalized.name, normalized.passport, workersRows]);

  const runSearch = () => {
    setSubmitted(true);
    toast.success(`${results.length} result(s) found`);
  };

  return (
    <DashboardLayout>
      <h2 className="text-xl font-semibold text-foreground mb-6">Member Search</h2>
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-foreground w-32 text-right flex-shrink-0">Name:</label>
            <input
              value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              placeholder="Name"
              className="flex-1 px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-foreground w-32 text-right flex-shrink-0">IC/Passport:</label>
            <input
              value={form.passport} onChange={e => setForm({...form, passport: e.target.value})}
              placeholder="IC/Passport"
              className="flex-1 px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-foreground w-32 text-right flex-shrink-0">Date Of Birth:</label>
            <input
              type="date" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})}
              className="flex-1 px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-foreground w-32 text-right flex-shrink-0">Country:</label>
            <div className="flex-1">
              <Select
                value={form.country || "__any__"}
                onValueChange={(v) => setForm({ ...form, country: v === "__any__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="--Select--" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">--Select--</SelectItem>
                  <SelectItem value="Nepal">Nepal</SelectItem>
                  <SelectItem value="Bangladesh">Bangladesh</SelectItem>
                  <SelectItem value="Myanmar">Myanmar</SelectItem>
                  <SelectItem value="Indonesia">Indonesia</SelectItem>
                  <SelectItem value="Cambodia">Cambodia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-foreground w-32 text-right flex-shrink-0">Entry From:</label>
            <input
              type="date" value={form.fromDate} onChange={e => setForm({...form, fromDate: e.target.value})}
              className="flex-1 px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-foreground w-32 text-right flex-shrink-0">Entry To:</label>
            <input
              type="date" value={form.toDate} onChange={e => setForm({...form, toDate: e.target.value})}
              className="flex-1 px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex justify-center mt-6">
          <button
            onClick={runSearch}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>

      {submitted && (
        <div className="mt-6 bg-card rounded-2xl border border-border/60 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
            <div>
              <h3 className="text-sm font-bold text-foreground">Results</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{results.length} worker(s) matched</p>
            </div>
            <button
              onClick={() => navigate("/worker")}
              className="px-4 py-2 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              Open Worker Directory
            </button>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/40">
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Passport</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Country</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Employer</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {results.map((w) => (
                    <tr key={w.Worker_Id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-foreground">{(w.Worker_Id ?? "").toString()}</td>
                      <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{(w.Passport_Number ?? "—").toString()}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{(w.Country_Name ?? "—").toString()}</td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">{(w.Company_Name ?? "—").toString()}</td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => navigate(`/incident/new?worker=${encodeURIComponent(w.Worker_Id)}`)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/10 text-warning text-xs font-semibold hover:bg-warning/15 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          New Issue
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
