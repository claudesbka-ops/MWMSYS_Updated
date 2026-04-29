import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, CheckCircle2, ChevronRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/services/apiClient";
import { listPublicEmployers } from "@/services/relationshipService";
import { stashPendingWorkerPhoto } from "@/services/pendingPhotoUploader";
import { toast } from "sonner";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

type PhotoCapture = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

export default function WorkerSignupForm() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [photo, setPhoto] = useState<PhotoCapture | null>(null);
  const [form, setForm] = useState({
    userId: "",
    fullName: "",
    emailId: "",
    passportNo: "",
    password: "",
    employerId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const employersQuery = useQuery({
    queryKey: ["public_employers"],
    queryFn: () => listPublicEmployers(),
  });

  const employers = employersQuery.data ?? [];

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Photo must be JPG, PNG, or WebP");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Photo must be smaller than 5 MB");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (!dataUrl) {
        toast.error("Failed to read photo");
        return;
      }
      setPhoto({
        dataUrl,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
    };
    reader.onerror = () => toast.error("Failed to read photo");
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const goToFormStep = () => {
    if (!photo) {
      toast.error("Profile photo is required to continue");
      return;
    }
    setStep(2);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!photo) {
      toast.error("Profile photo is required");
      setStep(1);
      return;
    }
    if (!form.userId.trim() || !form.emailId.trim() || !form.password.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!form.passportNo.trim()) {
      toast.error("Passport number is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post("/signup", {
        userId: form.userId.trim(),
        emailId: form.emailId.trim(),
        passportNo: form.passportNo.trim(),
        password: form.password,
        role: "worker",
        name: form.fullName.trim() || undefined,
        employerId: form.employerId || undefined,
      });
      const body = res.data as { userId?: string; emailId?: string };

      const persistedUserId = (body?.userId ?? form.userId.trim()).toString();
      stashPendingWorkerPhoto({
        userId: persistedUserId,
        dataUrl: photo.dataUrl,
        fileName: photo.fileName,
        mimeType: photo.mimeType,
      });

      toast.success("Verification email sent");
      const qs = new URLSearchParams();
      qs.set("userId", persistedUserId);
      if (body?.emailId || form.emailId) qs.set("email", body?.emailId ?? form.emailId.trim());
      navigate(`/verify-email?${qs.toString()}`);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Signup failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Worker registration"
      subtitle="Register as a migrant worker on MWMSYS"
    >
      <div className="mb-6 flex items-center gap-2 text-xs">
        <span
          className={
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold " +
            (step === 1
              ? "bg-primary/15 text-primary border border-primary/30"
              : "bg-success/15 text-success border border-success/30")
          }
        >
          {step === 2 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
          1. Profile Photo
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        <span
          className={
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold " +
            (step === 2
              ? "bg-primary/15 text-primary border border-primary/30"
              : "bg-muted text-muted-foreground border border-border/60")
          }
        >
          2. Account Details
        </span>
      </div>

      {step === 1 ? (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-bold text-foreground">Add a profile photo</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Required for identity verification. JPG, PNG, or WebP — up to 5 MB.
            </p>
          </div>

          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 flex flex-col items-center gap-4">
            {photo ? (
              <img
                src={photo.dataUrl}
                alt="Profile preview"
                className="w-32 h-32 rounded-2xl object-cover border border-border/60"
              />
            ) : (
              <div className="w-32 h-32 rounded-2xl bg-muted flex items-center justify-center border border-border/60">
                <Camera className="w-10 h-10 text-muted-foreground" />
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handlePhotoChange}
              className="hidden"
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                {photo ? "Replace photo" : "Select photo"}
              </Button>
              {photo && (
                <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>

            {photo && (
              <p className="text-[11px] text-muted-foreground">
                {photo.fileName}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/login/worker")}
            >
              Back to Login
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={goToFormStep}
              disabled={!photo}
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
            <img
              src={photo!.dataUrl}
              alt="Profile preview"
              className="w-10 h-10 rounded-lg object-cover border border-border/60"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{photo!.fileName}</p>
              <p className="text-[10px] text-muted-foreground">Profile photo ready</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
              Change
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="userId">User Id</Label>
            <Input
              id="userId"
              value={form.userId}
              onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
              placeholder="worker123"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="Full name as per passport"
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailId">Email</Label>
            <Input
              id="emailId"
              type="email"
              value={form.emailId}
              onChange={(e) => setForm((p) => ({ ...p, emailId: e.target.value }))}
              placeholder="worker@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passportNo">Passport Number</Label>
            <Input
              id="passportNo"
              value={form.passportNo}
              onChange={(e) => setForm((p) => ({ ...p, passportNo: e.target.value }))}
              placeholder="A12345678"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label>Employer</Label>
            <Select
              value={form.employerId || "__none__"}
              onValueChange={(v) => setForm((p) => ({ ...p, employerId: v === "__none__" ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={employersQuery.isLoading ? "Loading employers…" : "Select your employer (optional)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No employer yet</SelectItem>
                {employers.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.companyName || e.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You will appear under this employer immediately after registration.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Password"
              autoComplete="new-password"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Creating…" : "Create Account"}
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
