import { useApiClient } from "@/services/apiClient";

export type DashboardMeResponse = {
  roleId: number;
  appRole?: string;
  cards: Record<string, number>;
};

export function useDashboardService() {
  const api = useApiClient();

  return {
    getMe: () => api.get<DashboardMeResponse>("/Api/dashboard/me"),
  };
}
