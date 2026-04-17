import { apiClient, AUTH_TOKEN_STORAGE_KEY, AUTH_USERNAME_STORAGE_KEY } from "./apiClient";

export interface LoginResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  userName?: string;
  [key: string]: unknown;
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

  const res = await apiClient.post<LoginResponse>("/Api/token", body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

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
}

export function logout() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
}
