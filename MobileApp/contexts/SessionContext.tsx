import Constants from "expo-constants";
import React, { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

type SessionState = {
  apiBaseUrl: string;
  token: string;
  claims: Record<string, unknown> | null;
  setApiBaseUrl: (v: string) => void;
  setToken: (v: string) => void;
  hydrate: () => Promise<void>;
  clear: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

const STORE_API_BASE_URL = "mwmsys_api_base_url";
const STORE_TOKEN = "mwmsys_access_token";

function base64Decode(input: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let str = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
  let output = "";
  for (let i = 0; i < str.length; ) {
    const enc1 = chars.indexOf(str.charAt(i++));
    const enc2 = chars.indexOf(str.charAt(i++));
    const enc3 = chars.indexOf(str.charAt(i++));
    const enc4 = chars.indexOf(str.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }

  try {
    return decodeURIComponent(
      output
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return output;
  }
}

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = typeof (globalThis as any).atob === "function" ? (globalThis as any).atob(padded) : base64Decode(padded);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readDefaultApiBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const raw = extra.API_BASE_URL;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "http://localhost:3000";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(readDefaultApiBaseUrl());
  const [token, setToken] = useState<string>("");
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);

  const hydrate = async () => {
    const storedUrl = await SecureStore.getItemAsync(STORE_API_BASE_URL);
    const storedToken = await SecureStore.getItemAsync(STORE_TOKEN);
    if (storedUrl && storedUrl.trim()) {
      setApiBaseUrl(storedUrl.trim());
    }
    if (storedToken && storedToken.trim()) {
      const t = storedToken.trim();
      setToken(t);
      setClaims(decodeJwtClaims(t));
    }
  };

  const clear = async () => {
    setToken("");
    setClaims(null);
    await SecureStore.deleteItemAsync(STORE_TOKEN);
  };

  const setTokenPersisted = (v: string) => {
    const t = (v ?? "").toString();
    setToken(t);
    setClaims(t ? decodeJwtClaims(t) : null);
    SecureStore.setItemAsync(STORE_TOKEN, t).catch(() => undefined);
  };

  const setApiBaseUrlPersisted = (v: string) => {
    const url = (v ?? "").toString();
    setApiBaseUrl(url);
    SecureStore.setItemAsync(STORE_API_BASE_URL, url).catch(() => undefined);
  };

  const value = useMemo<SessionState>(
    () => ({
      apiBaseUrl,
      token,
      claims,
      setApiBaseUrl: setApiBaseUrlPersisted,
      setToken: setTokenPersisted,
      hydrate,
      clear,
    }),
    [apiBaseUrl, token, claims]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
