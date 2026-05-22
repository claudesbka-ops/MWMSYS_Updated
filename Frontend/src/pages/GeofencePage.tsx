import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/services/apiClient";
import { useJsApiLoader, GoogleMap, MarkerF, CircleF } from "@react-google-maps/api";
import { MapPin, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
const DEFAULT_CENTER = { lat: 3.139, lng: 101.6869 }; // Kuala Lumpur

type Geofence = {
  Id: number;
  Employer_Id: string;
  Name: string;
  Center_Lat: number;
  Center_Lng: number;
  Radius_Meters: number;
  Is_Active: boolean;
};

type NewZone = {
  name: string;
  lat: number | null;
  lng: number | null;
  radius: number;
};

export default function GeofencePage() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_API_KEY,
    libraries: ["visualization"],
  });

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newZone, setNewZone] = useState<NewZone>({ name: "", lat: null, lng: null, radius: 500 });
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const fetchGeofences = useCallback(async () => {
    try {
      const res = await apiClient.get<Geofence[]>("/Api/Geofences");
      setGeofences(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load geofences");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGeofences(); }, [fetchGeofences]);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!adding) return;
    const lat = e.latLng?.lat() ?? null;
    const lng = e.latLng?.lng() ?? null;
    setNewZone((p) => ({ ...p, lat, lng }));
  };

  const handleSave = async () => {
    if (!newZone.name.trim()) { toast.error("Zone name is required"); return; }
    if (newZone.lat == null || newZone.lng == null) { toast.error("Click on the map to set the zone centre"); return; }
    setSaving(true);
    try {
      await apiClient.post("/Api/Geofences/Create", {
        name: newZone.name.trim(),
        centerLat: newZone.lat,
        centerLng: newZone.lng,
        radiusMeters: newZone.radius,
      });
      toast.success("Work zone saved");
      setAdding(false);
      setNewZone({ name: "", lat: null, lng: null, radius: 500 });
      fetchGeofences();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to save zone");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (g: Geofence) => {
    try {
      await apiClient.put(`/Api/Geofences/${g.Id}`, { isActive: !g.Is_Active });
      setGeofences((prev) => prev.map((x) => x.Id === g.Id ? { ...x, Is_Active: !x.Is_Active } : x));
      toast.success(g.Is_Active ? "Zone deactivated" : "Zone activated");
    } catch {
      toast.error("Failed to update zone");
    }
  };

  const handleDelete = async (g: Geofence) => {
    if (!confirm(`Deactivate zone "${g.Name}"?`)) return;
    try {
      await apiClient.delete(`/Api/Geofences/${g.Id}`);
      fetchGeofences();
      toast.success("Zone deactivated");
    } catch {
      toast.error("Failed to deactivate zone");
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Work Zones</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define geographic zones. Workers clocking in outside all zones trigger an alert.
          </p>
        </div>
        <Button onClick={() => { setAdding(!adding); setNewZone({ name: "", lat: null, lng: null, radius: 500 }); }}>
          <Plus className="w-4 h-4 mr-1" />
          {adding ? "Cancel" : "Add Zone"}
        </Button>
      </div>

      {adding && (
        <div className="bg-card rounded-2xl border border-border/60 p-5 mb-5 space-y-4">
          <p className="text-sm text-muted-foreground">Click the map to place the zone centre, then set a name and radius.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Zone Name</Label>
              <Input
                value={newZone.name}
                onChange={(e) => setNewZone((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Main Warehouse"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Radius (metres)</Label>
              <Input
                type="number"
                value={newZone.radius}
                min={50}
                max={50000}
                onChange={(e) => setNewZone((p) => ({ ...p, radius: Number(e.target.value) }))}
              />
            </div>
          </div>
          {newZone.lat != null && (
            <p className="text-xs text-muted-foreground">
              Centre: {newZone.lat.toFixed(5)}, {newZone.lng?.toFixed(5)}
            </p>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Zone"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Map — 60% */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-border/60 h-[500px]">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={DEFAULT_CENTER}
              zoom={12}
              onLoad={(map) => { mapRef.current = map; }}
              onClick={handleMapClick}
              options={{ streetViewControl: false, mapTypeControl: false }}
            >
              {/* Existing geofences */}
              {geofences.map((g) => (
                <CircleF
                  key={g.Id}
                  center={{ lat: Number(g.Center_Lat), lng: Number(g.Center_Lng) }}
                  radius={Number(g.Radius_Meters)}
                  options={{
                    fillColor: g.Is_Active ? "#22c55e" : "#9ca3af",
                    fillOpacity: 0.18,
                    strokeColor: g.Is_Active ? "#16a34a" : "#6b7280",
                    strokeWeight: 2,
                  }}
                />
              ))}
              {geofences.map((g) => (
                <MarkerF
                  key={`pin-${g.Id}`}
                  position={{ lat: Number(g.Center_Lat), lng: Number(g.Center_Lng) }}
                  title={g.Name}
                  icon={{ url: g.Is_Active ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png" : "http://maps.google.com/mapfiles/ms/icons/grey-dot.png" }}
                />
              ))}
              {/* Preview of new zone */}
              {adding && newZone.lat != null && newZone.lng != null && (
                <>
                  <CircleF
                    center={{ lat: newZone.lat, lng: newZone.lng }}
                    radius={newZone.radius}
                    options={{ fillColor: "#3b82f6", fillOpacity: 0.2, strokeColor: "#2563eb", strokeWeight: 2 }}
                  />
                  <MarkerF position={{ lat: newZone.lat, lng: newZone.lng }} />
                </>
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
              Loading map…
            </div>
          )}
        </div>

        {/* List — 40% */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading zones…</p>
          ) : geofences.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border/60 p-6 text-center">
              <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">No zones yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Add Zone" to create your first work zone.</p>
            </div>
          ) : (
            geofences.map((g) => (
              <div
                key={g.Id}
                className={`bg-card rounded-2xl border p-4 flex items-start justify-between gap-3 ${
                  g.Is_Active ? "border-emerald-500/30" : "border-border/40 opacity-60"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{g.Name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Radius: {g.Radius_Meters}m &nbsp;·&nbsp;
                    {Number(g.Center_Lat).toFixed(4)}, {Number(g.Center_Lng).toFixed(4)}
                  </div>
                  <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    g.Is_Active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                  }`}>
                    {g.Is_Active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(g)}
                    className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground"
                    title={g.Is_Active ? "Deactivate" : "Activate"}
                  >
                    {g.Is_Active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(g)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    title="Deactivate zone"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
