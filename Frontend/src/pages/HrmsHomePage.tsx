import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useRole } from "@/contexts/RoleContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BarChart3, Clock, FileText, Shield, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getContractsExpiring, getExpenseClaims, getMyExpenseClaims, getMyOvertimeRequests, getOvertimeRequests } from "@/services/hrmsService";

export default function HrmsHomePage() {
  const { currentRole } = useRole();
  const navigate = useNavigate();

  const isWorker = currentRole === "worker";
  const isManager = currentRole === "admin" || currentRole === "agency" || currentRole === "employer";

  const overtimeQuery = useQuery({
    queryKey: [isWorker ? "hrms_worker_overtime" : "hrms_overtime"],
    queryFn: isWorker ? getMyOvertimeRequests : getOvertimeRequests,
  });

  const expensesQuery = useQuery({
    queryKey: [isWorker ? "hrms_worker_expenses" : "hrms_expenses"],
    queryFn: isWorker ? getMyExpenseClaims : getExpenseClaims,
  });

  const contractsQuery = useQuery({
    queryKey: ["hrms_contracts_expiring", 90],
    queryFn: () => getContractsExpiring(90),
    enabled: isManager,
  });

  const overtime = useMemo(() => (overtimeQuery.data ?? []) as any[], [overtimeQuery.data]);
  const expenses = useMemo(() => (expensesQuery.data ?? []) as any[], [expensesQuery.data]);
  const contracts = useMemo(() => ((contractsQuery.data as any)?.rows ?? []) as any[], [contractsQuery.data]);

  const pendingOvertime = overtime.filter((r) => String(r.status) === "Pending").length;
  const pendingExpenses = expenses.filter((r) => String(r.status) === "Pending").length;

  const approvedOvertimeHours = overtime
    .filter((r) => String(r.status) === "Approved")
    .reduce((acc, r) => acc + Number(r.hours ?? 0), 0);

  const approvedExpenseAmount = expenses
    .filter((r) => String(r.status) === "Approved")
    .reduce((acc, r) => acc + Number(r.amount ?? 0), 0);

  const tiles: Array<{
    title: string;
    desc: string;
    icon: any;
    path: string;
    badge?: string;
    hidden?: boolean;
  }> = [
    {
      title: "Attendance",
      desc: "Clock-in/out, worked hours, late/early flags",
      icon: Clock,
      path: "/hrms/attendance",
      hidden: !isManager,
    },
    {
      title: isWorker ? "My Requests" : "Requests",
      desc: isWorker ? "Submit overtime and expenses" : "Approve overtime and expense claims",
      icon: FileText,
      path: isWorker ? "/hrms/my-requests" : "/hrms/requests",
      badge: String(pendingOvertime + pendingExpenses),
    },
    {
      title: "HRMS Report",
      desc: "Consolidated attendance, overtime and expenses",
      icon: BarChart3,
      path: "/hrms/report",
      hidden: !isManager,
    },
    {
      title: "Payroll",
      desc: "Upload vouchers and track payments",
      icon: Wallet,
      path: "/hrms/payroll",
      hidden: !isManager,
    },
    {
      title: "Contracts",
      desc: "Expiring contracts window",
      icon: Shield,
      path: "/hrms/contracts",
      hidden: !isManager,
      badge: isManager ? String(contracts.length) : undefined,
    },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-1 mb-6">
        <h2 className="text-xl font-bold text-foreground">HRMS</h2>
        <p className="text-sm text-muted-foreground">
          {isWorker ? "Your attendance, requests and documents" : "Operations dashboard for attendance, approvals and reporting"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isWorker ? "Pending (your)" : "Pending approvals"}</CardDescription>
            <CardTitle className="text-2xl">{pendingOvertime + pendingExpenses}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Overtime + expense items waiting for action</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved overtime</CardDescription>
            <CardTitle className="text-2xl">{approvedOvertimeHours.toFixed(1)}h</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Total approved hours in current dataset</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved expenses</CardDescription>
            <CardTitle className="text-2xl">{approvedExpenseAmount.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Total approved amount in current dataset</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contracts expiring (90d)</CardDescription>
            <CardTitle className="text-2xl">{isManager ? String(contracts.length) : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Only visible to employer/agency/admin</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tiles
          .filter((t) => !t.hidden)
          .map((t) => {
            const Icon = t.icon;
            return (
              <Card key={t.path} className="hover:shadow-sm transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {t.title}
                    </CardTitle>
                    <CardDescription>{t.desc}</CardDescription>
                  </div>
                  {t.badge != null && t.badge !== "0" ? <Badge variant="secondary">{t.badge}</Badge> : null}
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline" onClick={() => navigate(t.path)}>
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </DashboardLayout>
  );
}
