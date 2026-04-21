import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { workersData, Worker } from "@/data/workersData";
import { Plus, Edit2, FileText, Search, Filter, X, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/contexts/RoleContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getWorkersList } from "@/services/workerService";
import { Skeleton } from "@/components/ui/skeleton";

const countries = ["Nepal", "Bangladesh", "Myanmar", "Indonesia", "Cambodia"];
const employers = [...new Set(workersData.map(w => w.employer).filter(Boolean))];

function AddEditWorkerModal({ worker, onClose }: { worker?: Worker; onClose: () => void }) {
  const isEdit = !!worker;
  const [form, setForm] = useState({
    name: worker?.name || "",
    passportNo: worker?.passportNo || "",
    country: worker?.country || "",
    dob: worker?.dob || "",
    employer: worker?.employer || "",
    permitExpiry: worker?.permitExpiry || "",
    insuranceExpiry: worker?.insuranceExpiry || "",
    phone: worker?.phone || "",
    maritalStatus: worker?.maritalStatus || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(isEdit ? "Worker updated successfully" : "Worker registered successfully");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{isEdit ? "Edit Worker" : "Register New Worker"}</h3>
              <p className="text-xs text-muted-foreground">Fill in the worker details below</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted/60 transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Full Name", key: "name", type: "text", placeholder: "Enter full name" },
              { label: "Passport No", key: "passportNo", type: "text", placeholder: "e.g. A12345678" },
              { label: "Country", key: "country", type: "select", options: countries },
              { label: "Date of Birth", key: "dob", type: "text", placeholder: "DD/MM/YYYY" },
              { label: "Employer", key: "employer", type: "text", placeholder: "Company name" },
              { label: "Phone", key: "phone", type: "text", placeholder: "+60 XX-XXX-XXXX" },
              { label: "Permit Expiry", key: "permitExpiry", type: "text", placeholder: "DD/MM/YYYY" },
              { label: "Insurance Expiry", key: "insuranceExpiry", type: "text", placeholder: "DD/MM/YYYY" },
              { label: "Marital Status", key: "maritalStatus", type: "select", options: ["Single", "Married", "Divorced"] },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{field.label}</label>
                {field.type === "select" ? (
                  <Select
                    value={(form as Record<string, string>)[field.key]}
                    onValueChange={(v) => setForm({ ...form, [field.key]: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="-- Select --" />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <input
                    type="text"
                    value={(form as Record<string, string>)[field.key]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Document Upload */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Document Uploads</label>
            <div className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center hover:border-primary/30 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Drag & drop passport, permit, or insurance documents</p>
              <p className="text-xs text-muted-foreground/60 mt-1">PDF, JPG, PNG up to 10MB</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              {isEdit ? "Update Worker" : "Register Worker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkerPage() {
  const navigate = useNavigate();
  const { currentRole } = useRole();

  const { data: workersRows = [], isLoading } = useQuery({
    queryKey: ["workers_list"],
    queryFn: getWorkersList,
  });

  const workers = useMemo(() => {
    // Keep the existing Worker UI model for now by mapping the API shape.
    if (!workersRows || workersRows.length === 0) return [] as Worker[];
    return workersRows.map((w, idx) => ({
      id: idx + 1,
      name: (w.Worker_Id ?? "").toString(),
      passportNo: (w.Passport_Number ?? "").toString(),
      country: (w.Country_Name ?? "").toString() || "Unknown",
      dob: "",
      employer: (w.Company_Name ?? "").toString() || "",
      permitExpiry: "",
      insuranceExpiry: "",
      phone: "",
      maritalStatus: "",
      entryDate: w.Created_On ? new Date(String(w.Created_On)).toLocaleDateString() : "",
      status: "Active",
    }));
  }, [workersRows]);
  const [showModal, setShowModal] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | undefined>();
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterEmployer, setFilterEmployer] = useState("");
  const [filterExpiry, setFilterExpiry] = useState<"all" | "expiring" | "expired">("all");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = workers.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.passportNo.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCountry && w.country !== filterCountry) return false;
    if (filterEmployer && w.employer !== filterEmployer) return false;
    if (filterExpiry === "expired" && w.status === "Active") return false;
    if (filterExpiry === "expiring") {
      // Placeholder: show all for demo
    }
    return true;
  });

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Worker Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} workers found</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFilters ? "bg-primary/10 border-primary/30 text-primary" : "border-border/60 text-muted-foreground hover:bg-muted/40"}`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          {currentRole !== "worker" && (
            <button
              onClick={() => { setEditWorker(undefined); setShowModal(true); }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Worker
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-card rounded-2xl border border-border/60 p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or passport number..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border/40">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Nationality</label>
              <Select value={filterCountry || "__all__"} onValueChange={(v) => setFilterCountry(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-10 px-3">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Countries</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Employer</label>
              <Select value={filterEmployer || "__all__"} onValueChange={(v) => setFilterEmployer(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-10 px-3">
                  <SelectValue placeholder="All Employers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Employers</SelectItem>
                  {employers.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Permit Status</label>
              <Select value={filterExpiry} onValueChange={(v) => setFilterExpiry(v as "all" | "expiring" | "expired")}>
                <SelectTrigger className="h-10 px-3">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="expiring">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border/40">
                <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Passport</th>
                <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Country</th>
                <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Employer</th>
                <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Permit Expiry</th>
                <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((w) => (
                <tr
                  key={w.id}
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/worker/${encodeURIComponent(w.name)}`)}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{w.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{w.name}</p>
                        <p className="text-[11px] text-muted-foreground">{w.dob}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{w.passportNo}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{w.country}</td>
                  <td className="px-4 py-3.5 text-muted-foreground text-xs">{w.employer || "—"}</td>
                  <td className="px-4 py-3.5 text-muted-foreground text-xs">{w.permitExpiry || "—"}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${w.status === "Active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {currentRole !== "worker" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditWorker(w);
                            setShowModal(true);
                          }}
                          className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {currentRole !== "worker" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/incident/new?worker=${w.id}`);
                          }}
                          className="p-2 rounded-lg hover:bg-warning/10 transition-colors text-muted-foreground hover:text-warning"
                          title="New Issue"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {currentRole !== "worker" && showModal && (
        <AddEditWorkerModal worker={editWorker} onClose={() => setShowModal(false)} />
      )}
    </DashboardLayout>
  );
}
