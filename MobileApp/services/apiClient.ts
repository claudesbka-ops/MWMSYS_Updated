import { useSession } from "@/contexts/SessionContext";

const PROD_API_BASE_URL = "http://173.233.72.39:3000";

export type ApiError = {
  status?: number;
  code?: string;
  error?: string;
};

export function useApiClient() {
  const { token } = useSession();

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = PROD_API_BASE_URL.replace(/\/+$/, "") + path;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init?.headers as any),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (init?.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      ...init,
      headers,
    });

    const text = await res.text();
    const data = text ? (() => {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    })() : null;

    if (!res.ok) {
      const err: ApiError = typeof data === "object" && data ? (data as any) : { error: String(data ?? res.statusText) };
      err.status = res.status;
      throw err;
    }

    return data as T;
  }

  return {
    get: <T,>(path: string) => request<T>(path, { method: "GET" }),
    post: <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : "{}" }),
    put: <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : "{}" }),
    delete: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}
