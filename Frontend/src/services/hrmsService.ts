import { apiClient } from "./apiClient";

export type AttendanceRow = {
  id: number;
  workerId: string;
  checkIn: string;
  checkOut: string | null;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
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
