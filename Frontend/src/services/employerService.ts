import { apiClient } from "./apiClient";

export type EmployerListRow = {
  User_Id: string;
  Employer_Name: string;
  Employer_Address?: string | null;
  Employer_ContactPerson?: string | null;
  Employer_Position?: string | null;
  Employer_EmailID?: string | null;
  Employer_OfficeNumber?: string | null;
  Employer_PIC_MobileNumber?: string | null;
  Created_On?: string | null;
};

export async function getEmployersList(): Promise<EmployerListRow[]> {
  const res = await apiClient.get<EmployerListRow[]>("/Api/Employers/List");
  return res.data ?? [];
}

export async function getEmployerIncidentCounts(): Promise<Record<string, number>> {
  const res = await apiClient.get<Record<string, number>>("/Api/Employer/IncidentCounts");
  return res.data ?? {};
}
