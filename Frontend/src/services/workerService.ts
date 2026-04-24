import { apiClient } from "./apiClient";

export type WorkerListRow = {
  Worker_Id: string;
  Name?: string | null;
  Passport_Number?: string | null;
  Email_Id?: string | null;
  Created_On?: string | null;
  Current_Location?: string | null;
  Company_Name?: string | null;
  Country_Name?: string | null;
  Employer_Id?: string | null;
  Permit_Expire_Date?: string | null;
};

export type WorkerProfileResponse = {
  personal: {
    Worker_Id: string;
    Name?: string | null;
    Passport_Number?: string | null;
    Email_Id?: string | null;
    Nationality?: number | null;
    Gender?: string | null;
    Date_Of_Birth?: string | null;
    Contact_Number?: string | null;
    Contact_Number_Country_Code?: string | null;
    Address?: string | null;
    Created_On?: string | null;
    Employer_Id?: string | null;
  } | null;
  employerInfo: {
    Employer_Name?: string | null;
    Employer_Address?: string | null;
    Telephone_No?: string | null;
    Contract_Expiry_Date?: string | null;
    Contract_issue_Date?: string | null;
    Employment_Description?: string | null;
  } | null;
  permit: {
    Permit_Issue_Date?: string | null;
    Permit_Expire_Date?: string | null;
    Insurance_Policy_Number?: string | null;
    SOSCO_Number?: string | null;
  } | null;
};

export type WorkerDocumentRow = {
  type: "passport" | "permit" | "insurance" | "contract" | "demand_letter";
  name: string;
  filename: string | null;
  url: string;
  hasFile: boolean;
};

export async function getWorkerProfile(workerId: string): Promise<WorkerProfileResponse> {
  const res = await apiClient.get<WorkerProfileResponse>(`/Api/HRMS/Workers/${encodeURIComponent(workerId)}/Profile`);
  return res.data as WorkerProfileResponse;
}

export async function getWorkerDocuments(workerId: string): Promise<{ workerId: string; documents: WorkerDocumentRow[] }> {
  const res = await apiClient.get(`/Api/HRMS/Workers/${encodeURIComponent(workerId)}/Documents`);
  return res.data as { workerId: string; documents: WorkerDocumentRow[] };
}

export async function uploadWorkerDocument(params: { workerId: string; docType: WorkerDocumentRow["type"]; file: File }): Promise<any> {
  const form = new FormData();
  form.append("docType", params.docType);
  form.append("file", params.file);
  const res = await apiClient.post(`/Api/HRMS/Workers/${encodeURIComponent(params.workerId)}/Documents`, form);
  return res.data;
}

export async function deleteWorkerDocument(params: { workerId: string; docType: WorkerDocumentRow["type"] }): Promise<any> {
  const res = await apiClient.delete(`/Api/HRMS/Workers/${encodeURIComponent(params.workerId)}/Documents`, {
    params: { docType: params.docType },
  });
  return res.data;
}

export async function getWorkersList(): Promise<WorkerListRow[]> {
  const res = await apiClient.get<WorkerListRow[]>("/Api/Workers/List");
  return res.data ?? [];
}
