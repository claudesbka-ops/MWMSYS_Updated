import React from "react";
import { Redirect } from "expo-router";
import { useOnboarding } from "@/contexts/OnboardingContext";

// Legacy generic step. The active flow uses role-specific screens
// (worker.tsx / employer.tsx / agency.tsx).
export default function OnboardingAccountScreen() {
  const draft = useOnboarding().draft;
  const target = draft ? `/onboarding/${draft.role}` : "/onboarding/start";
  return <Redirect href={target as any} />;
}
