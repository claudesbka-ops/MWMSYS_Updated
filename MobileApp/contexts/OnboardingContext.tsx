import React, { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type OnboardingRole = "employer" | "agency" | "worker";

export type OnboardingDraft = {
  role: OnboardingRole;

  // Shared
  userId: string;
  emailId: string;
  password: string;

  // Worker (mirrors WorkerSignupForm)
  fullName: string;
  passportNo: string;
  employerId: string;

  // Employer (mirrors EmployerSignup)
  employerName: string;
  ssmRocRobNo: string;
  sector: string;
  telephoneNo: string;
  address: string;
  contactPerson: string;
  contactPersonIcNo: string;
  hpNumber: string;
  position: string;
  phoneNo: string;

  // Agency (mirrors AgencySignup)
  organization: string;
  icOrPassport: string;
  dateOfBirth: string;
  department: string;
  country: string;
  contactNo: string;
  status: string;
  title: string;
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

    fullName: "",
    passportNo: "",
    employerId: "",

    employerName: "",
    ssmRocRobNo: "",
    sector: "",
    telephoneNo: "",
    address: "",
    contactPerson: "",
    contactPersonIcNo: "",
    hpNumber: "",
    position: "",
    phoneNo: "",

    organization: "",
    icOrPassport: "",
    dateOfBirth: "",
    department: "",
    country: "",
    contactNo: "",
    status: "",
    title: "",
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
