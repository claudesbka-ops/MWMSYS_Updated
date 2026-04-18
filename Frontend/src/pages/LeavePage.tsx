import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyLeave, decideLeave, getLeaves } from "@/services/hrmsService";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/contexts/RoleContext";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";

export default function LeavePage() {
  const { currentRole } = useRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const subscription = useSubscription();

  const { data = [], isLoading } = useQuery({
    queryKey: ["hrms_leave"],
    queryFn: getLeaves,
  });

  const [form, setForm] = useState({
    leaveType: "Annual",
    startDate: "",
    endDate: "",
  });

  const applyMut = useMutation({
    mutationFn: applyLeave,
    onSuccess: () => {
      toast.success("Leave submitted");
      setForm({ leaveType: "Annual", startDate: "", endDate: "" });
      qc.invalidateQueries({ queryKey: ["hrms_leave"] }).catch(() => undefined);
    },
  });

  const decideMut = useMutation({
    mutationFn: decideLeave,
    onSuccess: () => {
      toast.success("Leave updated");
      qc.invalidateQueries({ queryKey: ["hrms_leave"] }).catch(() => undefined);
    },
  });

  const rows = useMemo(() => {
    return (data ?? []).map((r) => {
      const sd = r.startDate ? new Date(String(r.startDate)).toLocaleDateString() : "";
      const ed = r.endDate ? new Date(String(r.endDate)).toLocaleDateString() : "";
      return { ...r, startFmt: sd, endFmt: ed };
    });
  }, [data]);

  const isWorker = currentRole === "worker";
  const canDecide = currentRole === "admin" || currentRole === "employer" || currentRole === "agency";
  const isWriteLocked = (currentRole === "agency" || currentRole === "employer") && !subscription.hasActivePlan;

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Leave</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Applications and approvals</p>
        </div>
      </div>

      {canDecide && isWriteLocked && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Subscription required</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade your plan to approve or reject leave applications.</p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
            >
              Go to Pricing
            </button>
          </div>
        </div>
      )}

      {isWorker && (
        <div className="bg-card rounded-2xl border border-border/60 p-5 mb-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Apply for Leave</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
              className="h-11 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm"
            >
              <option value="Annual">Annual</option>
              <option value="Sick">Sick</option>
              <option value="Emergency">Emergency</option>
            </select>
            <input
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              placeholder="Start (YYYY-MM-DD)"
              className="h-11 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm"
            />
            <input
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              placeholder="End (YYYY-MM-DD)"
              className="h-11 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm"
            />
            <button
              onClick={() => applyMut.mutate({ ...form })}
              disabled={applyMut.isPending}
              className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Start</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">End</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  {canDecide && (
                    <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{r.workerId}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.leaveType}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{(r as any).startFmt}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{(r as any).endFmt}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${r.status === "Approved" ? "bg-success/10 text-success" : r.status === "Rejected" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                        {r.status}
                      </span>
                    </td>
                    {canDecide && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => decideMut.mutate({ id: r.id, status: "Approved" })}
                            disabled={decideMut.isPending || isWriteLocked}
                            className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => decideMut.mutate({ id: r.id, status: "Rejected" })}
                            disabled={decideMut.isPending || isWriteLocked}
                            className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
