import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";

import { useSession } from "@/contexts/SessionContext";
import { useOfflineQueue, KeepInQueueError, type QueueEntry } from "@/hooks/useOfflineQueue";
import { useGeoFix } from "@/hooks/useGeoFix";
import { PANIC_QUEUE_KEY, syncBus } from "@/services/syncBus";

export type PanicInput = {
  description?: string;
  photoUri?: string | null;
  photoMime?: string | null;
  photoName?: string | null;
  /** Optional override; otherwise a high-accuracy fix is acquired at send time. */
  lat?: number | null;
  lng?: number | null;
};

export type QueuedPanic = {
  kind: "panic";
  title: string;
  description: string;
  lat: number | null;
  lng: number | null;
  photoUri?: string | null;
  photoMime?: string | null;
  photoName?: string | null;
  capturedAt: number;
};

export type PanicResult = { ProblemAndActionId?: number } | { queued: true };

function isNetworkish(e: any): boolean {
  const status = Number(e?.status ?? 0);
  if (!status) return true; // classic fetch network error has no status
  if (status >= 500) return true;
  // 401 is NOT networkish but we DO want to keep the entry (token may refresh).
  return false;
}

async function postPanicMultipart(
  apiBaseUrl: string,
  token: string,
  body: QueuedPanic
): Promise<{ ProblemAndActionId?: number; status: number }> {
  const url = apiBaseUrl.replace(/\/+$/, "") + "/Api/Panic";
  const form = new FormData();
  form.append("Title", body.title);
  form.append("Description", body.description);
  if (body.lat != null) form.append("Latitude", String(body.lat));
  if (body.lng != null) form.append("Longitude", String(body.lng));

  if (body.photoUri) {
    const name = body.photoName || inferName(body.photoUri);
    const type = body.photoMime || inferMime(body.photoUri) || "image/jpeg";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - RN FormData file shape differs from DOM
    form.append("file", { uri: body.photoUri, name, type } as any);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Do not set Content-Type; RN will add boundary.
    },
    body: form as any,
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const err: any = data && typeof data === "object" ? data : { error: String(data ?? res.statusText) };
    err.status = res.status;
    throw err;
  }

  return { ...(data as any), status: res.status };
}

export function usePanic() {
  const { apiBaseUrl, token } = useSession();
  const geo = useGeoFix();
  const tokenRef = useRef(token);
  const apiBaseUrlRef = useRef(apiBaseUrl);
  tokenRef.current = token;
  apiBaseUrlRef.current = apiBaseUrl;

  // Drain processor runs outside the React render cycle — use refs for fresh auth.
  const processEntry = useCallback(
    async (entry: QueueEntry<QueuedPanic>): Promise<boolean> => {
      try {
        await postPanicMultipart(apiBaseUrlRef.current, tokenRef.current, entry.payload);
        return true;
      } catch (e: any) {
        const status = Number(e?.status ?? 0);
        if (status === 401) {
          // Auth gap — keep indefinitely; do not burn attempts.
          throw new KeepInQueueError("auth-pending");
        }
        if (isNetworkish(e)) {
          // Transient network — normal retry semantics.
          throw e;
        }
        // 4xx (not 401) means request is malformed — drop after normal attempts.
        throw e;
      }
    },
    []
  );

  const queue = useOfflineQueue<QueuedPanic>({
    storageKey: PANIC_QUEUE_KEY,
    processor: processEntry,
    maxAttempts: 50, // life-safety: try hard before giving up
    onChange: (_size) => {
      // Cross-hook notification so attendance / tab badge update.
      syncBus.emit("panic-size-changed");
    },
  });

  const drainAndNotify = useCallback(async () => {
    const r = await queue.drain();
    if (r.processed > 0 || r.remaining === 0) {
      syncBus.emit("panic-drained");
    }
    return r;
  }, [queue]);

  // Auto-drain on mount (covers app-launch after kill while offline)
  useEffect(() => {
    drainAndNotify().catch(() => undefined);
  }, [drainAndNotify]);

  // Auto-drain on connectivity regain
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        drainAndNotify().catch(() => undefined);
      }
    });
    return () => unsub();
  }, [drainAndNotify]);

  const mutation = useMutation<PanicResult, unknown, PanicInput>({
    mutationFn: async (input) => {
      // High-accuracy fix with short timeout — user safety > precision.
      let lat = input.lat ?? null;
      let lng = input.lng ?? null;
      if (lat == null || lng == null) {
        const fix = await geo.acquire({
          accuracy: Location.Accuracy.BestForNavigation,
          timeoutMs: 8000,
        });
        if (fix) {
          lat = fix.lat;
          lng = fix.lng;
        }
      }

      const payload: QueuedPanic = {
        kind: "panic",
        title: "Panic Alert",
        description: (input.description ?? "").trim() || "Worker triggered panic button",
        lat,
        lng,
        photoUri: input.photoUri ?? null,
        photoMime: input.photoMime ?? null,
        photoName: input.photoName ?? null,
        capturedAt: Date.now(),
      };

      try {
        const res = await postPanicMultipart(apiBaseUrlRef.current, tokenRef.current, payload);
        return { ProblemAndActionId: res.ProblemAndActionId };
      } catch (e: any) {
        const status = Number(e?.status ?? 0);
        // Queue for:
        //  - any network-ish failure
        //  - 401 (auth may be refreshed; alert must survive)
        if (isNetworkish(e) || status === 401) {
          await queue.enqueue(payload);
          syncBus.emit("panic-enqueued");
          return { queued: true };
        }
        throw e;
      }
    },
  });

  const pendingCount = queue.entries.length;
  const hasPendingEmergency = pendingCount > 0;
  const isSyncingEmergency = queue.draining || (hasPendingEmergency && mutation.isPending);

  return useMemo(
    () => ({
      trigger: mutation.mutateAsync,
      mutation,
      queue,
      pendingCount,
      hasPendingEmergency,
      isSyncingEmergency,
      drain: drainAndNotify,
      geoLoading: geo.loading,
      geoError: geo.error,
    }),
    [
      mutation,
      queue,
      pendingCount,
      hasPendingEmergency,
      isSyncingEmergency,
      drainAndNotify,
      geo.loading,
      geo.error,
    ]
  );
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function inferName(uri: string): string {
  const base = uri.split("/").pop() || `panic_${Date.now()}.jpg`;
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function inferMime(uri: string): string | null {
  const ext = uri.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)?.[1]?.toLowerCase();
  if (!ext) return null;
  if (ext === "png") return "image/png";
  if (ext === "heic") return "image/heic";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
