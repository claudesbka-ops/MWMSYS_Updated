import { Platform } from "react-native";
import Constants from "expo-constants";

// `localhost` so the platform-aware rewriter below can swap it for the
// dev machine's LAN IP / Android emulator host on physical devices.
const DEFAULT_BASE = "http://localhost:3000";

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

function rewriteLocalhostForPlatform(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal) return url;

    // Android emulator maps host loopback to 10.0.2.2
    if (Platform.OS === "android") {
      u.hostname = "10.0.2.2";
      return u.toString().replace(/\/$/, "");
    }

    // iOS simulator: localhost works. Physical device: expose debugger host.
    const debuggerHost = Constants.expoConfig?.hostUri;
    if (typeof debuggerHost === "string" && debuggerHost.length > 0) {
      const lanHost = debuggerHost.split(":")[0];
      if (lanHost && lanHost !== "localhost" && lanHost !== "127.0.0.1") {
        u.hostname = lanHost;
        return u.toString().replace(/\/$/, "");
      }
    }
    return url;
  } catch {
    return url;
  }
}
