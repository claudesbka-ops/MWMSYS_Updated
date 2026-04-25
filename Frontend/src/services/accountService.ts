import { apiClient } from "./apiClient";

export type WorkerProfileFields = {
  name: string;
  contactNumber: string;
  address: string;
  passportNumber: string;
  email: string;
  photo: string | null;
};

export type EmployerProfileFields = {
  companyName: string;
  address: string;
  companyPhone: string;
  contactPerson: string;
  contactPersonPhone: string;
  position: string;
  email: string;
  ssmNumber: string;
};

export type AgencyProfileFields = {
  agentName: string;
  organizationName: string;
  contactNumber: string;
  icPassport: string;
  email: string;
};

export type RoleProfile =
  | { kind: "worker"; fields: WorkerProfileFields; complete: boolean }
  | { kind: "employer"; fields: EmployerProfileFields; complete: boolean }
  | { kind: "agency"; fields: AgencyProfileFields; complete: boolean };

export type AccountProfile = {
  userId: string | null;
  userName: string | null;
  emailId: string | null;
  role: string | null;
  roleId: number | null;
  subscription: {
    planType: string;
    status: string;
    endDate: string | null;
  };
  profile: RoleProfile | null;
};

export async function getAccountProfile(): Promise<AccountProfile> {
  const res = await apiClient.get<AccountProfile>("/Api/Account/Profile");
  return res.data;
}

export async function updateAccountProfile(
  patch: Partial<WorkerProfileFields & EmployerProfileFields & AgencyProfileFields>
): Promise<{ ok: boolean; profile: RoleProfile | null }> {
  const res = await apiClient.put<{ ok: boolean; profile: RoleProfile | null }>(
    "/Api/Account/Profile",
    patch
  );
  return res.data;
}

export async function uploadAccountPhoto(file: File): Promise<{ ok: boolean; photo: string }> {
  const form = new FormData();
  form.append("photo", file);
  const res = await apiClient.post<{ ok: boolean; photo: string }>("/Api/Account/Photo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
