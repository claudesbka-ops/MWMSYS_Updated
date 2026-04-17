import DashboardLayout from "@/components/DashboardLayout";
import { usePanicAlerts } from "@/contexts/PanicAlertsContext";

type TriggerPayload = {
  id?: number;
  title?: string;
  description?: string;
  passportNo?: string;
  memberInfoId?: number;
  workerId?: string;
  currentLocation?: string;
  companyName?: string;
  passportPhoto?: string;
  uploadedFileUrl?: string;
  createdAt?: string;
  [key: string]: unknown;
};

function normalizePassportPhotoSrc(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.startsWith("data:")) return v;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `data:image/jpeg;base64,${v}`;
}

function isProbablyImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.endsWith(".png") || u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".gif") || u.endsWith(".webp") || u.includes("image");
}

async function playAlarm(): Promise<void> {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 880;
      osc.connect(gain);
      osc.start(now + i * 0.22);
      osc.stop(now + i * 0.22 + 0.18);
    }

    setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 1500);
  } catch {
    // ignore audio errors
  }
}

export default function AdminDashboard() {
  const { alerts, resolve } = usePanicAlerts();

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Live Alerts</h1>
          <p className="text-sm text-muted-foreground">Real-time panic triggers from workers</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card">
          <div className="p-4 border-b border-border/60">
            <p className="text-sm font-semibold">Latest</p>
          </div>
          <div className="divide-y divide-border/60">
            {alerts.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No live alerts yet.</div>
            ) : (
              alerts.map((a: any) => (
                <div key={Number(a.ID)} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{(a.Title ?? "Panic Alert").toString()}</p>
                      {a.Description ? <p className="text-sm text-muted-foreground">{a.Description.toString()}</p> : null}
                      <div className="mt-3 flex flex-wrap items-start gap-4">
                        {a.passportPhoto ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Passport Photo</p>
                            <img
                              src={normalizePassportPhotoSrc(a.passportPhoto.toString())}
                              alt="Passport"
                              className="h-24 w-24 rounded-md object-cover border border-border/60"
                              loading="lazy"
                            />
                          </div>
                        ) : null}

                        {a.DocumentPath ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Uploaded Evidence</p>
                            {isProbablyImageUrl(a.DocumentPath.toString()) ? (
                              <img
                                src={a.DocumentPath.toString()}
                                alt="Uploaded evidence"
                                className="h-24 w-40 rounded-md object-cover border border-border/60"
                                loading="lazy"
                              />
                            ) : (
                              <a
                                className="text-sm underline"
                                href={a.DocumentPath.toString()}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View Document
                              </a>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {a.Prob_ID ? <span>Prob_ID: {a.Prob_ID.toString()}</span> : null}
                        {a.worker_ID ? <span className="ml-3">Worker: {a.worker_ID.toString()}</span> : null}
                        {a.Company_Name ? <span className="ml-3">Company: {a.Company_Name.toString()}</span> : null}
                        {a.Current_Location ? <span className="ml-3">Location: {a.Current_Location.toString()}</span> : null}
                        <button
                          className="ml-3 text-xs underline"
                          onClick={() => resolve(Number(a.ID))}
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {a.Updated_On ? new Date(a.Updated_On.toString()).toLocaleString() : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
