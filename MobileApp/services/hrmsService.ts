import { useApiClient } from "@/services/apiClient";

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
  status: string;
};

export type MeResponse = {
  claims: Record<string, unknown>;
  roleId: number | null;
  appRole?: string;
  userId?: number;
  userKey?: string;
  workerId?: string | null;
  passportNo?: string | null;
};

export function useHrmsService() {
  const api = useApiClient();

  return {
    me: () => api.get<MeResponse>("/Api/me"),
    getMyAttendance: () => api.get<AttendanceRow[]>("/Api/HRMS/Attendance/me"),
    clockIn: (params?: { lat?: number | null; lng?: number | null; photoUrl?: string | null }) =>
      api.post<AttendanceRow>("/Api/HRMS/Attendance/ClockIn", {
        lat: params?.lat ?? null,
        lng: params?.lng ?? null,
        photoUrl: params?.photoUrl ?? null,
      }),
    clockOut: () => api.post<AttendanceRow>("/Api/HRMS/Attendance/ClockOut", {}),

    getMyLeaves: () => api.get<LeaveRow[]>("/Api/HRMS/Leave"),
    applyLeave: (params: { leaveType: string; startDate: string; endDate: string }) =>
      api.post<LeaveRow>("/Api/HRMS/Leave/Apply", params),
  };
}
