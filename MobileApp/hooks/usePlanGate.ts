import { useEffect, useMemo, useState } from "react";

import { useSession } from "@/contexts/SessionContext";
import { useSubscriptionService } from "@/services/subscriptionService";

export function usePlanGate() {
  const session = useSession();
  const sub = useSubscriptionService();

  const appRole = (session.claims?.appRole ?? "").toString();
  const needsPlan = appRole === "employer" || appRole === "agency";

  const [loading, setLoading] = useState(false);
  const [planType, setPlanType] = useState<string>("Free");

  const refresh = async () => {
    if (!needsPlan) {
      setPlanType("Free");
      return;
    }

    setLoading(true);
    try {
      const me = await sub.me();
      setPlanType((me?.planType ?? "Free").toString());
    } catch {
      setPlanType("Free");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [needsPlan]);

  const hasPlan = useMemo(() => {
    if (!needsPlan) return true;
    const p = (planType ?? "").toString().toLowerCase();
    return !!p && p !== "free";
  }, [needsPlan, planType]);

  return { needsPlan, hasPlan, planType, loading, refresh };
}
