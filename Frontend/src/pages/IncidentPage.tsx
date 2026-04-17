import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { alertsData } from "@/data/alertsData";
import { workersData } from "@/data/workersData";
import {
  ChevronLeft, AlertTriangle, User, Building2, Phone, FileText,
  Clock, Send, Shield, CheckCircle2, ArrowUpCircle, MessageSquare
} from "lucide-react";
import { toast } from "sonner";

const LOCAL_INCIDENTS_KEY = "mwmsys_local_incidents";

function readLocalIncidents() {
  try {
    const raw = localStorage.getItem(LOCAL_INCIDENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as typeof alertsData;
  } catch {
    return [];
  }
}

const statusOptions = [
  { value: "open", label: "Open", color: "bg-warning/10 text-warning" },
  { value: "investigating", label: "Investigating", color: "bg-primary/10 text-primary" },
  { value: "escalated", label: "Escalated to Police", color: "bg-destructive/10 text-destructive" },
  { value: "resolved", label: "Resolved", color: "bg-success/10 text-success" },
];

interface ResponseLog {
  id: number;
  author: string;
  action: string;
  comment: string;
  timestamp: string;
}

function generateSmartSummary(params: {
  incident: (typeof alertsData)[number];
  workerEmployer?: string;
  allIncidents: typeof alertsData;
}) {
  const employerName = (params.incident.employer ?? params.workerEmployer ?? "").toString();
  const disputes = params.allIncidents.filter(
    (x) => x.type !== "Panic Alert" && employerName && (x.employer ?? "").toLowerCase() === employerName.toLowerCase()
  );
  const risk = params.incident.type === "Panic Alert" ? "High" : disputes.length > 2 ? "High" : disputes.length > 0 ? "Medium" : "Low";
  const disputeWord = disputes.length === 1 ? "dispute" : "disputes";

  return `Automated Risk Assessment: ${risk}. Employer has ${disputes.length} active ${disputeWord}.`;
}

export default function IncidentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const localIncidents = readLocalIncidents();
  const allIncidents = [...localIncidents, ...alertsData];
  const alert = allIncidents.find(a => a.id === Number(id));
  const [status, setStatus] = useState("open");
  const [newComment, setNewComment] = useState("");
  const [responses, setResponses] = useState<ResponseLog[]>([
    { id: 1, author: "FWWMC SEELAAN", action: "Incident Created", comment: "Alert received and logged into the system.", timestamp: "10 min after report" },
    { id: 2, author: "Admin", action: "Status → Investigating", comment: "Contacting employer for details.", timestamp: "30 min after report" },
  ]);

  if (!alert) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Incident Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">The incident you're looking for doesn't exist.</p>
          <button onClick={() => navigate("/")} className="text-sm text-primary hover:underline">Return to Dashboard</button>
        </div>
      </DashboardLayout>
    );
  }

  const worker = workersData.find(w => w.passportNo === alert.idNumber || w.name.toLowerCase() === alert.name.toLowerCase());
  const isPanic = alert.type === "Panic Alert";
  const currentStatus = statusOptions.find(s => s.value === status)!;
  const smartSummary = generateSmartSummary({ incident: alert, workerEmployer: worker?.employer, allIncidents: allIncidents as typeof alertsData });

  const handleAddResponse = () => {
    if (!newComment.trim()) return;
    setResponses(prev => [...prev, {
      id: Date.now(),
      author: "FWWMC SEELAAN",
      action: "Comment Added",
      comment: newComment,
      timestamp: "Just now",
    }]);
    setNewComment("");
    toast.success("Response logged successfully");
  };

  const handleStatusChange = (newStatus: string) => {
    const label = statusOptions.find(s => s.value === newStatus)?.label;
    setStatus(newStatus);
    setResponses(prev => [...prev, {
      id: Date.now(),
      author: "FWWMC SEELAAN",
      action: `Status → ${label}`,
      comment: `Incident status changed to "${label}"`,
      timestamp: "Just now",
    }]);
    toast.success(`Status updated to ${label}`);
  };

  return (
    <DashboardLayout>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      {/* Incident Header */}
      <div className={`relative overflow-hidden rounded-2xl p-7 mb-6 shadow-xl ${isPanic ? "bg-gradient-to-br from-[hsl(0,40%,15%)] via-[hsl(0,50%,18%)] to-[hsl(0,60%,22%)]" : "bg-gradient-to-br from-[hsl(38,40%,15%)] via-[hsl(38,50%,18%)] to-[hsl(38,60%,22%)]"}`}>
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg mb-3 ${isPanic ? "bg-destructive/20 text-[hsl(0,80%,70%)]" : "bg-warning/20 text-[hsl(38,80%,70%)]"}`}>
                <AlertTriangle className="w-3 h-3" />
                {alert.type} · #{alert.id}
              </span>
              <h1 className="text-xl font-bold text-[hsl(0,0%,100%)] mb-1">{alert.description || alert.type}</h1>
              <p className="text-[hsl(210,20%,75%)] text-sm">Reported by {alert.by} on {alert.date} at {alert.time}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${currentStatus.color}`}>
              {currentStatus.label}
            </span>
          </div>
        </div>
        <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl ${isPanic ? "bg-destructive/20" : "bg-warning/20"}`} />
      </div>

      {/* Smart Summary */}
      <div className="bg-card rounded-2xl border border-border/60 p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-foreground">Smart Summary</h3>
          <span className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg font-medium">AI Briefing</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{smartSummary}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Worker Details */}
        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Worker Details
          </h3>
          <div className="space-y-3">
            {[
              { label: "Name", value: alert.name },
              { label: "ID/Passport", value: alert.idNumber },
              { label: "Country", value: worker?.country || "—" },
              { label: "DOB", value: worker?.dob || "—" },
              { label: "Phone", value: worker?.phone || "—" },
              { label: "Status", value: worker?.status || "—" },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{item.label}</p>
                <p className="text-sm font-medium text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Employer Details */}
        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-success" />
            Employer Details
          </h3>
          <div className="space-y-3">
            {alert.employer ? (
              <>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Company</p>
                  <p className="text-sm font-medium text-foreground">{alert.employer}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Worker's Employer</p>
                  <p className="text-sm font-medium text-foreground">{worker?.employer || alert.employer}</p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Employer</p>
                <p className="text-sm font-medium text-foreground">{worker?.employer || "Not specified"}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Permit Expiry</p>
              <p className="text-sm font-medium text-foreground">{worker?.permitExpiry || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Insurance Expiry</p>
              <p className="text-sm font-medium text-foreground">{worker?.insuranceExpiry || "—"}</p>
            </div>
          </div>
        </div>

        {/* Status Control */}
        <div className="bg-card rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-warning" />
            Incident Control
          </h3>
          <div className="space-y-2">
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${status === opt.value ? opt.color + " ring-1 ring-current/20" : "text-muted-foreground hover:bg-muted/40"}`}
              >
                {opt.value === "open" && <Clock className="w-4 h-4" />}
                {opt.value === "investigating" && <FileText className="w-4 h-4" />}
                {opt.value === "escalated" && <ArrowUpCircle className="w-4 h-4" />}
                {opt.value === "resolved" && <CheckCircle2 className="w-4 h-4" />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Response Log */}
      <div className="bg-card rounded-2xl border border-border/60 p-6">
        <h3 className="text-sm font-bold text-foreground mb-5 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Response Log
        </h3>

        <div className="space-y-4 mb-6">
          {responses.map(r => (
            <div key={r.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">{r.author.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground">{r.author}</span>
                  <span className="text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">{r.action}</span>
                </div>
                <p className="text-sm text-muted-foreground">{r.comment}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">{r.timestamp}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Add Comment */}
        <div className="flex gap-3 pt-4 border-t border-border/40">
          <input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddResponse()}
            placeholder="Add a response or comment..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleAddResponse}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
