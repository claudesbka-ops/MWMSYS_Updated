import axios from "axios";
import { toast } from "sonner";

const API_BASE_URL = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL as
  | string
  | undefined);

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not set");
}

export const AUTH_TOKEN_STORAGE_KEY = "access_token";
export const AUTH_USERNAME_STORAGE_KEY = "userName";

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    const anyHeaders = config.headers as any;
    if (anyHeaders && typeof anyHeaders.set === "function") {
      anyHeaders.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers = {
        ...(config.headers as any),
        Authorization: `Bearer ${token}`,
      } as any;
    }
  }
  return config;
});

// Tracks whether we've already started the redirect-to-login flow so a burst
// of in-flight 401s doesn't fire dozens of toasts or fight over the URL.
let sessionExpiredHandled = false;

function handleSessionExpired(): void {
  if (sessionExpiredHandled) return;
  sessionExpiredHandled = true;

  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem("mwmsys_logged_in");
  } catch {
    // ignore storage failures
  }

  toast.error("Session expired. Please login again.");

  // Avoid redirect loops if we're already on a login page.
  const path = window.location.pathname || "";
  if (!path.startsWith("/login") && path !== "/") {
    setTimeout(() => {
      window.location.assign("/login");
    }, 250);
  }
}

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status as number | undefined;
    const code = err?.response?.data?.code as string | undefined;
    const message = err?.response?.data?.error as string | undefined;

    if (status === 401) {
      handleSessionExpired();
    } else if (status === 503 && code === "DB_CONNECTION_ERROR") {
      toast.error("Database Connection Error", { description: "Backend cannot reach the database." });
    } else if (!err?.response) {
      toast.error("Database Connection Error", { description: "Cannot reach the server." });
    } else if (typeof message === "string" && /database connection error/i.test(message)) {
      toast.error("Database Connection Error", { description: "Backend cannot reach the database." });
    }

    return Promise.reject(err);
  }
);
