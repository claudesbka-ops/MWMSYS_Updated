import { apiClient } from "./apiClient";

export type AttendanceRow = {
  id: number;
  workerId: string;
  checkIn: string;
  checkOut: string | null;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  workedHours?: number;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
};

export type LeaveRow = {
  id: number;
  workerId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: "Pending" | "Approved" | "Rejected" | string;
};

export type PayrollRow = {
  id: number;
  workerId: string;
  month: number;
  year: number;
  amount: number;
  voucherUrl: string | null;
  isPaid: boolean;
};

export type OvertimeRequestRow = {
  id: number;
  workerId: string;
  workerName?: string | null;
  workDate: string;
  hours: number;
  reason: string | null;
  status: "Pending" | "Approved" | "Rejected" | string;
  createdOn: string;
  decisionBy: string | null;
  decisionOn: string | null;
};

export type ExpenseAttachment = {
  id: number;
  claimId: number;
  url: string;
  originalName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  createdOn?: string | null;
};

export type ExpenseClaimRow = {
  id: number;
  workerId: string;
  workerName?: string | null;
  claimDate: string;
  amount: number;
  category: string | null;
  description: string | null;
  status: "Pending" | "Approved" | "Rejected" | string;
  createdOn: string;
  decisionBy: string | null;
  decisionOn: string | null;
  attachments?: ExpenseAttachment[];
};

export async function getAttendance(): Promise<AttendanceRow[]> {
  const res = await apiClient.get<AttendanceRow[]>("/Api/HRMS/Attendance");
  return (res.data ?? []) as AttendanceRow[];
}

export async function workerClockIn(params: { lat?: number; lng?: number; photoUrl?: string }): Promise<AttendanceRow> {
  const res = await apiClient.post<AttendanceRow>("/Api/HRMS/Attendance/ClockIn", params);
  return res.data;
}

export async function workerClockOut(): Promise<AttendanceRow> {
  const res = await apiClient.post<AttendanceRow>("/Api/HRMS/Attendance/ClockOut", {});
  return res.data;
}

export async function getLeaves(): Promise<LeaveRow[]> {
  const res = await apiClient.get<LeaveRow[]>("/Api/HRMS/Leave");
  return (res.data ?? []) as LeaveRow[];
}

export async function applyLeave(params: { leaveType: string; startDate: string; endDate: string }): Promise<LeaveRow> {
  const res = await apiClient.post<LeaveRow>("/Api/HRMS/Leave/Apply", params);
  return res.data;
}

export async function decideLeave(params: { id: number; status: "Approved" | "Rejected" }): Promise<LeaveRow> {
  const res = await apiClient.post<LeaveRow>("/Api/HRMS/Leave/Decision", params);
  return res.data;
}

export async function getPayroll(): Promise<PayrollRow[]> {
  const res = await apiClient.get<PayrollRow[]>("/Api/HRMS/Payroll");
  return (res.data ?? []) as PayrollRow[];
}

export async function uploadPayroll(params: {
  workerId: string;
  month: number;
  year: number;
  amount?: number;
  voucherUrl?: string;
  isPaid?: boolean;
}): Promise<PayrollRow> {
  const res = await apiClient.post<PayrollRow>("/Api/HRMS/Payroll/Upload", params);
  return res.data;
}

export async function getOvertimeRequests(): Promise<OvertimeRequestRow[]> {
  const res = await apiClient.get<OvertimeRequestRow[]>("/Api/HRMS/Overtime");
  return (res.data ?? []) as OvertimeRequestRow[];
}

export async function getMyOvertimeRequests(): Promise<OvertimeRequestRow[]> {
  const res = await apiClient.get<OvertimeRequestRow[]>("/Api/HRMS/Overtime/me");
  return (res.data ?? []) as OvertimeRequestRow[];
}

export async function submitOvertimeRequest(params: { workDate: string; hours: number; reason?: string }): Promise<any> {
  const res = await apiClient.post("/Api/HRMS/Overtime/Request", params);
  return res.data;
}

export async function decideOvertimeRequest(params: { id: number; status: "Approved" | "Rejected" }): Promise<any> {
  const res = await apiClient.post("/Api/HRMS/Overtime/Decision", params);
  return res.data;
}

export async function getExpenseClaims(): Promise<ExpenseClaimRow[]> {
  const res = await apiClient.get<ExpenseClaimRow[]>("/Api/HRMS/Expenses");
  return (res.data ?? []) as ExpenseClaimRow[];
}

export async function getMyExpenseClaims(): Promise<ExpenseClaimRow[]> {
  const res = await apiClient.get<ExpenseClaimRow[]>("/Api/HRMS/Expenses/me");
  return (res.data ?? []) as ExpenseClaimRow[];
}

export async function submitExpenseClaim(params: { claimDate: string; amount: number; category?: string; description?: string }): Promise<any> {
  const res = await apiClient.post("/Api/HRMS/Expenses/Claim", params);
  return res.data;
}

export async function uploadExpenseAttachments(params: { claimId: number; files: File[] }): Promise<any> {
  const form = new FormData();
  for (const f of params.files ?? []) {
    form.append("files", f);
  }
  const res = await apiClient.post(`/Api/HRMS/Expenses/${encodeURIComponent(String(params.claimId))}/Attachments`, form);
  return res.data;
}

export async function decideExpenseClaim(params: { id: number; status: "Approved" | "Rejected" }): Promise<any> {
  const res = await apiClient.post("/Api/HRMS/Expenses/Decision", params);
  return res.data;
}

export type HrmsSummaryRow = {
  workerId: string;
  name: string | null;
  daysPresent: number;
  workedHours: number;
  lateCount: number;
  earlyLeaveCount: number;
  overtimeRequestedHours: number;
  overtimeApprovedHours: number;
  expenseClaimed: number;
  expenseApproved: number;
};

export type HrmsSummaryResponse = {
  from: string;
  to: string;
  rows: HrmsSummaryRow[];
};

export async function getHrmsSummary(params: { from: string; to: string }): Promise<HrmsSummaryResponse> {
  const res = await apiClient.get<HrmsSummaryResponse>("/Api/HRMS/Reports/Summary", { params });
  return res.data as HrmsSummaryResponse;
}

export type ContractsExpiringResponse = {
  windowDays: number;
  rows: Array<{
    Worker_Id: string;
    Employer_Name: string | null;
    Contract_Expiry_Date: string | null;
    Contract_issue_Date: string | null;
  }>;
};

export async function getContractsExpiring(days?: number): Promise<ContractsExpiringResponse> {
  const res = await apiClient.get<ContractsExpiringResponse>("/Api/HRMS/Contracts/Expiring", {
    params: days != null ? { days } : undefined,
  });
  return res.data as ContractsExpiringResponse;
}

export type OvertimeSummaryRow = {
  workerId: string;
  name: string | null;
  regularHours: number;
  overtimeHours: number;
  weekendHours: number;
  totalHours: number;
};

export async function getOvertimeSummary(params?: { month?: string }): Promise<OvertimeSummaryRow[]> {
  const res = await apiClient.get<OvertimeSummaryRow[]>("/Api/HRMS/Shifts/OvertimeSummary", {
    params: params?.month ? { month: params.month } : undefined,
  });
  return (res.data ?? []) as OvertimeSummaryRow[];
}
