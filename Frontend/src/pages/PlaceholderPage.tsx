import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { workersData } from "@/data/workersData";
import { alertsData } from "@/data/alertsData";
import { useRole } from "@/contexts/RoleContext";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { jsPDF } from "jspdf";
import {
  CreditCard,
  FileCheck,
  FileText,
  Shield,
  UserCheck,
  Users,
  Wallet,
  AlertTriangle,
  Download,
  ArrowRight,
  Search,
} from "lucide-react";

type SimpleRow = Record<string, string | number | undefined>;

function notImplemented() {
  toast.info("Not implemented yet", { description: "This section is not connected to the live backend." });
}

type WorkerDocument = { type: string; name: string; url: string; hasFile: boolean };

function CardShell({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl p-6 glass-surface premium-ring premium-hover">{children}</div>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {subtitle ? <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p> : null}
    </div>
  );
}

function DataTable({
  columns,
  rows,
  onRowClick,
}: {
  columns: { key: string; label: string; className?: string }[];
  rows: SimpleRow[];
  onRowClick?: (row: SimpleRow) => void;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border/40">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`text-left px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider ${c.className ?? ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r, i) => (
              <tr
                key={String(r.id ?? i)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`${onRowClick ? "cursor-pointer" : ""} hover:bg-muted/20 transition-colors`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3.5 text-muted-foreground ${c.className ?? ""}`}>
                    {String(r[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PlaceholderPage({ title }: { title: string }) {
  const navigate = useNavigate();
  const { currentRole } = useRole();
  const [search, setSearch] = useState("");
  const [topupAmount, setTopupAmount] = useState("50");
  const [topupRef, setTopupRef] = useState("");
  const [topupAccount, setTopupAccount] = useState<string>("");
  const [documents, setDocuments] = useState<WorkerDocument[]>([]);
  const [docType, setDocType] = useState("passport");
  const [busy, setBusy] = useState(false);
  const docUploadRef = useRef<HTMLInputElement | null>(null);
  const [attestationDocType, setAttestationDocType] = useState<string>("");
  const [userRoleDraft, setUserRoleDraft] = useState<string>("");

  const page = useMemo(() => title.trim().toLowerCase(), [title]);

  const refreshDocuments = async () => {
    const res = await apiClient.get("/Api/Worker/Documents");
    const docs = Array.isArray(res.data?.documents) ? res.data.documents : [];
    setDocuments(docs);
  };

  useEffect(() => {
    if (page !== "my documents") return;
    refreshDocuments().catch(() => undefined);
  }, [page]);

  const workerDirectory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workersData;
    return workersData.filter(
      (w) => w.name.toLowerCase().includes(q) || w.passportNo.toLowerCase().includes(q) || w.country.toLowerCase().includes(q)
    );
  }, [search]);

  const commonActions = (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={notImplemented}
        disabled
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground opacity-60 cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        Export
      </button>
      <button
        onClick={notImplemented}
        disabled
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold opacity-60 cursor-not-allowed"
      >
        <ArrowRight className="w-4 h-4" />
        Save
      </button>
    </div>
  );

  const render = () => {
    if (page === "attestation") {
      return (
        <>
          <SectionTitle title="Attestation" subtitle="Create and track document attestation requests" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <CardShell>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">New Request</p>
                  <p className="text-xs text-muted-foreground">Submit for worker verification</p>
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search worker by name/passport"
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Select value={attestationDocType} onValueChange={setAttestationDocType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="permit">Visa/Permit</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="contract">Employment Contract</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={notImplemented}
                  disabled
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold opacity-60 cursor-not-allowed"
                >
                  <FileCheck className="w-4 h-4" />
                  Submit Request
                </button>
              </div>
            </CardShell>

            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Queue Summary</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {["Submitted", "In Review", "Approved", "Rejected"].map((s) => (
                  <div key={s} className="rounded-xl bg-muted/40 border border-border/40 p-3">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">{s}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{s === "Submitted" ? 7 : s === "In Review" ? 3 : s === "Approved" ? 12 : 1}</p>
                  </div>
                ))}
              </div>
            </CardShell>

            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">SLA Targets</p>
              <div className="mt-3 space-y-2">
                {["Initial screening", "Verification", "Final approval"].map((t, i) => (
                  <div key={t} className="flex items-center justify-between rounded-xl bg-muted/40 border border-border/40 px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">{t}</p>
                    <p className="text-xs text-muted-foreground">{i === 0 ? "4h" : i === 1 ? "24h" : "48h"}</p>
                  </div>
                ))}
              </div>
            </CardShell>
          </div>

          <DataTable
            columns={[
              { key: "id", label: "#", className: "w-16" },
              { key: "worker", label: "Worker" },
              { key: "passport", label: "Passport" },
              { key: "doc", label: "Document" },
              { key: "status", label: "Status" },
              { key: "updated", label: "Updated" },
            ]}
            rows={workerDirectory.slice(0, 8).map((w, i) => ({
              id: i + 1,
              worker: w.name,
              passport: w.passportNo,
              doc: i % 2 === 0 ? "Passport" : "Visa/Permit",
              status: i % 3 === 0 ? "In Review" : i % 3 === 1 ? "Submitted" : "Approved",
              updated: i % 2 === 0 ? "Today" : "Yesterday",
            }))}
            onRowClick={(r) => toast.info(`Opening request #${r.id}`)}
          />
        </>
      );
    }

    if (page === "topup") {
      return (
        <>
          <SectionTitle title="TopUp" subtitle="Record payments and allocate credit to accounts" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <CardShell>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">New TopUp</p>
                  <p className="text-xs text-muted-foreground">Post a credit transaction</p>
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <Select value={topupAccount} onValueChange={setTopupAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agency">Agency Wallet</SelectItem>
                    <SelectItem value="employer">Employer Wallet</SelectItem>
                    <SelectItem value="worker">Worker Wallet</SelectItem>
                  </SelectContent>
                </Select>
                <input
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="Amount (MYR)"
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  value={topupRef}
                  onChange={(e) => setTopupRef(e.target.value)}
                  placeholder="Reference / receipt no."
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={notImplemented}
                  disabled
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold opacity-60 cursor-not-allowed"
                >
                  <CreditCard className="w-4 h-4" />
                  Post TopUp
                </button>
              </div>
            </CardShell>

            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Balances</p>
              <div className="mt-3 space-y-2">
                {["Agency", "Employer", "Worker"].map((k, i) => (
                  <div key={k} className="flex items-center justify-between rounded-xl bg-muted/40 border border-border/40 px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">{k} Wallet</p>
                    <p className="text-sm font-bold text-foreground">MYR {i === 0 ? "12,450" : i === 1 ? "8,320" : "1,150"}</p>
                  </div>
                ))}
              </div>
            </CardShell>

            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Controls</p>
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => toast.info("Statement generation queued")}
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  Generate Statement
                </button>
                <button
                  onClick={() => toast.info("Reconciliation started")}
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  Reconcile Payments
                </button>
              </div>
            </CardShell>
          </div>

          <DataTable
            columns={[
              { key: "id", label: "#", className: "w-16" },
              { key: "account", label: "Account" },
              { key: "amount", label: "Amount" },
              { key: "ref", label: "Reference" },
              { key: "date", label: "Date" },
            ]}
            rows={Array.from({ length: 8 }).map((_, i) => ({
              id: i + 1,
              account: i % 3 === 0 ? "Agency Wallet" : i % 3 === 1 ? "Employer Wallet" : "Worker Wallet",
              amount: `MYR ${i % 2 === 0 ? "100" : "250"}`,
              ref: `TRX-${1000 + i}`,
              date: i < 3 ? "Today" : "This week",
            }))}
          />
        </>
      );
    }

    if (page === "account") {
      return (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Account</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Profile, security and preferences</p>
            </div>
            {commonActions}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CardShell>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Profile</p>
                  <p className="text-xs text-muted-foreground">Identity and contact</p>
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <input className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" defaultValue="FWWMC SEELAAN" />
                <input className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" defaultValue="support@mwmsys.local" />
                <button
                  onClick={notImplemented}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold opacity-60 cursor-not-allowed"
                >
                  Update Profile
                </button>
              </div>
            </CardShell>
            <CardShell>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Security</p>
                  <p className="text-xs text-muted-foreground">Password and sessions</p>
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <input type="password" className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="New password" />
                <input type="password" className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Confirm password" />
                <button
                  onClick={notImplemented}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground opacity-60 cursor-not-allowed"
                >
                  Update Password
                </button>
              </div>
            </CardShell>
            <CardShell>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Preferences</p>
                  <p className="text-xs text-muted-foreground">Notifications and defaults</p>
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <label className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                  <span className="text-sm font-medium text-foreground">Email notifications</span>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                  <span className="text-sm font-medium text-foreground">Auto-refresh dashboard</span>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </label>
              </div>
            </CardShell>
          </div>
        </>
      );
    }

    if (page === "reports") {
      const downloadOfficialReport = () => {
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const marginX = 48;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const contentWidth = pageWidth - marginX * 2;
        const now = new Date();
        let y = 64;

        doc.setFillColor(20, 31, 38);
        doc.roundedRect(marginX, 40, contentWidth, 56, 14, 14, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont(undefined, "bold");
        doc.text("MWMSYS Official Report", marginX + 18, 66);
        doc.setFont(undefined, "normal");
        doc.setFontSize(10);
        doc.text(`Generated: ${now.toLocaleString()}`, marginX + 18, 84);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text("Prepared for: Labour Department", pageWidth - marginX - 18, 84, { align: "right" });

        y = 120;
        doc.setTextColor(25, 30, 38);
        doc.setFontSize(12);
        doc.setFont(undefined, "bold");
        doc.text("Worker Registry Snapshot", marginX, y);
        doc.setFont(undefined, "normal");
        y += 18;

        const headers = ["#", "Name", "Passport", "Country", "Employer", "Status"];
        const colW = [28, 172, 96, 74, 156, 64];
        const colX = colW.reduce<number[]>((acc, w, i) => {
          if (i === 0) return [marginX];
          return [...acc, acc[i - 1] + colW[i - 1]];
        }, []);

        const rowH = 18;
        const headerH = 22;

        const drawTableHeader = (topY: number) => {
          doc.setFillColor(245, 247, 249);
          doc.roundedRect(marginX, topY - 16, contentWidth, headerH, 10, 10, "F");
          doc.setDrawColor(225);
          doc.roundedRect(marginX, topY - 16, contentWidth, headerH, 10, 10, "S");

          doc.setFontSize(9);
          doc.setFont(undefined, "bold");
          doc.setTextColor(85);
          headers.forEach((h, idx) => {
            doc.text(String(h), colX[idx] + 10, topY);
          });
          doc.setFont(undefined, "normal");
          doc.setTextColor(30);
        };

        drawTableHeader(y);
        y += 12;

        workersData.forEach((w, idx) => {
          if (y + rowH + 56 > pageHeight) {
            doc.addPage();
            y = 64;
            doc.setTextColor(25, 30, 38);
            drawTableHeader(y);
            y += 12;
          }

          if (idx % 2 === 0) {
            doc.setFillColor(250, 251, 252);
            doc.roundedRect(marginX, y - 13, contentWidth, rowH, 10, 10, "F");
          }

          doc.setFontSize(9);
          const row = [
            String(idx + 1),
            String(w.name ?? "—"),
            String(w.passportNo ?? "—"),
            String(w.country ?? "—"),
            String(w.employer ?? "—"),
            String(w.status ?? "—"),
          ];

          doc.text(row[0], colX[0] + 10, y);
          doc.text(row[1].slice(0, 34), colX[1] + 10, y);
          doc.text(row[2].slice(0, 16), colX[2] + 10, y);
          doc.text(row[3].slice(0, 14), colX[3] + 10, y);
          doc.text(row[4].slice(0, 28), colX[4] + 10, y);
          doc.text(row[5].slice(0, 12), colX[5] + 10, y);
          y += rowH;
        });

        doc.setTextColor(120);
        doc.setFontSize(9);
        doc.text(`MWMSYS · ${now.getFullYear()}`, pageWidth - marginX, pageHeight - 32, { align: "right" });

        doc.save("MWMSYS_Official_Report.pdf");
      };

      return (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Reports</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Operational reporting for workforce and incidents</p>
            </div>
            {currentRole === "labour" && (
              <button
                onClick={downloadOfficialReport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Official Report
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              { title: "Entry Report", icon: FileText, path: "/reports/entry" },
              { title: "Insurance Expiry", icon: AlertTriangle, path: "/reports/insurance" },
              { title: "Visa/Permit Expiry", icon: AlertTriangle, path: "/reports/visa" },
              { title: "Problem Report", icon: AlertTriangle, path: "/reports/problem" },
              { title: "User Entry Report", icon: Users, path: "/reports/user-entry" },
            ].map((r) => (
              <button
                key={r.path}
                onClick={() => navigate(r.path)}
                className="text-left bg-card rounded-2xl border border-border/60 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <r.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Open report</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      );
    }

    if (page === "problem report") {
      return (
        <>
          <SectionTitle title="Problem Report" subtitle="Log and monitor worker issues" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <CardShell>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">New Issue</p>
                  <p className="text-xs text-muted-foreground">Create a case record</p>
                </div>
              </div>
              <div className="space-y-3 mt-4">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search worker (name/passport)"
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  placeholder="Issue title"
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <textarea
                  placeholder="Describe the issue and required action"
                  className="w-full min-h-[110px] px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={notImplemented}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold opacity-60 cursor-not-allowed"
                >
                  Create Case
                </button>
              </div>
            </CardShell>
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Quick Filters</p>
              <div className="mt-3 space-y-2">
                {["Open", "Investigating", "Escalated", "Resolved"].map((s) => (
                  <button
                    key={s}
                    onClick={() => toast.info(`Filtered: ${s}`)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </CardShell>
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">KPIs</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  { label: "Active cases", value: alertsData.filter((a) => a.type !== "Panic Alert").length },
                  { label: "Panic alerts", value: alertsData.filter((a) => a.type === "Panic Alert").length },
                  { label: "Workers", value: workersData.length },
                  { label: "Employers", value: new Set(workersData.map((w) => w.employer).filter(Boolean)).size },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl bg-muted/40 border border-border/40 p-3">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">{k.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{k.value}</p>
                  </div>
                ))}
              </div>
            </CardShell>
          </div>

          <DataTable
            columns={[
              { key: "id", label: "#", className: "w-16" },
              { key: "type", label: "Type" },
              { key: "name", label: "Worker" },
              { key: "passport", label: "Passport" },
              { key: "desc", label: "Summary" },
              { key: "date", label: "Date" },
            ]}
            rows={alertsData
              .filter((a) => a.type !== "Panic Alert")
              .slice(0, 10)
              .map((a) => ({
                id: a.id,
                type: a.type,
                name: a.name,
                passport: a.idNumber,
                desc: a.description ?? a.type,
                date: a.date,
              }))}
            onRowClick={(r) => navigate(`/incident/${r.id}`)}
          />
        </>
      );
    }

    if (page === "user entry report") {
      return (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">User Entry Report</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Registrations and entry records by worker</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search worker..."
                  className="pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <button
                onClick={notImplemented}
                disabled
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold opacity-60 cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "id", label: "ID", className: "w-20" },
              { key: "name", label: "Name" },
              { key: "passportNo", label: "Passport" },
              { key: "country", label: "Country" },
              { key: "entryDate", label: "Entry Date" },
              { key: "status", label: "Status" },
            ]}
            rows={workerDirectory.map((w) => ({
              id: w.id,
              name: w.name,
              passportNo: w.passportNo,
              country: w.country,
              entryDate: w.entryDate,
              status: w.status,
            }))}
            onRowClick={(r) => toast.info(`Opened worker #${r.id}`)}
          />
        </>
      );
    }

    if (page === "users") {
      return (
        <>
          <SectionTitle title="Users" subtitle="Manage system users and access roles" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Create User</p>
              <div className="space-y-3 mt-3">
                <input className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Full name" />
                <input className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Username" />
                <Select value={userRoleDraft} onValueChange={setUserRoleDraft}>
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="employer">Employer</SelectItem>
                    <SelectItem value="worker">Worker</SelectItem>
                    <SelectItem value="labour">Labour Dept</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={notImplemented}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold opacity-60 cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </CardShell>
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Directory</p>
              <div className="space-y-2 mt-3">
                {["Admin", "Agency", "Employer"].map((r, i) => (
                  <div key={r} className="flex items-center justify-between rounded-xl bg-muted/40 border border-border/40 px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">{r}</p>
                    <p className="text-sm font-bold text-foreground">{i === 0 ? 3 : i === 1 ? 14 : 86}</p>
                  </div>
                ))}
              </div>
            </CardShell>
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Audit</p>
              <div className="space-y-2 mt-3">
                {[
                  { a: "Role changed", u: "Admin", t: "Today" },
                  { a: "Login", u: "Agency", t: "Today" },
                  { a: "Password reset", u: "Employer", t: "This week" },
                ].map((x, idx) => (
                  <div key={idx} className="rounded-xl border border-border/60 px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">{x.a}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{x.u} · {x.t}</p>
                  </div>
                ))}
              </div>
            </CardShell>
          </div>
        </>
      );
    }

    if (page === "administration") {
      return (
        <>
          <SectionTitle title="Administration" subtitle="System configuration and governance" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              { t: "Roles & Permissions", icon: Shield },
              { t: "Integrations", icon: FileCheck },
              { t: "Data Retention", icon: FileText },
              { t: "Notifications", icon: AlertTriangle },
              { t: "Audit Logs", icon: Users },
              { t: "System Health", icon: Wallet },
            ].map((x) => (
              <CardShell key={x.t}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <x.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{x.t}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage settings</p>
                  </div>
                  <button
                    onClick={() => toast.info(`${x.t} opened`)}
                    className="px-3 py-2 rounded-xl border border-border/60 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition-colors"
                  >
                    Open
                  </button>
                </div>
              </CardShell>
            ))}
          </div>
        </>
      );
    }

    if (page === "my documents") {
      const upload = async (file: File, type: string) => {
        setBusy(true);
        try {
          const form = new FormData();
          form.append("docType", type);
          form.append("file", file);
          await apiClient.post("/Api/Worker/Documents", form);
          toast.success("Document uploaded");
          await refreshDocuments();
        } catch (e: any) {
          const msg = e?.response?.data?.error ? e.response.data.error.toString() : "Upload failed";
          toast.error(msg);
        } finally {
          setBusy(false);
        }
      };

      const del = async (type: string) => {
        const ok = window.confirm("Delete this document? This cannot be undone.");
        if (!ok) return;
        setBusy(true);
        try {
          await apiClient.delete("/Api/Worker/Documents", { params: { docType: type } });
          toast.success("Document deleted");
          await refreshDocuments();
        } catch (e: any) {
          const msg = e?.response?.data?.error ? e.response.data.error.toString() : "Delete failed";
          toast.error(msg);
        } finally {
          setBusy(false);
        }
      };

      return (
        <>
          <SectionTitle title="My Documents" subtitle="Store and share your personal documents securely" />
          <input
            ref={docUploadRef}
            type="file"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f, docType);
              if (docUploadRef.current) docUploadRef.current.value = "";
            }}
          />

          <div className="bg-card rounded-2xl border border-border/60 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Upload Document</h3>
              <button
                onClick={() => refreshDocuments().catch(() => undefined)}
                disabled={busy}
                className="px-3 py-2 rounded-xl border border-border/60 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Refresh
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:w-60">
                <Select value={docType} onValueChange={setDocType} disabled={busy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport Copy</SelectItem>
                    <SelectItem value="permit">Work Permit</SelectItem>
                    <SelectItem value="insurance">Insurance Policy</SelectItem>
                    <SelectItem value="contract">Employment Contract</SelectItem>
                    <SelectItem value="demand_letter">Demand Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <button
                onClick={() => docUploadRef.current?.click()}
                disabled={busy}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Choose File & Upload
              </button>
              <p className="text-xs text-muted-foreground sm:ml-auto self-center">Re-uploading replaces the existing file.</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/60 p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">My Documents</h3>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.type} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium text-foreground">{d.name}</span>
                    {d.hasFile ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-success/10 text-success"
                        >
                          View
                        </a>
                        <button
                          onClick={() => {
                            setDocType(d.type);
                            docUploadRef.current?.click();
                          }}
                          disabled={busy}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border/60 text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Replace
                        </button>
                        <button
                          onClick={() => del(d.type)}
                          disabled={busy}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted/50 text-muted-foreground">Missing</span>
                        <button
                          onClick={() => {
                            setDocType(d.type);
                            docUploadRef.current?.click();
                          }}
                          disabled={busy}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border/60 text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Upload
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      );
    }

    if (page === "panic status") {
      return (
        <>
          <SectionTitle title="Panic Status" subtitle="Track your safety alerts and response progress" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Current</p>
              <div className="mt-3 rounded-2xl border border-border/60 p-4 bg-muted/20">
                <p className="text-sm font-semibold text-foreground">No active panic alert</p>
                <p className="text-xs text-muted-foreground mt-1">If you need urgent help, use the Panic button in the login screen.</p>
              </div>
              <button
                onClick={() => navigate("/panic")}
                className="mt-3 w-full px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors"
              >
                Open Panic Button
              </button>
            </CardShell>
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Safety Checklist</p>
              <div className="mt-3 space-y-2">
                {["Emergency contact updated", "Location sharing enabled", "Trusted contacts added"].map((x, i) => (
                  <label key={x} className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                    <span className="text-sm font-medium text-foreground">{x}</span>
                    <input type="checkbox" defaultChecked={i !== 1} className="h-4 w-4" />
                  </label>
                ))}
              </div>
            </CardShell>
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Actions</p>
              <div className="mt-3 space-y-2">
                <button
                  onClick={notImplemented}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground opacity-60 cursor-not-allowed"
                >
                  Send check-in
                </button>
                <button
                  onClick={notImplemented}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground opacity-60 cursor-not-allowed"
                >
                  Draft incident report
                </button>
              </div>
            </CardShell>
          </div>
        </>
      );
    }

    if (page === "salary dispute") {
      return (
        <>
          <SectionTitle title="Salary Dispute" subtitle="Open a dispute and track resolution steps" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">New Dispute</p>
              <div className="space-y-3 mt-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Worker name/passport"
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  placeholder="Amount owed (MYR)"
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <textarea
                  placeholder="Details"
                  className="w-full min-h-[110px] px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={notImplemented}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold opacity-60 cursor-not-allowed"
                >
                  Create Dispute
                </button>
              </div>
            </CardShell>
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Next Steps</p>
              <div className="mt-3 space-y-2">
                {["Collect evidence", "Notify employer", "Mediation", "Escalate"].map((s, i) => (
                  <div key={s} className="flex items-center justify-between rounded-xl bg-muted/40 border border-border/40 px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">{s}</p>
                    <span className="text-xs text-muted-foreground">{i + 1}</span>
                  </div>
                ))}
              </div>
            </CardShell>
            <CardShell>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Templates</p>
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => toast.info("Letter generated")}
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  Generate employer notice
                </button>
                <button
                  onClick={() => toast.info("Evidence list generated")}
                  className="w-full px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  Evidence checklist
                </button>
              </div>
            </CardShell>
          </div>
        </>
      );
    }

    return (
      <>
        <SectionTitle title={title} subtitle="This section is available with starter interactions." />
        <CardShell>
          <p className="text-sm text-muted-foreground">
            This page is wired into the navigation. If you want it tied to real backend data, tell me which API endpoint and fields you want to use.
          </p>
        </CardShell>
      </>
    );
  };

  return <DashboardLayout>{render()}</DashboardLayout>;
}
