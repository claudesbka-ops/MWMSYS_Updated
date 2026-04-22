import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRole } from "@/contexts/RoleContext";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadCsv, downloadPdfSimpleTable } from "@/lib/exporters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createShiftTemplate,
  getShiftTemplates,
  getRoster,
  upsertRosterAssignment,
  type RosterRow,
  type ShiftTemplateRow,
} from "@/services/rosterService";

export default function RosterPage() {
  const { currentRole } = useRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const subscription = useSubscription();

  const canWrite = currentRole === "admin" || currentRole === "employer" || currentRole === "agency";
  const isWriteLocked = (currentRole === "agency" || currentRole === "employer") && !subscription.hasActivePlan;

  const [range, setRange] = useState<{ from: Date; to: Date }>(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    return { from, to };
  });

  const templatesQuery = useQuery({
    queryKey: ["hrms_shift_templates"],
    queryFn: getShiftTemplates,
    enabled: canWrite,
  });

  const rosterQuery = useQuery({
    queryKey: ["hrms_roster", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => getRoster({ from: range.from.toISOString(), to: range.to.toISOString() }),
  });

  const [shiftForm, setShiftForm] = useState({
    name: "Day Shift",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
  });

  const createShiftMut = useMutation({
    mutationFn: (p: { name: string; startTime: string; endTime: string; breakMinutes: number }) => createShiftTemplate(p),
    onSuccess: () => {
      toast.success("Shift template created");
      qc.invalidateQueries({ queryKey: ["hrms_shift_templates"] }).catch(() => undefined);
    },
  });

  const assignMut = useMutation({
    mutationFn: (p: { workerId: string; date: string; shiftId: number }) => upsertRosterAssignment(p),
    onSuccess: () => {
      toast.success("Roster updated");
      qc.invalidateQueries({ queryKey: ["hrms_roster"] }).catch(() => undefined);
    },
  });

  const [assignForm, setAssignForm] = useState({
    workerId: "",
    date: new Date(),
    shiftId: "",
  });

  const templateOptions = (templatesQuery.data ?? []) as ShiftTemplateRow[];

  const rows = useMemo(() => {
    return ((rosterQuery.data?.rows ?? []) as RosterRow[]) ?? [];
  }, [rosterQuery.data]);

  const kpis = useMemo(() => {
    const assignments = rows.length;
    const uniqueWorkers = new Set(rows.map((r) => String(r.workerId ?? "")).filter(Boolean)).size;
    const totalHours = rows.reduce((acc, r) => acc + Number((r as any).shiftHours ?? 0), 0);
    const templates = (templateOptions ?? []).length;
    return { assignments, uniqueWorkers, totalHours, templates };
  }, [rows, templateOptions]);

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Roster</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Shift scheduling and assignments</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const headers = ["Date", "Worker", "Shift", "Hours"]; 
              const out = rows.map((r) => [
                r.date ? new Date(r.date).toLocaleDateString() : "—",
                r.workerId,
                r.shiftName,
                r.shiftHours,
              ]);
              downloadCsv(`roster_${new Date().toISOString().slice(0, 10)}.csv`, headers, out);
            }}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const headers = ["Date", "Worker", "Shift", "Hours"]; 
              const out = rows.map((r) => [
                r.date ? new Date(r.date).toLocaleDateString() : "—",
                r.workerId,
                r.shiftName,
                r.shiftHours,
              ]);
              downloadPdfSimpleTable(
                `roster_${new Date().toISOString().slice(0, 10)}.pdf`,
                "Roster",
                headers,
                out
              );
            }}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {canWrite && isWriteLocked && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Subscription required</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade your plan to manage shift templates and roster assignments.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border/60 p-5 lg:col-span-1">
          <h3 className="text-sm font-bold text-foreground mb-3">Date range</h3>
          <div className="grid grid-cols-1 gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start", !range.from && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(range.from, "PPP")} - {format(range.to, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: range.from, to: range.to }}
                  onSelect={(v) => {
                    if (!v?.from || !v?.to) return;
                    setRange({ from: v.from, to: v.to });
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={() => rosterQuery.refetch().catch(() => undefined)}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-foreground mb-3">Assignments</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Assignments</CardDescription>
                <CardTitle className="text-2xl">{kpis.assignments}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">In selected range</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Workers scheduled</CardDescription>
                <CardTitle className="text-2xl">{kpis.uniqueWorkers}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Unique workers</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total hours</CardDescription>
                <CardTitle className="text-2xl">{kpis.totalHours.toFixed(1)}h</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Sum of shift hours</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Templates</CardDescription>
                <CardTitle className="text-2xl">{kpis.templates}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Available shift presets</CardContent>
            </Card>
          </div>

          {canWrite && (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-2 md:col-span-2">
                  <Label>Worker Id</Label>
                  <Input value={assignForm.workerId} onChange={(e) => setAssignForm((p) => ({ ...p, workerId: e.target.value }))} placeholder="Worker Id" />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(assignForm.date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={assignForm.date}
                        onSelect={(d) => d && setAssignForm((p) => ({ ...p, date: d }))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Shift</Label>
                  <select
                    value={assignForm.shiftId}
                    onChange={(e) => setAssignForm((p) => ({ ...p, shiftId: e.target.value }))}
                    className="h-10 px-3 rounded-xl border border-border/60 bg-background text-foreground text-sm"
                  >
                    <option value="">--Select--</option>
                    {templateOptions.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name} ({t.startTime}-{t.endTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <Button
                  className="w-full"
                  disabled={isWriteLocked || assignMut.isPending || !assignForm.workerId.trim() || !assignForm.shiftId}
                  onClick={() =>
                    assignMut.mutate({
                      workerId: assignForm.workerId.trim(),
                      date: assignForm.date.toISOString(),
                      shiftId: Number(assignForm.shiftId),
                    })
                  }
                >
                  Assign Shift
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-auto rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Worker</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Shift</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{r.workerId}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.shiftName}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.shiftHours}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-muted-foreground">
                      No roster assignments in this range. Select a wider date range or assign shifts above.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 p-5 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Shift templates</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Create reusable shift presets (Pro feature)</p>
            </div>
          </div>

          {canWrite && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="space-y-2 md:col-span-2">
                <Label>Name</Label>
                <Input value={shiftForm.name} onChange={(e) => setShiftForm((p) => ({ ...p, name: e.target.value }))} placeholder="Shift name" />
              </div>
              <div className="space-y-2">
                <Label>Start</Label>
                <Input value={shiftForm.startTime} onChange={(e) => setShiftForm((p) => ({ ...p, startTime: e.target.value }))} placeholder="09:00" />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input value={shiftForm.endTime} onChange={(e) => setShiftForm((p) => ({ ...p, endTime: e.target.value }))} placeholder="18:00" />
              </div>
              <div className="space-y-2">
                <Label>Break (min)</Label>
                <Input value={shiftForm.breakMinutes} onChange={(e) => setShiftForm((p) => ({ ...p, breakMinutes: Number(e.target.value) }))} placeholder="60" />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={isWriteLocked || createShiftMut.isPending || !shiftForm.name.trim() || !shiftForm.startTime.trim() || !shiftForm.endTime.trim()}
                  onClick={() => createShiftMut.mutate({ ...shiftForm })}
                >
                  Create
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 overflow-auto rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Start</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">End</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Break</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(templateOptions ?? []).map((t) => (
                  <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5 text-foreground text-sm font-semibold">{t.name}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{t.startTime}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{t.endTime}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{t.breakMinutes} min</td>
                  </tr>
                ))}
                {(templateOptions ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-muted-foreground">No shift templates yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
