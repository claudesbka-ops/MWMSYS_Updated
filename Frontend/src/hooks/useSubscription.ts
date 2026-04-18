import { useQuery } from "@tanstack/react-query";
import { useRole } from "@/contexts/RoleContext";
import { getSubscriptionMe } from "@/services/subscriptionService";

export function useSubscription() {
  const { currentRole } = useRole();

  const query = useQuery({
    queryKey: ["subscription_me"],
    queryFn: getSubscriptionMe,
    enabled: currentRole === "agency" || currentRole === "employer",
    retry: false,
    staleTime: 30_000,
  });

  const planType = query.data?.planType ?? "Free";
  const status = query.data?.status ?? "Inactive";

  const normalizedPlan = planType.toString().trim().toLowerCase();
  const hasActivePlan = (status ?? "").toString().trim().toLowerCase() === "active" && normalizedPlan !== "free";

  return {
    ...query,
    planType,
    status,
    hasActivePlan,
    isPaywalledRole: currentRole === "agency" || currentRole === "employer",
  };
}
