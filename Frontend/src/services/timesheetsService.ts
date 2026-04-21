import { apiClient } from "./apiClient";

export type TimesheetSummaryRow = {
  workerId: string;
  name: string | null;
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
  days: number;
};

export type TimesheetDayRow = {
  workerId: string;
  name: string | null;
  day: string;
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
};

export async function getTimesheets(params: { from: string; to: string }): Promise<{ rows: TimesheetSummaryRow[]; days: TimesheetDayRow[] }> {
  const res = await apiClient.get<{ rows: TimesheetSummaryRow[]; days: TimesheetDayRow[] }>("/Api/HRMS/Timesheets", { params });
  return res.data as { rows: TimesheetSummaryRow[]; days: TimesheetDayRow[] };
}
