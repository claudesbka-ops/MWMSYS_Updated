import { Platform } from "react-native";
import Constants from "expo-constants";

// `localhost` so the platform-aware rewriter below can swap it for the
// dev machine's LAN IP / Android emulator host on physical devices.
const DEFAULT_BASE = "http://192.168.100.180:3000";

type ExpoExtra = {
  EXPO_PUBLIC_API_BASE_URL?: string;
  API_BASE_URL?: string;
} & Record<string, unknown>;

function readEnvBase(): string | undefined {
  const fromProcess = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromProcess && fromProcess.trim()) return fromProcess.trim();
  const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
  const fromExtra = extra.EXPO_PUBLIC_API_BASE_URL ?? extra.API_BASE_URL;
  if (fromExtra && fromExtra.trim()) return fromExtra.trim();
  return undefined;
}

/**
 * Resolve the backend base URL at runtime.
 *
 * Precedence:
 *   1. Explicit value from SessionContext (user override from settings, if set).
 *   2. EXPO_PUBLIC_API_BASE_URL (.env / app.json `extra`).
 *   3. Platform-aware fallbacks so `localhost` in .env still reaches the host
 *      machine when running on Android emulator / iOS simulator / physical device.
 */
export function resolveApiBaseUrl(sessionOverride?: string): string {
  const raw = (sessionOverride && sessionOverride.trim()) || readEnvBase() || DEFAULT_BASE;
  return rewriteLocalhostForPlatform(raw);
}

// React Native's URL polyfill has mutation bugs (setting `hostname` then
// calling `toString()` can produce malformed URLs like
// `http:1.2.3.4//localhost:3000`). Use plain string parsing instead.
function rewriteLocalhostForPlatform(url: string): string {
  const parsed = parseUrlParts(url);
  if (!parsed) return url;

  const { scheme, host, port, rest } = parsed;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (!isLocal) return stripTrailingSlash(url);

  // Auto-detect on physical devices first: Expo's debugger host is the
  // dev machine's LAN IP, which the device can actually reach.
  const lanHost = pickLanHostFromExpoHostUri();

  // Android emulator: host loopback maps to 10.0.2.2.
  // Physical Android: prefer Expo hostUri.
  if (Platform.OS === "android") {
    const replacement = lanHost ?? "10.0.2.2";
    return rebuildUrl(scheme, replacement, port, rest);
  }

  // iOS / web: keep localhost on simulator, swap on real device.
  if (lanHost) {
    return rebuildUrl(scheme, lanHost, port, rest);
  }

  return stripTrailingSlash(url);
}

function pickLanHostFromExpoHostUri(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri !== "string" || hostUri.length === 0) return undefined;
  const lanHost = hostUri.split(":")[0]?.trim();
  if (!lanHost) return undefined;
  if (lanHost === "localhost" || lanHost === "127.0.0.1") return undefined;
  return lanHost;
}

function parseUrlParts(url: string): { scheme: string; host: string; port: string; rest: string } | null {
  // Match scheme://host[:port][/path...]
  const m = /^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\/([^/:?#]+)(?::(\d+))?(.*)$/.exec(url);
  if (!m) return null;
  return { scheme: m[1], host: m[2], port: m[3] ?? "", rest: m[4] ?? "" };
}

function rebuildUrl(scheme: string, host: string, port: string, rest: string): string {
  const portPart = port ? `:${port}` : "";
  return stripTrailingSlash(`${scheme}://${host}${portPart}${rest}`);
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
