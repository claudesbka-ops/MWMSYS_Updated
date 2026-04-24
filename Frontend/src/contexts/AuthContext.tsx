import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiClient, getAccessToken, AUTH_USERNAME_STORAGE_KEY } from "@/services/apiClient";

export type AuthUser = {
  id: string | null;
  name: string;
  email: string | null;
  role: string | null;
  companyName: string | null;
};

type MeResponse = {
  claims?: {
    userId?: number | string;
    userKey?: string;
    emailId?: string;
    userName?: string;
    appRole?: string;
    countryCode?: number;
  } | null;
  userId?: number | string;
  userKey?: string;
  appRole?: string;
  workerId?: string | null;
  passportNo?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUserName(): string | null {
  const v = localStorage.getItem(AUTH_USERNAME_STORAGE_KEY);
  return v && v.trim() ? v : null;
}

async function fetchMe(): Promise<AuthUser | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await apiClient.get<MeResponse>("/Api/me");
    const data = res.data ?? {};
    const claims = data.claims ?? {};

    const id = (claims.userKey ?? data.userKey ?? (claims.userId != null ? String(claims.userId) : null)) as string | null;
    const name = (claims.userName ?? readStoredUserName() ?? id ?? "") as string;
    const email = (claims.emailId ?? null) as string | null;
    const role = (claims.appRole ?? data.appRole ?? null) as string | null;

    let companyName: string | null = null;
    if (role === "employer" && id) {
      try {
        const empRes = await apiClient.get<Array<{ User_Id: string; Employer_Name: string | null }>>("/Api/Employers/List");
        const rows = Array.isArray(empRes.data) ? empRes.data : [];
        const mine = rows.find((r) => (r.User_Id ?? "").toString() === id);
        companyName = (mine?.Employer_Name ?? null) as string | null;
      } catch {
        // best-effort; leave null
      }
    }

    return {
      id: id ? String(id) : null,
      name: (name || "").trim() || (id ? String(id) : "User"),
      email,
      role,
      companyName,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!getAccessToken());

  const refresh = async () => {
    setLoading(true);
    const next = await fetchMe();
    setUser(next);
    setLoading(false);
  };

  const clear = () => {
    setUser(null);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getAccessToken()) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const next = await fetchMe();
      if (!cancelled) {
        setUser(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, clear }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
