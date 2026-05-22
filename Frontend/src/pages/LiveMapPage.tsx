import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { apiClient, getAccessToken } from "@/services/apiClient";
import { io, type Socket } from "socket.io-client";
import { GoogleMap, HeatmapLayerF, InfoWindowF, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/contexts/RoleContext";

type WorkerLocationRow = {
  workerId: string;
  name?: string | null;
  lat: number | null;
  lng: number | null;
  accuracy?: number | null;
  updatedAt?: string | null;
};

export default function LiveMapPage() {
  const [searchParams] = useSearchParams();
  const focusWorkerId = (searchParams.get("focus") ?? "").trim();

  const socketRef = useRef<Socket | null>(null);
  const [rows, setRows] = useState<WorkerLocationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(focusWorkerId || null);
  const [query, setQuery] = useState("");

  // If the focus worker param arrives/changes, keep selection in sync.
  useEffect(() => {
    if (focusWorkerId) setSelectedId(focusWorkerId);
  }, [focusWorkerId]);

  const { currentRole } = useRole();
  const canHeatmap = currentRole === "admin" || currentRole === "agency";

  const [mapMode, setMapMode] = useState<"pins" | "heatmap">("pins");
  const [heatmapPoints, setHeatmapPoints] = useState<Array<{ lat: number; lng: number; weight: number }>>([]);
  const [heatmapLoaded, setHeatmapLoaded] = useState(false);

  const googleMapsApiKey = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const { isLoaded } = useJsApiLoader({
    id: "mwmsys-google-maps",
    googleMapsApiKey: googleMapsApiKey || "",
    libraries: ["visualization"],
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

    if (canHeatmap) {
      apiClient
        .get<{ points: Array<{ lat: number; lng: number; weight: number }> }>("/Api/Map/HeatmapData")
        .then((res) => {
          setHeatmapPoints(Array.isArray(res.data?.points) ? res.data.points : []);
          setHeatmapLoaded(true);
        })
        .catch(() => undefined);
    }

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
    // Prefer the explicitly focused worker, then the selected row, then the first row.
    const focused =
      (focusWorkerId && rows.find((r) => r.workerId === focusWorkerId)) ||
      (selectedId && rows.find((r) => r.workerId === selectedId)) ||
      filteredRows.find((r) => r.lat != null && r.lng != null);
    return focused?.lat != null && focused?.lng != null
      ? { lat: focused.lat, lng: focused.lng }
      : { lat: 3.139, lng: 101.6869 };
  }, [focusWorkerId, selectedId, rows, filteredRows]);

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
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center font-bold">!</div>
              <div>
                <div className="text-base font-semibold text-destructive">Map API key not configured</div>
                <div className="mt-1 text-sm text-foreground/80">
                  The live map cannot render because <span className="font-mono text-foreground">VITE_GOOGLE_MAPS_API_KEY</span> is not set in the Frontend environment.
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Add it to <span className="font-mono">Frontend/.env</span> and restart the Vite dev server.
                </div>
              </div>
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
                  <div className="flex items-center gap-2">
                    {canHeatmap && (
                      <div className="flex rounded-xl border border-border/60 overflow-hidden text-xs font-semibold">
                        <button
                          onClick={() => setMapMode("pins")}
                          className={`px-3 py-1.5 transition-colors ${
                            mapMode === "pins" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          Pins
                        </button>
                        <button
                          onClick={() => {
                            setMapMode("heatmap");
                            if (!heatmapLoaded) {
                              apiClient
                                .get<{ points: Array<{ lat: number; lng: number; weight: number }> }>("/Api/Map/HeatmapData")
                                .then((r) => {
                                  setHeatmapPoints(Array.isArray(r.data?.points) ? r.data.points : []);
                                  setHeatmapLoaded(true);
                                })
                                .catch(() => undefined);
                            }
                          }}
                          className={`px-3 py-1.5 transition-colors ${
                            mapMode === "heatmap" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          Heatmap
                        </button>
                      </div>
                    )}
                    <Badge variant="secondary" className="trend-badge-shimmer">Live</Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name / worker id" />
                </div>
              </div>
              <div className="max-h-[70vh] overflow-auto p-2">
                {filteredRows.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">No worker locations to show.</div>
                    <div className="mt-1 text-xs">
                      If this is unexpected, check that (a) at least one worker has sent a location via
                      the mobile app, and (b) your account is linked to those workers
                      (Employer_Id on the worker record for employers; Tbl_Worker_RecruitAgent for agencies).
                    </div>
                  </div>
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
                {mapMode === "heatmap" && heatmapPoints.length > 0 && (
                  <HeatmapLayerF
                    data={heatmapPoints.map((p) => ({
                      location: new (window as any).google.maps.LatLng(p.lat, p.lng),
                      weight: p.weight,
                    }))}
                    options={{ radius: 30, opacity: 0.7 }}
                  />
                )}
                {mapMode === "pins" && filteredRows.map((r) => {
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
