import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import type { AlertData } from "@/components/AlertCard";
import { AlertTriangle, ChevronLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkersList } from "@/services/workerService";

type WorkerOption = {
  id: string;
  name: string;
  passportNo: string;
  employer: string;
};

const LOCAL_INCIDENTS_KEY = "mwmsys_local_incidents";

function readLocalIncidents(): AlertData[] {
  try {
    const raw = localStorage.getItem(LOCAL_INCIDENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AlertData[];
  } catch {
    return [];
  }
}

function writeLocalIncidents(items: AlertData[]) {
  localStorage.setItem(LOCAL_INCIDENTS_KEY, JSON.stringify(items));
}

export default function NewIncidentPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const preselectWorkerId = (params.get("worker") ?? "").toString().trim();

  const workersQuery = useQuery({
    queryKey: ["workers_list"],
    queryFn: getWorkersList,
  });

  const workerOptions: WorkerOption[] = useMemo(() => {
    return (workersQuery.data ?? [])
      .map((w) => ({
        id: (w.Worker_Id ?? "").toString(),
        name: ((w.Name ?? "").toString().trim() || (w.Worker_Id ?? "").toString()),
        passportNo: (w.Passport_Number ?? "").toString(),
        employer: (w.Company_Name ?? "").toString(),
      }))
      .filter((w) => !!w.id);
  }, [workersQuery.data]);

  // Treat ?worker=<id|passport> as either a Worker_Id or a passport number.
  const defaultWorker = useMemo(() => {
    if (!preselectWorkerId) return undefined;
    const lower = preselectWorkerId.toLowerCase();
    return workerOptions.find(
      (w) => w.id.toLowerCase() === lower || w.passportNo.toLowerCase() === lower
    );
  }, [preselectWorkerId, workerOptions]);

  const [workerPassport, setWorkerPassport] = useState("");
  const [incidentType, setIncidentType] = useState<"Issue" | "Panic Alert">("Issue");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // When workers load, auto-fill the dropdown from the ?worker= param.
  useEffect(() => {
    if (!workerPassport && defaultWorker?.passportNo) {
      setWorkerPassport(defaultWorker.passportNo);
    }
  }, [defaultWorker, workerPassport]);

  const worker = useMemo(() => {
    const passport = workerPassport.trim().toLowerCase();
    if (!passport) return undefined;
    return workerOptions.find((w) => w.passportNo.toLowerCase() === passport);
  }, [workerPassport, workerOptions]);

  const createIncident = () => {
    if (!worker) {
      toast.error("Select a valid worker");
      return;
    }

    const id = Date.now();
    const now = new Date();
    const date = now.toLocaleDateString("en-GB").split("/").join("/");
    const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    const newItem: AlertData = {
      id,
      name: worker.name,
      idNumber: worker.passportNo,
      type: incidentType,
      description: (description || title).trim() || incidentType,
      employer: worker.employer,
      date,
      time,
      by: user?.name ?? user?.id ?? "System",
      comments: 0,
    };

    const existing = readLocalIncidents();
    writeLocalIncidents([newItem, ...existing]);

    toast.success("Incident created");
    navigate(`/incident/${id}`);
  };

  return (
    <DashboardLayout>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">New Incident</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Create an issue or panic case record</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/60 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Worker</label>
              <Select
                value={workerPassport || "__select__"}
                onValueChange={(v) => setWorkerPassport(v === "__select__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select worker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__select__">Select worker</SelectItem>
                  {workerOptions.length === 0 && !workersQuery.isLoading ? (
                    <SelectItem value="__none__" disabled>
                      No workers available
                    </SelectItem>
                  ) : (
                    workerOptions.map((w) => (
                      <SelectItem key={w.id} value={w.passportNo || w.id}>
                        {w.name}{w.passportNo ? ` (${w.passportNo})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Type</label>
              <Select value={incidentType} onValueChange={(v) => setIncidentType(v as "Issue" | "Panic Alert")}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Issue">Issue</SelectItem>
                  <SelectItem value="Panic Alert">Panic Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short title"
                className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the incident"
                className="w-full min-h-[140px] px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 mt-4 border-t border-border/40">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createIncident}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Create Incident
            </button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Worker Snapshot</p>
              <p className="text-xs text-muted-foreground">Auto-filled from directory</p>
            </div>
          </div>

          {worker ? (
            <div className="space-y-3">
              {[{ l: "Name", v: worker.name }, { l: "Passport", v: worker.passportNo || "—" }, { l: "Employer", v: worker.employer || "—" }].map(
                (x) => (
                  <div key={x.l}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{x.l}</p>
                    <p className="text-sm font-medium text-foreground">{x.v}</p>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Select a worker to see details.</p>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-border/40">
            <button
              onClick={() => navigate("/reports/problem")}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Open Problem Report
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
