import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useRole } from "@/contexts/RoleContext";
import { apiClient, getAccessToken } from "@/services/apiClient";

export type PanicAlert = {
  ID: number;
  Prob_ID: string | null;
  Type: string;
  Title: string | null;
  Description: string;
  ProbStatus: string | null;
  Updated_On: string | Date | null;
  worker_ID: string | null;
  DocumentPath?: string | null;
  Current_Location?: string | null;
  Company_Name?: string | null;
  Lat?: number | string | null;
  Lng?: number | string | null;
  passportPhoto?: string | null;
};

type PanicContextValue = {
  alerts: PanicAlert[];
  refresh: () => Promise<void>;
  resolve: (id: number) => Promise<void>;
};

const PanicAlertsContext = createContext<PanicContextValue | null>(null);

export function usePanicAlerts(): PanicContextValue {
  const ctx = useContext(PanicAlertsContext);
  if (!ctx) {
    throw new Error("usePanicAlerts must be used within PanicAlertsProvider");
  }
  return ctx;
}

function isAuthorityRole(currentRole: string): boolean {
  return (
    currentRole === "admin" ||
    currentRole === "employer" ||
    currentRole === "agency" ||
    currentRole === "embassy_source" ||
    currentRole === "embassy_destination" ||
    currentRole === "labour"
  );
}

export function PanicAlertsProvider({ children }: { children: React.ReactNode }) {
  const { currentRole } = useRole();
  const enabled = isAuthorityRole(currentRole);

  const [alerts, setAlerts] = useState<PanicAlert[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const socketUrl = useMemo(() => {
    return apiClient.defaults.baseURL ?? "";
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const res = await apiClient.get<PanicAlert[]>("/Api/Panic/Active");
    setAlerts(res.data ?? []);
  }, [enabled]);

  const resolve = useCallback(
    async (id: number) => {
      await apiClient.post("/Api/Panic/Resolve", { id });
      setAlerts((prev) => prev.filter((a) => Number(a.ID) !== Number(id)));
    },
    []
  );

  useEffect(() => {
    if (!enabled) {
      setAlerts([]);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    refresh();

    const token = getAccessToken();
    const s: Socket = io(socketUrl, {
      transports: ["websocket"],
      auth: token ? { token } : undefined,
      reconnection: true,
    });

    socketRef.current = s;

    s.on("new_trigger", (payload: any) => {
      const id = payload?.id != null ? Number(payload.id) : null;
      if (!id) return;

      setAlerts((prev) => {
        if (prev.some((p) => Number(p.ID) === id)) return prev;

        const created: PanicAlert = {
          ID: id,
          Prob_ID: payload?.passportNo?.toString?.() ?? payload?.workerId?.toString?.() ?? null,
          Type: "Panic",
          Title: payload?.title?.toString?.() ?? "Panic Alert",
          Description: payload?.description?.toString?.() ?? "Panic alert triggered",
          ProbStatus: payload?.status?.toString?.() ?? payload?.ProbStatus?.toString?.() ?? "New",
          Updated_On: payload?.createdAt?.toString?.() ?? new Date().toISOString(),
          worker_ID: payload?.workerId?.toString?.() ?? null,
          DocumentPath: payload?.uploadedFileUrl?.toString?.() ?? null,
          Current_Location: payload?.currentLocation?.toString?.() ?? null,
          Company_Name: payload?.companyName?.toString?.() ?? null,
          passportPhoto: payload?.passportPhoto?.toString?.() ?? null,
        };

        return [created, ...prev].slice(0, 200);
      });
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [enabled, refresh, socketUrl]);

  const value = useMemo(() => ({ alerts, refresh, resolve }), [alerts, refresh, resolve]);

  return <PanicAlertsContext.Provider value={value}>{children}</PanicAlertsContext.Provider>;
}
