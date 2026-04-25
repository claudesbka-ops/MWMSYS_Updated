import React from "react";
import { Redirect } from "expo-router";
import { useOnboarding } from "@/contexts/OnboardingContext";

export default function OnboardingCompanyScreen() {
  const draft = useOnboarding().draft;
  const target = draft ? `/onboarding/${draft.role}` : "/onboarding/start";
  return <Redirect href={target as any} />;
}
