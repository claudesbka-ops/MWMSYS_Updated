import { apiClient, AUTH_TOKEN_STORAGE_KEY, AUTH_USERNAME_STORAGE_KEY } from "./apiClient";

export interface LoginResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  userName?: string;
  [key: string]: unknown;
}

export const TEMP_TOKEN_KEY = "mwmsys_2fa_temp_token";

export class EmailNotVerifiedError extends Error {
  userId: string;
  emailId?: string;
  constructor(userId: string, emailId?: string) {
    super("Email not verified");
    this.name = "EmailNotVerifiedError";
    this.userId = userId;
    this.emailId = emailId;
  }
}

export class TwoFARequiredError extends Error {
  tempToken: string;
  constructor(tempToken: string) {
    super("2FA required");
    this.name = "TwoFARequiredError";
    this.tempToken = tempToken;
  }
}

export async function login(params: {
  userName: string;
  password: string;
  passportNo?: string;
}): Promise<LoginResponse> {
  const body = new URLSearchParams();
  body.set("grant_type", "password");
  body.set("username", params.userName);
  body.set("password", params.password);
  if (params.passportNo) {
    body.set("passportNo", params.passportNo);
  }

  try {
    const res = await apiClient.post<any>("/Api/token", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // 2FA challenge — backend returns requires2FA:true + tempToken instead of access_token
    if (res.data?.requires2FA === true && res.data?.tempToken) {
      sessionStorage.setItem(TEMP_TOKEN_KEY, res.data.tempToken);
      throw new TwoFARequiredError(res.data.tempToken);
    }

    const { access_token, userName } = res.data;
    if (access_token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, access_token);
    }
    if (userName) {
      localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, userName);
    } else {
      localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, params.userName);
    }

    return res.data;
  } catch (err: any) {
    if (err instanceof TwoFARequiredError) throw err;
    const status = Number(err?.response?.status ?? 0);
    const data = err?.response?.data ?? {};
    if (status === 403 && data?.error === "Email not verified" && data?.userId) {
      throw new EmailNotVerifiedError(String(data.userId), data?.emailId ? String(data.emailId) : undefined);
    }
    throw err;
  }
}

export async function verify2FA(otp: string): Promise<LoginResponse> {
  const tempToken = sessionStorage.getItem(TEMP_TOKEN_KEY) ?? "";
  if (!tempToken) throw new Error("No pending 2FA session");

  const res = await apiClient.post<LoginResponse>("/Api/Auth/Verify2FA", { otp, tempToken });
  sessionStorage.removeItem(TEMP_TOKEN_KEY);

  const { access_token, userName } = res.data;
  if (access_token) localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, access_token);
  if (userName) localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, userName);

  return res.data;
}

export async function get2FAStatus(): Promise<boolean> {
  try {
    const res = await apiClient.get<{ twoFAEnabled: boolean }>("/Api/Auth/2FAStatus");
    return res.data?.twoFAEnabled === true;
  } catch {
    return false;
  }
}

export async function enable2FA(): Promise<void> {
  await apiClient.post("/Api/Auth/Enable2FA");
}

export async function disable2FA(): Promise<void> {
  await apiClient.post("/Api/Auth/Disable2FA");
}

export function logout() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
  sessionStorage.removeItem(TEMP_TOKEN_KEY);
}
