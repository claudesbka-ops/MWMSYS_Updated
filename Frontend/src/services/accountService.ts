import { apiClient } from "./apiClient";

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
};

export async function getAccountProfile(): Promise<AccountProfile> {
  const res = await apiClient.get<AccountProfile>("/Api/Account/Profile");
  return res.data;
}
