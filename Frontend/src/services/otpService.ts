import { apiClient, AUTH_TOKEN_STORAGE_KEY, AUTH_USERNAME_STORAGE_KEY } from "./apiClient";

export type VerifyEmailResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  userName?: string;
};

export type ResendOtpResponse = {
  ok: boolean;
  userId: string;
  otpExpiresAt?: string | null;
  smtpFallback?: boolean;
  remainingSends?: number;
};

export async function verifyEmail(params: { userId: string; otp: string }): Promise<VerifyEmailResponse> {
  const res = await apiClient.post<VerifyEmailResponse>("/Api/Auth/VerifyEmail", {
    userId: params.userId,
    otp: params.otp,
  });
  const data = res.data;
  if (data?.access_token) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.access_token);
    if (data.userName) {
      localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, data.userName);
    }
  }
  return data;
}

export async function resendOtp(userId: string): Promise<ResendOtpResponse> {
  const res = await apiClient.post<ResendOtpResponse>("/Api/Auth/ResendOtp", { userId });
  return res.data;
}
