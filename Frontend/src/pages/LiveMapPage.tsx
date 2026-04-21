import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { apiClient, getAccessToken } from "@/services/apiClient";
import { io, type Socket } from "socket.io-client";
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type WorkerLocationRow = {
  workerId: string;
  name?: string | null;
  lat: number | null;
  lng: number | null;
  accuracy?: number | null;
  updatedAt?: string | null;
};

export default function LiveMapPage() {
  const socketRef = useRef<Socket | null>(null);
  const [rows, setRows] = useState<WorkerLocationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const googleMapsApiKey = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const { isLoaded } = useJsApiLoader({
    id: "mwmsys-google-maps",
    googleMapsApiKey: googleMapsApiKey || "",
  });

  const socketUrl = useMemo(() => {
    return apiClient.defaults.baseURL ?? "";
  }, []);

  useEffect(() => {
    apiClient
      .get<{ rows: WorkerLocationRow[] }>("/Api/Workers/Locations")
      .then((res) => {
        const incoming = Array.isArray((res as any)?.data?.rows) ? ((res as any).data.rows as WorkerLocationRow[]) : [];
        setRows(incoming);
      })
      .catch(() => undefined);

    const token = getAccessToken();
    const s = io(socketUrl, {
      transports: ["websocket"],
      auth: token ? { token } : undefined,
      reconnection: true,
    });

    socketRef.current = s;

    const onUpdate = (payload: any) => {
      const workerId = (payload?.workerId ?? "").toString();
      if (!workerId) return;

      const next: WorkerLocationRow = {
        workerId,
        name: payload?.name ?? null,
        lat: typeof payload?.lat === "number" ? payload.lat : Number(payload?.lat),
        lng: typeof payload?.lng === "number" ? payload.lng : Number(payload?.lng),
        accuracy: payload?.accuracy != null ? Number(payload.accuracy) : null,
        updatedAt: payload?.updatedAt ?? null,
      };

      setRows((prev) => {
        const idx = prev.findIndex((r) => r.workerId === workerId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...next };
          return copy;
        }
        return [next, ...prev];
      });
    };

    s.on("worker_location_update", onUpdate);

    return () => {
      try {
        s.off("worker_location_update", onUpdate);
        s.disconnect();
      } catch {
        // ignore
      }
      socketRef.current = null;
    };
  }, [socketUrl]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = (rows ?? []).filter((r) => r.lat != null && r.lng != null);
    if (!q) return base;
    return base.filter((r) => {
      const name = (r.name ?? "").toString().toLowerCase();
      const id = (r.workerId ?? "").toString().toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [query, rows]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (rows ?? []).find((r) => r.workerId === selectedId) ?? null;
  }, [rows, selectedId]);

  const center = useMemo(() => {
    const first = filteredRows.find((r) => r.lat != null && r.lng != null);
    return first?.lat != null && first?.lng != null
      ? { lat: first.lat, lng: first.lng }
      : { lat: 3.139, lng: 101.6869 };
  }, [filteredRows]);

  const nowMs = Date.now();
  const isStale = (updatedAt?: string | null) => {
    if (!updatedAt) return true;
    const t = new Date(updatedAt).getTime();
    if (!Number.isFinite(t)) return true;
    return nowMs - t > 2 * 60 * 1000;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Live Map</h1>
          <p className="text-sm text-muted-foreground">Real-time worker locations</p>
        </div>

        {!googleMapsApiKey ? (
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="text-sm font-semibold">Google Maps API key is missing</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Set <span className="font-mono text-foreground">VITE_GOOGLE_MAPS_API_KEY</span> in your Frontend environment and restart the dev server.
            </div>
          </div>
        ) : !isLoaded ? (
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">Loading map…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/55 overflow-hidden">
              <div className="p-4 border-b border-border/60">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Workers</div>
                    <div className="text-xs text-muted-foreground">{filteredRows.length} active locations</div>
                  </div>
                  <Badge variant="secondary" className="trend-badge-shimmer">Live</Badge>
                </div>
                <div className="mt-3">
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name / worker id" />
                </div>
              </div>
              <div className="max-h-[70vh] overflow-auto p-2">
                {filteredRows.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No locations yet.</div>
                ) : (
                  <div className="space-y-1">
                    {filteredRows
                      .slice()
                      .sort((a, b) => {
                        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                        return tb - ta;
                      })
                      .map((r) => {
                        const active = r.workerId === selectedId;
                        const stale = isStale(r.updatedAt);
                        return (
                          <button
                            key={r.workerId}
                            onClick={() => setSelectedId(r.workerId)}
                            className={`w-full text-left rounded-2xl px-3 py-2.5 transition-all duration-200 ${
                              active ? "bg-primary/10 ring-1 ring-primary/25" : "hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground truncate">
                                  {r.name ? `${r.name}` : r.workerId}
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {r.name ? r.workerId : ""}
                                </div>
                              </div>
                              <div className={`text-[11px] font-semibold px-2 py-1 rounded-xl ${stale ? "bg-muted text-muted-foreground" : "bg-success/10 text-success"}`}>
                                {stale ? "Stale" : "Live"}
                              </div>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 overflow-hidden bg-card">
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "70vh" }}
                center={center}
                zoom={10}
                options={{
                  fullscreenControl: false,
                  streetViewControl: false,
                  mapTypeControl: false,
                  clickableIcons: false,
                }}
                onClick={() => setSelectedId(null)}
              >
                {filteredRows.map((r) => {
                  if (r.lat == null || r.lng == null) return null;
                  const stale = isStale(r.updatedAt);
                  const isSelected = r.workerId === selectedId;
                  return (
                    <MarkerF
                      key={r.workerId}
                      position={{ lat: r.lat, lng: r.lng }}
                      onClick={() => setSelectedId(r.workerId)}
                      icon={
                        stale
                          ? undefined
                          : {
                              path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                              fillColor: "#22c55e",
                              fillOpacity: 0.95,
                              strokeColor: "#ffffff",
                              strokeWeight: 2,
                              scale: 1.2,
                              anchor: new (window as any).google.maps.Point(12, 22),
                            }
                      }
                      label={
                        r.name
                          ? {
                              text: r.name,
                              className: "text-[12px] font-semibold",
                            }
                          : undefined
                      }
                    >
                      {isSelected ? (
                        <InfoWindowF onCloseClick={() => setSelectedId(null)}>
                          <div className="min-w-[220px]">
                            <div className="font-semibold">{r.name ? `${r.name}` : r.workerId}</div>
                            <div className="text-xs text-gray-600">{r.name ? r.workerId : ""}</div>
                            <div className="mt-2 text-xs">
                              <div>Lat: {r.lat.toFixed(6)}</div>
                              <div>Lng: {r.lng.toFixed(6)}</div>
                              <div>Updated: {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}</div>
                            </div>
                          </div>
                        </InfoWindowF>
                      ) : null}
                    </MarkerF>
                  );
                })}
              </GoogleMap>

              {selected && selected.lat != null && selected.lng != null ? (
                <div className="p-4 border-t border-border/60 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/55">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {selected.name ? `${selected.name}` : selected.workerId}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {selected.name ? selected.workerId : ""}
                      </div>
                    </div>
                    <Badge variant="secondary">{isStale(selected.updatedAt) ? "Stale" : "Live"}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Updated: {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "—"}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
