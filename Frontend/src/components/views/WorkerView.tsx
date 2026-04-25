import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, User, FileText, Shield, Phone, MapPin,
  Sparkles, MessageSquare, CheckCircle2, Image as ImageIcon, Video, Mic, Paperclip
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { getAccountProfile } from "@/services/accountService";
import { useAuth } from "@/contexts/AuthContext";

export default function WorkerView() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [panicTriggered, setPanicTriggered] = useState(false);
  const [panicStatus, setPanicStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [incidentFile, setIncidentFile] = useState<File | null>(null);
  const [panicDescription, setPanicDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [myProblems, setMyProblems] = useState<any[]>([]);

  const accountQuery = useQuery({
    queryKey: ["account_profile"],
    queryFn: getAccountProfile,
    staleTime: 60_000,
  });

  const account = accountQuery.data;
  const workerFields = account?.profile?.kind === "worker" ? account.profile.fields : null;

  const workerProfile = {
    name: (workerFields?.name || account?.userName || authUser?.name || "WORKER").toUpperCase(),
    passportNo: workerFields?.passportNumber || "—",
    country: "—",
    dob: "—",
    employer: "—",
    permitExpiry: "—",
    insuranceExpiry: "—",
    phone: workerFields?.contactNumber || "—",
    address: workerFields?.address || "—",
    status: "Active" as const,
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res2 = await apiClient.get("/Api/Worker/Problems");
        setMyProblems(Array.isArray(res2.data) ? res2.data : []);
      } catch {
        setMyProblems([]);
      }
    };

    load();
  }, []);

  const sendPanic = async () => {
    setPanicTriggered(true);
    setPanicStatus("sending");

    try {
      const form = new FormData();
      form.append("Title", "Panic Alert");
      form.append("Description", panicDescription.trim() ? panicDescription.trim() : "Worker triggered panic button");
      if (incidentFile) {
        form.append("file", incidentFile);
      }

      await apiClient.post("/Api/Panic", form);

      setPanicStatus("sent");
      toast.success("HELP REQUESTED", {
        description: "Your emergency alert has been sent.",
        duration: 12000,
      });
    } catch (e: any) {
      setPanicTriggered(false);
      setPanicStatus("idle");
      const msg = e?.response?.data?.error ? e.response.data.error.toString() : "Failed to send panic";
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {panicTriggered ? <div className="panic-overlay" /> : null}
      {/* Profile Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(270,40%,20%)] to-[hsl(270,60%,30%)] p-7 mb-6 shadow-xl">
        <div className="relative z-10 flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[hsl(0,0%,100%)]/10 backdrop-blur-md flex items-center justify-center border border-[hsl(0,0%,100%)]/10">
            <User className="w-8 h-8 text-[hsl(0,0%,100%)]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[hsl(270,60%,70%)]" />
              <span className="text-[10px] font-semibold text-[hsl(270,60%,70%)] uppercase tracking-widest">My Profile</span>
            </div>
            <h1 className="text-xl font-bold text-[hsl(0,0%,100%)] mb-0.5">{workerProfile.name}</h1>
            <p className="text-[hsl(210,20%,75%)] text-sm">{workerProfile.passportNo} · {workerProfile.country}</p>
            <div className="flex gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-success/20 text-success text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                {workerProfile.status}
              </span>
            </div>
          </div>
        </div>
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[hsl(270,60%,50%)]/20 blur-3xl" />
      </div>

      {/* Panic Button */}
      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => setIncidentFile(e.target.files?.[0] ?? null)}
          disabled={panicStatus === "sending" || panicStatus === "sent"}
        />

        <div className="mb-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">What happened? (optional)</label>
          <textarea
            value={panicDescription}
            onChange={(e) => setPanicDescription(e.target.value)}
            disabled={panicStatus === "sending" || panicStatus === "sent"}
            placeholder="Describe the emergency (e.g., injury, harassment, accident, threat...)"
            className="w-full min-h-[80px] px-3 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button
          onClick={sendPanic}
          disabled={panicStatus === "sending" || panicStatus === "sent"}
          className={`w-full py-5 rounded-2xl font-bold text-lg transition-all duration-300 shadow-lg ${
            panicTriggered
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-destructive/30 hover:shadow-xl active:scale-[0.98]"
          }`}
        >
          <div className="flex items-center justify-center gap-3">
            <AlertTriangle className="w-6 h-6" />
            {panicStatus === "sent" ? (
              "Panic Alert Sent!"
            ) : panicStatus === "sending" ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent"
                  aria-hidden="true"
                />
                Sending...
              </span>
            ) : (
              "Trigger Panic Alert"
            )}
          </div>
          {panicStatus === "idle" && (
            <p className="text-xs font-normal mt-1 opacity-80">Tap to send an emergency alert to your agency</p>
          )}
        </button>

        {panicStatus === "idle" ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                  }
                }}
                className="h-12 w-12 rounded-2xl border border-border/60 bg-card hover:bg-muted/50 transition-colors flex items-center justify-center"
                title="Add Image"
              >
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "video/*";
                    fileInputRef.current.click();
                  }
                }}
                className="h-12 w-12 rounded-2xl border border-border/60 bg-card hover:bg-muted/50 transition-colors flex items-center justify-center"
                title="Add Video"
              >
                <Video className="w-6 h-6 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "audio/*";
                    fileInputRef.current.click();
                  }
                }}
                className="h-12 w-12 rounded-2xl border border-border/60 bg-card hover:bg-muted/50 transition-colors flex items-center justify-center"
                title="Add Audio"
              >
                <Mic className="w-6 h-6 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp";
                    fileInputRef.current.click();
                  }
                }}
                className="h-12 w-12 rounded-2xl border border-border/60 bg-card hover:bg-muted/50 transition-colors flex items-center justify-center"
                title="Add Document"
              >
                <Paperclip className="w-6 h-6 text-muted-foreground" />
              </button>

              {incidentFile ? <span className="text-xs text-muted-foreground">Selected: {incidentFile.name}</span> : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { icon: FileText, label: "Permit Expiry", value: workerProfile.permitExpiry, color: "text-warning" },
          { icon: Shield, label: "Insurance Expiry", value: workerProfile.insuranceExpiry, color: "text-primary" },
          { icon: Phone, label: "Phone", value: workerProfile.phone, color: "text-success" },
          { icon: MapPin, label: "Employer", value: workerProfile.employer, color: "text-destructive" },
        ].map((info) => (
          <div key={info.label} className="bg-card rounded-2xl border border-border/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <info.icon className={`w-4 h-4 ${info.color}`} />
              <span className="text-[11px] text-muted-foreground font-medium">{info.label}</span>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{info.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border/60 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">My Documents</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Upload, replace, and delete your documents in one place</p>
          </div>
          <button
            onClick={() => navigate("/my-documents")}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Manage My Documents
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">My Submitted Issues</h3>
          <span className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg font-medium">{myProblems.length} total</span>
        </div>

        {myProblems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No issues submitted yet.</p>
        ) : (
          <div className="space-y-1">
            {myProblems.slice(0, 20).map((p) => {
              const isPanic = (p.Type ?? "").toString().toLowerCase() === "panic";
              const dt = p.Updated_On ? new Date(p.Updated_On.toString()) : null;
              return (
                <div key={String(p.ID)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isPanic ? "bg-destructive/10" : "bg-warning/10"
                  }`}>
                    {isPanic ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <MessageSquare className="w-4 h-4 text-warning" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{(p.Title ?? p.Type ?? "Issue").toString()}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{(p.Description ?? "").toString()}</p>
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {dt ? dt.toLocaleString() : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-10 pt-6 border-t border-border/40 text-center">
        <p className="text-[11px] text-muted-foreground/60">Copyright © 2018 MWMSYS All Rights Reserved</p>
      </div>
    </div>
  );
}
