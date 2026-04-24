import { apiClient } from "./apiClient";

export type EmployerOption = {
  id: string;
  companyName: string;
  email: string;
};

export type EmployerSearchResult = EmployerOption & {
  contactPerson?: string;
};

export type WorkerSearchResult = {
  id: string;
  name: string;
  passport: string;
  email: string;
  currentEmployerId: string | null;
};

export async function listPublicEmployers(q?: string): Promise<EmployerOption[]> {
  const res = await apiClient.get<EmployerOption[]>("/Api/Employers/Public", {
    params: q ? { q } : undefined,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function searchEmployers(q: string): Promise<EmployerSearchResult[]> {
  if (!q.trim()) return [];
  const res = await apiClient.get<EmployerSearchResult[]>("/Api/Employers/Search", { params: { q } });
  return Array.isArray(res.data) ? res.data : [];
}

export async function agencyLinkEmployer(employerId: string): Promise<{ ok: boolean; id: number; alreadyLinked: boolean }> {
  const res = await apiClient.post("/Api/Agency/LinkEmployer", { employerId });
  return res.data as { ok: boolean; id: number; alreadyLinked: boolean };
}

export async function listAgencyEmployers(): Promise<Array<{ id: number; employerId: string; linkedAt: string; employer: { companyName: string; email: string } | null }>> {
  const res = await apiClient.get("/Api/Agency/Employers");
  return Array.isArray(res.data) ? (res.data as any) : [];
}

export async function searchWorkers(q: string): Promise<WorkerSearchResult[]> {
  if (!q.trim()) return [];
  const res = await apiClient.get<WorkerSearchResult[]>("/Api/Workers/Search", { params: { q } });
  return Array.isArray(res.data) ? res.data : [];
}

export async function employerLinkWorker(workerId: string): Promise<{ ok: boolean; id: number }> {
  const res = await apiClient.post("/Api/Employer/LinkWorker", { workerId });
  return res.data as { ok: boolean; id: number };
}
