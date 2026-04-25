import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { resolveApiBaseUrl } from "@/services/apiBase";

const TASK_NAME = "mwmsys-background-location";
const STORE_TOKEN = "mwmsys_access_token";

let defined = false;

function ensureTaskDefined() {
  if (defined) return;
  defined = true;

  TaskManager.defineTask(TASK_NAME, async (task: unknown) => {
    try {
      const body = task as any;
      if (body?.error) return;
      const locations = body?.data?.locations as Location.LocationObject[] | undefined;
      const loc = locations?.[0];
      const coords = loc?.coords;
      if (!coords) return;

      const token = (await SecureStore.getItemAsync(STORE_TOKEN))?.trim() || "";
      if (!token) return;

      const url = resolveApiBaseUrl().replace(/\/+$/, "") + "/Api/Worker/Location";
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy ?? null,
        }),
      }).catch(() => undefined);
    } catch {
      // ignore
    }
  });
}

export async function isBackgroundLocationRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  } catch {
    return false;
  }
}

export async function startBackgroundLocation(): Promise<{ ok: boolean; error?: string }> {
  ensureTaskDefined();

  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { ok: false, error: "Foreground location permission is required." };

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return { ok: false, error: "Background location permission is required." };

  const running = await isBackgroundLocationRunning();
  if (running) return { ok: true };

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 10000,
    distanceInterval: 20,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: true,
    foregroundService: {
      notificationTitle: "MWMSYS Live Location",
      notificationBody: "Sharing your live location for safety and compliance.",
    },
  });

  return { ok: true };
}

export async function stopBackgroundLocation(): Promise<void> {
  ensureTaskDefined();
  const running = await isBackgroundLocationRunning();
  if (!running) return;
  await Location.stopLocationUpdatesAsync(TASK_NAME);
}
