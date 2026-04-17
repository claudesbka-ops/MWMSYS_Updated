import { apiClient } from "./apiClient";

export type EntryReportRow = {
  Worker_Id: string;
  Name?: string | null;
  Passport_Number?: string | null;
  Created_On?: string | null;
  Current_Location?: string | null;
  Company_Name?: string | null;
};

export async function getEntryReport(params: { from?: string; to?: string }): Promise<EntryReportRow[]> {
  const res = await apiClient.get<EntryReportRow[]>("/api/reports/entry", {
    params: {
      from: params.from,
      to: params.to,
    },
  });
  return res.data ?? [];
}

export type VisaExpireRow = {
  Worker_Id: string;
  Name?: string | null;
  Passport_Number?: string | null;
  Permit_Expire_Date?: string | null;
  Created_On?: string | null;
  Company_Name?: string | null;
  StatusLabel?: string | null;
};

export type VisaExpireResponse = {
  windowDays: number;
  rows: VisaExpireRow[];
};

export async function getVisaExpireReport(params: { days?: number }): Promise<VisaExpireResponse> {
  const res = await apiClient.get<VisaExpireResponse>("/api/reports/visa-expire", {
    params: {
      days: params.days,
    },
  });
  return res.data ?? { windowDays: params.days ?? 90, rows: [] };
}

export type InsuranceExpireRow = {
  Worker_Id: string;
  Name?: string | null;
  Passport_Number?: string | null;
  Contract_Expiry_Date?: string | null;
  Created_On?: string | null;
  Company_Name?: string | null;
  StatusLabel?: string | null;
};

export type InsuranceExpireResponse = {
  windowDays: number;
  rows: InsuranceExpireRow[];
};

export async function getInsuranceExpireReport(params: { days?: number }): Promise<InsuranceExpireResponse> {
  const res = await apiClient.get<InsuranceExpireResponse>("/api/reports/insurance-expire", {
    params: {
      days: params.days,
    },
  });
  return res.data ?? { windowDays: params.days ?? 90, rows: [] };
}
