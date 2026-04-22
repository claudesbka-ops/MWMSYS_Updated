import { useCallback, useState } from "react";
import * as Location from "expo-location";

export type GeoFix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
};

export type UseGeoFixState = {
  fix: GeoFix | null;
  loading: boolean;
  error: string | null;
  acquire: (opts?: { timeoutMs?: number; accuracy?: Location.LocationAccuracy }) => Promise<GeoFix | null>;
  reset: () => void;
};

/**
 * One-shot high-accuracy foreground location fix with permission guard + timeout.
 * Does NOT touch the background task in services/backgroundLocation.ts.
 */
export function useGeoFix(): UseGeoFixState {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acquire = useCallback(
    async (opts?: { timeoutMs?: number; accuracy?: Location.LocationAccuracy }): Promise<GeoFix | null> => {
      setLoading(true);
      setError(null);
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          setError("Location permission denied");
          return null;
        }

        const timeoutMs = opts?.timeoutMs ?? 12000;
        const accuracy = opts?.accuracy ?? Location.Accuracy.High;

        const pos = await Promise.race<Location.LocationObject | null>([
          Location.getCurrentPositionAsync({ accuracy }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
        ]);

        if (!pos) {
          setError("Location request timed out");
          return null;
        }

        const next: GeoFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          timestamp: pos.timestamp,
        };
        setFix(next);
        return next;
      } catch (e: any) {
        setError(e?.message ?? "Failed to acquire location");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setFix(null);
    setError(null);
  }, []);

  return { fix, loading, error, acquire, reset };
}
