import { apiClient } from "./apiClient";

export type GlobalSearchWorker = {
  Worker_Id: string;
  Name?: string | null;
  Passport_Number?: string | null;
  Created_On?: string | null;
};

export type GlobalSearchEmployer = {
  User_Id: string;
  Employer_Name: string;
  Employer_ContactPerson?: string | null;
  Employer_EmailID?: string | null;
  Created_On?: string | null;
};

export type GlobalSearchResponse = {
  workers: GlobalSearchWorker[];
  employers: GlobalSearchEmployer[];
};

export async function globalSearch(q: string): Promise<GlobalSearchResponse> {
  const query = q.trim();
  if (!query) return { workers: [], employers: [] };
  const res = await apiClient.get<GlobalSearchResponse>("/api/search/global", {
    params: { q: query },
  });
  return res.data ?? { workers: [], employers: [] };
}
