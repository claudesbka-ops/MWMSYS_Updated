import { useQuery } from "@tanstack/react-query";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext"; // Added import statement
import { getSubscriptionMe } from "@/services/subscriptionService";

export function useSubscription() {
  const { currentRole } = useRole();
  const { user } = useAuth(); // Added line to get user from AuthContext

  const isPaywalledRole =
    currentRole === "agency" || currentRole === "employer" || currentRole === "labour";

  // QA bypass: @test.com accounts always have full access for testing
  const isTestAccount = user?.email?.toLowerCase().endsWith("@test.com") ?? false;

  const query = useQuery({
    queryKey: ["subscription_me"],
    queryFn: getSubscriptionMe,
    enabled: isPaywalledRole && !isTestAccount,
    retry: false,
    staleTime: 30_000,
  });

  const planType = isTestAccount ? "Enterprise" : (query.data?.planType ?? "Free");
  const status = isTestAccount ? "Active" : (query.data?.status ?? "Inactive");

  const normalizedPlan = planType.toString().trim().toLowerCase();
  const hasActivePlan = isTestAccount || (status ?? "").toString().trim().toLowerCase() === "active" && normalizedPlan !== "free";

  return {
    ...query,
    planType,
    status,
    hasActivePlan,
    isPaywalledRole: currentRole === "agency" || currentRole === "employer",
  };
}
