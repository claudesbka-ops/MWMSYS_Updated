import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";

export default function Panic() {
  const [passportNo, setPassportNo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const sendPanic = async () => {
    if (!passportNo.trim()) {
      toast.error("Enter a Passport Number");
      return;
    }

    setStatus("sending");

    try {
      const form = new FormData();
      form.append("PassportNo", passportNo.trim());
      form.append("Title", "Panic Alert");
      form.append("Description", "Worker triggered panic button");
      if (file) {
        form.append("file", file);
      }

      await apiClient.post("/Api/Panic", form);

      setStatus("sent");
      toast.success("HELP REQUESTED", {
        description: "Your emergency alert has been sent.",
        duration: 8000,
      });
    } catch (e: any) {
      setStatus("idle");
      const msg = e?.response?.data?.error ? e.response.data.error.toString() : "Failed to send panic";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {status !== "idle" ? <div className="panic-overlay" /> : null}
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Panic Button</CardTitle>
          <CardDescription>Anonymous demo endpoint: POST /Api/Panic</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="passport">Passport Number</Label>
            <Input id="passport" value={passportNo} onChange={(e) => setPassportNo(e.target.value)} placeholder="e.g. A50537644" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="incidentFile">Incident Evidence (optional)</Label>
            <Input
              id="incidentFile"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={status === "sending" || status === "sent"}
            />
          </div>

          <Button
            onClick={sendPanic}
            disabled={status === "sending" || status === "sent"}
            className="w-full h-16 text-lg font-bold"
            variant={status === "sent" ? "secondary" : "destructive"}
          >
            {status === "sent" ? (
              "Help is on the way"
            ) : status === "sending" ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent"
                  aria-hidden="true"
                />
                Sending...
              </span>
            ) : (
              "TRIGGER PANIC"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
