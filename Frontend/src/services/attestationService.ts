import { apiClient } from "./apiClient";

export type AttestationRow = {
  AttestationId: number;
  Worker_Id: string;
  Passport_Number?: string | null;
  DocumentType?: string | null;
  DocumentPath?: string | null;
  Status: string;
  AdminRemarks?: string | null;
  Created_On?: string | null;
  Updated_On?: string | null;
};

export async function getAttestationList(): Promise<AttestationRow[]> {
  const res = await apiClient.get<AttestationRow[]>("/Api/Attestation/List");
  return res.data ?? [];
}

export async function approveAttestation(params: { id: number; remarks?: string }): Promise<void> {
  await apiClient.post("/Api/Attestation/Approve", { id: params.id, remarks: params.remarks ?? "" });
}

export async function rejectAttestation(params: { id: number; remarks?: string }): Promise<void> {
  await apiClient.post("/Api/Attestation/Reject", { id: params.id, remarks: params.remarks ?? "" });
}
