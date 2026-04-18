import { apiClient } from "./apiClient";

export type SubscriptionMeResponse = {
  planType: string;
  status: string;
  endDate?: string | null;
};

export async function getSubscriptionMe(): Promise<SubscriptionMeResponse> {
  const res = await apiClient.get<SubscriptionMeResponse>("/Api/subscription/me");
  return res.data as SubscriptionMeResponse;
}
