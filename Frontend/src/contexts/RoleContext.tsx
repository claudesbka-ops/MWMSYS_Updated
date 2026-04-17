import { createContext, useContext, useState, ReactNode } from "react";
import { getAccessToken } from "@/services/apiClient";

export type UserRole =
  | "admin"
  | "agency"
  | "employer"
  | "worker"
  | "embassy_source"
  | "embassy_destination"
  | "labour";

const ROLE_STORAGE_KEY = "mwmsys_role";
const LOGGED_IN_STORAGE_KEY = "mwmsys_logged_in";

function decodeJwtPayload(token: string): unknown {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const json = atob(padded);
  return JSON.parse(json);
}

function inferRoleFromToken(): UserRole | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = decodeJwtPayload(token) as { appRole?: string } | null;
    if (!payload?.appRole) return null;
    if (
      payload.appRole === "admin" ||
      payload.appRole === "worker" ||
      payload.appRole === "employer" ||
      payload.appRole === "agency" ||
      payload.appRole === "embassy_source" ||
      payload.appRole === "embassy_destination" ||
      payload.appRole === "labour"
    ) {
      return payload.appRole as UserRole;
    }
    return null;
  } catch {
    return null;
  }
}

interface RoleContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  roleName: string;
}

const roleNames: Record<UserRole, string> = {
  admin: "Administrator",
  agency: "Agency Portal",
  employer: "Employer",
  worker: "Worker",
  embassy_source: "Embassy (Source)",
  embassy_destination: "Embassy (Destination)",
  labour: "Labour Department",
};

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    const loggedIn = localStorage.getItem(LOGGED_IN_STORAGE_KEY) === "true";
    if (!loggedIn) return "admin";

    const tokenRole = inferRoleFromToken();
    if (tokenRole) return tokenRole;

    const stored = localStorage.getItem(ROLE_STORAGE_KEY) as UserRole | null;
    return stored ?? "admin";
  });

  const setCurrentRole = (role: UserRole) => {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
    setCurrentRoleState(role);
  };

  return (
    <RoleContext.Provider value={{ currentRole, setCurrentRole, roleName: roleNames[currentRole] }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
