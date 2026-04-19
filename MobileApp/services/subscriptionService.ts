import { useApiClient } from "@/services/apiClient";

export type SubscriptionMe = {
  planType?: string;
  status?: string;
  endDate?: string | null;
};

export function useSubscriptionService() {
  const api = useApiClient();

  return {
    me: () => api.get<SubscriptionMe>("/Api/subscription/me"),
  };
}
