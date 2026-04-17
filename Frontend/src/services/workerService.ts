import { apiClient } from "./apiClient";

export type WorkerListRow = {
  Worker_Id: string;
  Passport_Number?: string | null;
  Email_Id?: string | null;
  Created_On?: string | null;
  Current_Location?: string | null;
  Company_Name?: string | null;
  Country_Name?: string | null;
};

export async function getWorkersList(): Promise<WorkerListRow[]> {
  const res = await apiClient.get<WorkerListRow[]>("/Api/Workers/List");
  return res.data ?? [];
}
