import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * Cross-hook synchronization primitives for the offline outbox.
 *
 * Design: we keep separate per-domain queues (attendance, panic) so their
 * processors stay decoupled. The bus enforces strict priority ordering:
 * panic drains first; attendance listens for `panic-drained` to retry.
 */

export const PANIC_QUEUE_KEY = "mwmsys_panic_queue_v1";
export const ATTENDANCE_QUEUE_KEY = "mwmsys_attendance_queue_v1";

type Event = "panic-drained" | "panic-enqueued" | "panic-size-changed";
type Listener = () => void;

const listeners: Record<Event, Set<Listener>> = {
  "panic-drained": new Set(),
  "panic-enqueued": new Set(),
  "panic-size-changed": new Set(),
};

export const syncBus = {
  on(event: Event, listener: Listener): () => void {
    listeners[event].add(listener);
    return () => listeners[event].delete(listener);
  },
  emit(event: Event) {
    for (const l of listeners[event]) {
      try {
        l();
      } catch {
        // swallow — one bad listener must not break the chain
      }
    }
  },
};

/**
 * Reads the current length of a queue from SecureStore without mutating it.
 * Returns 0 if missing / unparseable.
 */
export async function peekQueueSize(key: string): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Lightweight hook for UI surfaces (tab badge, banners) that only need the
 * pending emergency count — it must NOT pull in the panic mutation machinery.
 * Recomputes on every bus event and on mount.
 */
export function useEmergencyBadge(): { count: number; reload: () => Promise<void> } {
  const [count, setCount] = useState(0);

  const reload = useCallback(async () => {
    const n = await peekQueueSize(PANIC_QUEUE_KEY);
    setCount(n);
  }, []);

  useEffect(() => {
    reload().catch(() => undefined);
    const offA = syncBus.on("panic-enqueued", () => {
      reload().catch(() => undefined);
    });
    const offB = syncBus.on("panic-drained", () => {
      reload().catch(() => undefined);
    });
    const offC = syncBus.on("panic-size-changed", () => {
      reload().catch(() => undefined);
    });
    return () => {
      offA();
      offB();
      offC();
    };
  }, [reload]);

  return { count, reload };
}
