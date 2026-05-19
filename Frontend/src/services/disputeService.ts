import { apiClient } from "./apiClient";

export type DisputeStatus = "Pending" | "Accepted" | "Rejected";

export type Dispute = {
  id: number;
  workerId: string;
  employerId: string;
  workerName: string | null;
  workerPassport: string | null;
  employerName: string | null;
  disputeMonth: string;
  expectedAmount: number;
  receivedAmount: number;
  description: string;
  hasProof: boolean;
  status: DisputeStatus;
  employerComment: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  aiSeverity: "critical" | "high" | "medium" | "low" | null;
  aiSeverityScore: number | null;
  aiSeverityReason: string | null;
  aiEscalationRisk: "likely" | "possible" | "unlikely" | null;
  aiScoredAt: string | null;
};

export async function submitDispute(params: {
  disputeMonth: string;
  expectedAmount: number;
  receivedAmount: number;
  description: string;
  proof?: File | null;
}): Promise<Dispute> {
  const form = new FormData();
  form.append("disputeMonth", params.disputeMonth);
  form.append("expectedAmount", String(params.expectedAmount));
  form.append("receivedAmount", String(params.receivedAmount));
  form.append("description", params.description);
  if (params.proof) form.append("proof", params.proof);
  const res = await apiClient.post<Dispute>("/Api/Dispute/Submit", form);
  return res.data;
}

export async function getMyDisputes(): Promise<Dispute[]> {
  const res = await apiClient.get<Dispute[]>("/Api/Dispute/MyDisputes");
  return Array.isArray(res.data) ? res.data : [];
}

export async function getIncomingDisputes(): Promise<Dispute[]> {
  const res = await apiClient.get<Dispute[]>("/Api/Dispute/Incoming");
  return Array.isArray(res.data) ? res.data : [];
}

export async function getAllDisputes(params?: { status?: "All" | DisputeStatus }): Promise<Dispute[]> {
  const res = await apiClient.get<Dispute[]>("/Api/Dispute/All", {
    params: params?.status && params.status !== "All" ? { status: params.status } : undefined,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function reviewDispute(params: {
  id: number;
  status: "Accepted" | "Rejected";
  comment?: string;
}): Promise<Dispute> {
  const res = await apiClient.put<Dispute>("/Api/Dispute/Review", {
    id: params.id,
    status: params.status,
    employerComment: params.comment ?? "",
  });
  return res.data;
}

export function disputeFileUrl(id: number): string {
  // apiClient's baseURL is absolute. Append path directly.
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/Api/Dispute/File/${id}`;
}
