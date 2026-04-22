import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

import { useHrmsService, type AttendanceRow } from "@/services/hrmsService";
import { useMediaService, type CapturedPhoto } from "@/services/mediaService";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { PANIC_QUEUE_KEY, peekQueueSize, syncBus } from "@/services/syncBus";

export type ClockInInput = {
  lat?: number | null;
  lng?: number | null;
  photo?: CapturedPhoto | null;
};

type QueuedClockIn = {
  kind: "clockIn";
  lat: number | null;
  lng: number | null;
  photoUri?: string | null;
  photoMime?: string | null;
  photoName?: string | null;
  capturedAt: number;
};

const ATTENDANCE_QK = ["attendance", "me"] as const;
// Keep in sync with services/syncBus.ts ATTENDANCE_QUEUE_KEY
const QUEUE_KEY = "mwmsys_attendance_queue_v1";

export function useAttendance() {
  const qc = useQueryClient();
  const hrms = useHrmsService();
  const media = useMediaService();

  const query = useQuery<AttendanceRow[]>({
    queryKey: ATTENDANCE_QK,
    queryFn: () => hrms.getMyAttendance(),
    staleTime: 30_000,
  });

  const processEntry = useCallback(
    async (entry: { payload: QueuedClockIn }): Promise<boolean> => {
      const p = entry.payload;
      if (p.kind !== "clockIn") return true;
      let photoUrl: string | null = null;
      if (p.photoUri) {
        try {
          const up = await media.uploadAttendancePhoto({
            uri: p.photoUri,
            width: 0,
            height: 0,
            mimeType: p.photoMime ?? undefined,
            fileName: p.photoName ?? undefined,
          });
          photoUrl = up.url;
        } catch {
          // proceed without photo rather than blocking clock-in forever
          photoUrl = null;
        }
      }
      await hrms.clockIn({ lat: p.lat, lng: p.lng, photoUrl });
      return true;
    },
    [hrms, media]
  );

  const queue = useOfflineQueue<QueuedClockIn>({
    storageKey: QUEUE_KEY,
    processor: processEntry as any,
    maxAttempts: 8,
  });

  const drainIfPanicClear = useCallback(async () => {
    // Strict priority: if panic alerts are queued, defer attendance drain.
    // usePanic's drain will emit "panic-drained" once the panic queue is empty
    // (or makes progress), at which point this hook retries via the bus subscription.
    const panicPending = await peekQueueSize(PANIC_QUEUE_KEY);
    if (panicPending > 0) return { skipped: true as const };
    const r = await queue.drain();
    if (r.processed > 0) qc.invalidateQueries({ queryKey: ATTENDANCE_QK });
    return { skipped: false as const, ...r };
  }, [qc, queue]);

  // Auto-drain on connectivity regain (gated by panic priority)
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        drainIfPanicClear().catch(() => undefined);
      }
    });
    return () => unsub();
  }, [drainIfPanicClear]);

  // When panic queue finishes draining, retry attendance drain immediately.
  useEffect(() => {
    const off = syncBus.on("panic-drained", () => {
      drainIfPanicClear().catch(() => undefined);
    });
    return () => off();
  }, [drainIfPanicClear]);

  const clockIn = useMutation<
    AttendanceRow | { queued: true },
    unknown,
    ClockInInput
  >({
    mutationFn: async (input) => {
      let photoUrl: string | null = null;
      try {
        if (input.photo) {
          const up = await media.uploadAttendancePhoto(input.photo);
          photoUrl = up.url;
        }
        const row = await hrms.clockIn({
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          photoUrl,
        });
        return row;
      } catch (e: any) {
        // Network / server failure -> queue for later drain
        const isNetworkish =
          !e?.status || e?.status >= 500 || /network/i.test(String(e?.message ?? e));
        if (isNetworkish) {
          await queue.enqueue({
            kind: "clockIn",
            lat: input.lat ?? null,
            lng: input.lng ?? null,
            photoUri: input.photo?.uri ?? null,
            photoMime: input.photo?.mimeType ?? null,
            photoName: input.photo?.fileName ?? null,
            capturedAt: Date.now(),
          });
          return { queued: true } as const;
        }
        throw e;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ATTENDANCE_QK });
    },
  });

  const clockOut = useMutation<AttendanceRow, unknown, void>({
    mutationFn: () => hrms.clockOut(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ATTENDANCE_QK });
    },
  });

  return {
    query,
    clockIn,
    clockOut,
    queue,
  };
}
