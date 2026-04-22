import { useCallback, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * Generic SecureStore-backed FIFO queue for retrying failed mutations.
 * Supports arbitrary typed payloads via the <T> generic — use a separate
 * storageKey per domain (e.g. attendance, panic) and let each domain supply
 * its own processor. Payloads must be JSON-serializable and should stay small
 * (SecureStore has ~2KB/item limits on iOS); store URIs, not file bytes.
 */

export type QueueEntry<T> = {
  id: string;
  createdAt: number;
  attempts: number;
  payload: T;
};

/**
 * Throw this from a processor to KEEP an entry in the queue without
 * incrementing its attempt counter. Use for recoverable conditions that
 * are outside the user's control (e.g. 401 while auth refresh is pending,
 * temporarily missing file on disk for a life-safety alert).
 */
export class KeepInQueueError extends Error {
  readonly __keepInQueue = true as const;
  constructor(reason: string) {
    super(reason);
    this.name = "KeepInQueueError";
  }
}

function isKeepInQueue(e: unknown): boolean {
  return !!(e && typeof e === "object" && (e as any).__keepInQueue === true);
}

type Options<T> = {
  storageKey: string;
  /** Called per entry; return true on success to dequeue. Return false / throw to keep + increment attempts.
   *  Throw `KeepInQueueError` to keep without incrementing attempts (never drop). */
  processor: (entry: QueueEntry<T>) => Promise<boolean>;
  maxAttempts?: number;
  /** Optional side-effect called whenever the stored queue changes (enqueue / drain / clear). */
  onChange?: (size: number) => void;
};

export function useOfflineQueue<T>(opts: Options<T>) {
  const { storageKey, processor, maxAttempts = 5 } = opts;
  const [entries, setEntries] = useState<QueueEntry<T>[]>([]);
  const [draining, setDraining] = useState(false);
  const draininglockRef = useRef(false);
  const processorRef = useRef(processor);
  processorRef.current = processor;
  const onChangeRef = useRef(opts.onChange);
  onChangeRef.current = opts.onChange;

  const notifyChange = useCallback((size: number) => {
    try {
      onChangeRef.current?.(size);
    } catch {
      // ignore listener errors
    }
  }, []);

  const load = useCallback(async (): Promise<QueueEntry<T>[]> => {
    try {
      const raw = await SecureStore.getItemAsync(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueueEntry<T>[]) : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  const save = useCallback(
    async (next: QueueEntry<T>[]) => {
      try {
        await SecureStore.setItemAsync(storageKey, JSON.stringify(next));
      } catch {
        // Swallow; surfacing here would just spam the UI.
      }
    },
    [storageKey]
  );

  const enqueue = useCallback(
    async (payload: T): Promise<QueueEntry<T>> => {
      const current = await load();
      const entry: QueueEntry<T> = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        attempts: 0,
        payload,
      };
      const next = [...current, entry];
      await save(next);
      setEntries(next);
      notifyChange(next.length);
      return entry;
    },
    [load, save, notifyChange]
  );

  const drain = useCallback(async (): Promise<{ processed: number; remaining: number }> => {
    if (draininglockRef.current) return { processed: 0, remaining: entries.length };
    draininglockRef.current = true;
    setDraining(true);
    let processed = 0;
    try {
      const current = await load();
      const keep: QueueEntry<T>[] = [];
      for (const e of current) {
        try {
          const ok = await processorRef.current(e);
          if (ok) {
            processed += 1;
            continue;
          }
          const nextAttempts = e.attempts + 1;
          if (nextAttempts < maxAttempts) keep.push({ ...e, attempts: nextAttempts });
        } catch (err) {
          if (isKeepInQueue(err)) {
            // Keep without incrementing attempts — life-safety / auth-pending.
            keep.push(e);
            continue;
          }
          const nextAttempts = e.attempts + 1;
          if (nextAttempts < maxAttempts) keep.push({ ...e, attempts: nextAttempts });
        }
      }
      await save(keep);
      setEntries(keep);
      notifyChange(keep.length);
      return { processed, remaining: keep.length };
    } finally {
      draininglockRef.current = false;
      setDraining(false);
    }
  }, [entries.length, load, maxAttempts, save, notifyChange]);

  const clear = useCallback(async () => {
    await save([]);
    setEntries([]);
    notifyChange(0);
  }, [save, notifyChange]);

  useEffect(() => {
    load()
      .then((initial) => {
        setEntries(initial);
        notifyChange(initial.length);
      })
      .catch(() => undefined);
  }, [load, notifyChange]);

  return { entries, draining, enqueue, drain, clear, reload: load };
}
