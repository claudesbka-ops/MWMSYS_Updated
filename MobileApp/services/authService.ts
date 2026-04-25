import { useSession } from "@/contexts/SessionContext";
import { resolveApiBaseUrl } from "@/services/apiBase";

export type LoginResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  userName?: string;
};

export function useAuthService() {
  const session = useSession();

  return {
    login: async (params: { userName: string; password: string; passportNo?: string }) => {
      const body = new URLSearchParams();
      body.set("grant_type", "password");
      body.set("username", params.userName);
      body.set("password", params.password);
      if (params.passportNo) body.set("passportNo", params.passportNo);

      const base = resolveApiBaseUrl(session.apiBaseUrl);
      const url = base.replace(/\/+$/, "") + "/Api/token";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      });

      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        const msg = data?.error ?? "Login failed";
        throw { status: res.status, error: msg };
      }

      return data as LoginResponse;
    },
  };
}
