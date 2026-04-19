import React, { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type OnboardingRole = "employer" | "agency" | "worker";

export type OnboardingDraft = {
  role: OnboardingRole;
  userId: string;
  emailId: string;
  password: string;

  passportNo: string;

  organizationName: string;
  address: string;
  phone: string;
  ssmNumber: string;

  contactPersonName: string;
  contactPersonPosition: string;
  contactPersonIc: string;
  contactPersonPhone: string;
};

type OnboardingState = {
  draft: OnboardingDraft | null;
  start: (role: OnboardingRole) => void;
  patch: (v: Partial<OnboardingDraft>) => void;
  clear: () => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

function createEmptyDraft(role: OnboardingRole): OnboardingDraft {
  return {
    role,
    userId: "",
    emailId: "",
    password: "",

    passportNo: "",
    organizationName: "",
    address: "",
    phone: "",
    ssmNumber: "",
    contactPersonName: "",
    contactPersonPosition: "",
    contactPersonIc: "",
    contactPersonPhone: "",
  };
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);

  const value = useMemo<OnboardingState>(
    () => ({
      draft,
      start: (role) => setDraft(createEmptyDraft(role)),
      patch: (v) => setDraft((d) => (d ? ({ ...d, ...v } as OnboardingDraft) : d)),
      clear: () => setDraft(null),
    }),
    [draft]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
