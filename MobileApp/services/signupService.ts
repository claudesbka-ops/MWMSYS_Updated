import { useSession } from "@/contexts/SessionContext";

export function useSignupService() {
  const { apiBaseUrl } = useSession();

  async function signup(body: Record<string, any>) {
    const url = apiBaseUrl.replace(/\/+$/, "") + "/signup";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    });

    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      const msg = data?.error ?? "Signup failed";
      throw { status: res.status, error: msg };
    }

    return data as any;
  }

  return { signup };
}
