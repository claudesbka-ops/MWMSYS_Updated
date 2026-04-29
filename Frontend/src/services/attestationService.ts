import { apiClient } from "./apiClient";

export type AttestationRow = {
  AttestationId: number;
  Worker_Id: string;
  Passport_Number?: string | null;
  DocumentType?: string | null;
  DocumentPath?: string | null;
  hasDocument?: boolean;
  Status: string;
  AdminRemarks?: string | null;
  Created_On?: string | null;
  Updated_On?: string | null;
  Extracted_Name?: string | null;
  Extracted_Document_Number?: string | null;
  Extracted_Expiry_Date?: string | null;
  Extracted_Nationality?: string | null;
  Ai_Confidence?: "high" | "medium" | "low" | string | null;
};

export type AttestationSubmitResponse = {
  message: string;
  attestationId: number | null;
  documentPath: string;
  extracted: {
    name: string | null;
    documentNumber: string | null;
    expiryDate: string | null;
    nationality: string | null;
    dateOfBirth: string | null;
    confidence: "high" | "medium" | "low";
  };
  autoFilled: boolean;
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

export async function submitAttestation(params: {
  file: File;
  documentType: string;
  passportNumber?: string;
}): Promise<AttestationSubmitResponse> {
  const form = new FormData();
  form.append("file", params.file);
  form.append("documentType", params.documentType);
  if (params.passportNumber) form.append("passportNumber", params.passportNumber);
  const res = await apiClient.post<AttestationSubmitResponse>("/Api/Attestation/Submit", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
