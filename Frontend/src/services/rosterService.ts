import { apiClient } from "./apiClient";

export type ShiftTemplateRow = {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
};

export type RosterRow = {
  id: number;
  workerId: string;
  date: string;
  shiftId: number;
  shiftName: string;
  shiftHours: number;
};

export async function getShiftTemplates(): Promise<ShiftTemplateRow[]> {
  const res = await apiClient.get<ShiftTemplateRow[]>("/Api/HRMS/Roster/Shifts");
  return (res.data ?? []) as ShiftTemplateRow[];
}

export async function createShiftTemplate(params: {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}): Promise<ShiftTemplateRow> {
  const res = await apiClient.post<ShiftTemplateRow>("/Api/HRMS/Roster/Shifts", params);
  return res.data as ShiftTemplateRow;
}

export async function upsertRosterAssignment(params: {
  workerId: string;
  date: string;
  shiftId: number;
}): Promise<{ ok: true }> {
  const res = await apiClient.post<{ ok: true }>("/Api/HRMS/Roster/Assign", params);
  return res.data as { ok: true };
}

export async function getRoster(params: { from: string; to: string }): Promise<{ rows: RosterRow[] }> {
  const res = await apiClient.get<{ rows: RosterRow[] }>("/Api/HRMS/Roster", { params });
  return res.data as { rows: RosterRow[] };
}
