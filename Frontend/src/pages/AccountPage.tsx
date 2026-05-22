import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CreditCard, Mail, UserCircle, ShieldCheck, Crown, Sparkles, ArrowUpRight, Camera, Save, Trash2, X, Lock } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import {
  getAccountProfile,
  updateAccountProfile,
  uploadAccountPhoto,
  type RoleProfile,
} from "@/services/accountService";
import { get2FAStatus, enable2FA, disable2FA } from "@/services/authService";

function planBadgeProps(planType: string) {
  const key = (planType ?? "").toLowerCase();
  if (key === "pro") {
    return {
      icon: Sparkles,
      label: "Pro",
      className: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30",
    };
  }
  if (key === "enterprise") {
    return {
      icon: Crown,
      label: "Enterprise",
      className: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    };
  }
  return {
    icon: ShieldCheck,
    label: "Free",
    className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  };
}

export default function AccountPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const profileQuery = useQuery({
    queryKey: ["account_profile"],
    queryFn: getAccountProfile,
  });

  // Handle Stripe post-checkout return.
  useEffect(() => {
    const checkout = (searchParams.get("checkout") ?? "").toLowerCase();
    if (checkout === "success") {
      toast.success("Payment received. Your subscription is now active.");
      profileQuery.refetch().catch(() => undefined);
      const next = new URLSearchParams(searchParams);
      next.delete("checkout");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscription = profileQuery.data?.subscription;
  const plan = useMemo(() => planBadgeProps(subscription?.planType ?? "Free"), [subscription?.planType]);
  const PlanIcon = plan.icon;

  const canManageBilling = profileQuery.data?.role === "agency" || profileQuery.data?.role === "employer";

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your profile, subscription and security settings.
          </p>
        </div>

        {/* Profile card */}
        <div className="bg-card rounded-2xl border border-border/60 p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-sm ring-1 ring-border/50">
              <UserCircle className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              {profileQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              ) : (
                <>
                  <div className="text-base font-bold text-foreground truncate">
                    {profileQuery.data?.userName ?? profileQuery.data?.userId ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{profileQuery.data?.emailId ?? "—"}</span>
                  </div>
                </>
              )}
            </div>
            <Badge variant="secondary" className="uppercase tracking-wide text-[10px]">
              {profileQuery.data?.role ?? "—"}
            </Badge>
          </div>
        </div>

        {/* Subscription card */}
        <div className="bg-card rounded-2xl border border-border/60 p-6 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Current Plan
              </div>
              {profileQuery.isLoading ? (
                <Skeleton className="h-8 w-32 mt-2" />
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold ${plan.className}`}
                  >
                    <PlanIcon className="w-4 h-4" />
                    {plan.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {subscription?.status ?? "—"}
                    {subscription?.endDate
                      ? ` · renews ${new Date(subscription.endDate).toLocaleDateString()}`
                      : ""}
                  </span>
                </div>
              )}
            </div>
            {canManageBilling && (
              <Button variant="outline" onClick={() => navigate("/pricing")}>
                <CreditCard className="w-4 h-4 mr-2" />
                Manage billing
                <ArrowUpRight className="w-3.5 h-3.5 ml-2" />
              </Button>
            )}
          </div>
          {!canManageBilling && (
            <p className="text-xs text-muted-foreground mt-3">
              Only agency and employer accounts can upgrade the subscription.
            </p>
          )}
        </div>

        {/* Role-specific profile editor */}
        <ProfileEditor
          profile={profileQuery.data?.profile ?? null}
          isLoading={profileQuery.isLoading}
          onSaved={() => profileQuery.refetch()}
        />

        <SecurityCard />

        <DangerZone userKey={profileQuery.data?.userId ?? null} />
      </div>
    </DashboardLayout>
  );
}

function SecurityCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    get2FAStatus().then(setEnabled);
  }, []);

  const handleToggle = async () => {
    if (toggling || enabled === null) return;
    setToggling(true);
    try {
      if (enabled) {
        await disable2FA();
        setEnabled(false);
        toast.success("Two-factor authentication disabled");
      } else {
        await enable2FA();
        setEnabled(true);
        toast.success("Two-factor authentication enabled. You will need a code on next login.");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to update 2FA setting");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="mt-4 bg-card rounded-2xl border border-border/60 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-foreground">Two-Factor Authentication</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        When enabled, a one-time code is sent to your email at each login.
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">
          Status:{" "}
          {enabled === null ? (
            <span className="text-muted-foreground">Loading…</span>
          ) : enabled ? (
            <span className="text-emerald-500 font-semibold">Enabled</span>
          ) : (
            <span className="text-muted-foreground">Disabled</span>
          )}
        </span>
        <Button
          size="sm"
          variant={enabled ? "destructive" : "default"}
          disabled={toggling || enabled === null}
          onClick={handleToggle}
        >
          {toggling ? "Saving…" : enabled ? "Disable 2FA" : "Enable 2FA"}
        </Button>
      </div>
    </div>
  );
}

function DangerZone({ userKey }: { userKey: string | null }) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await apiClient.delete("/Api/Account/Delete");
      toast.success("Account deleted");
      localStorage.removeItem("mwmsys_logged_in");
      localStorage.removeItem("mwmsys_token");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to delete account");
      setDeleting(false);
    }
  };

  if (!userKey) return null;

  return (
    <>
      <div className="mt-6 bg-card rounded-2xl border border-destructive/30 p-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-sm font-bold text-destructive">Danger Zone</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Permanently delete your account. This action anonymises your data and cannot be undone.
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => { setShowModal(true); setConfirmText(""); }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Account
        </Button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !deleting && setShowModal(false)}
        >
          <div
            className="bg-card rounded-2xl border border-destructive/40 shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-border/40">
              <div>
                <h3 className="text-base font-bold text-foreground">Delete account</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This will anonymise your account and cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl hover:bg-muted/60"
                disabled={deleting}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <Label htmlFor="deleteConfirm" className="text-sm">
                Type <span className="font-bold font-mono text-destructive">DELETE</span> to confirm
              </Label>
              <Input
                id="deleteConfirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={deleting}
                className="font-mono"
              />
            </div>

            <div className="flex gap-2 p-5 pt-0 justify-end">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || deleting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleting ? "Deleting…" : "Delete my account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProfileEditor({
  profile,
  isLoading,
  onSaved,
}: {
  profile: RoleProfile | null;
  isLoading: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset the draft whenever the upstream profile payload changes.
  useEffect(() => {
    if (!profile) {
      setDraft({});
      return;
    }
    setDraft({ ...(profile.fields as Record<string, unknown>) } as Record<string, string>);
  }, [profile]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 p-6 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-card rounded-2xl border border-dashed border-border/60 p-6">
        <div className="text-sm font-semibold text-foreground">Profile details</div>
        <p className="text-xs text-muted-foreground mt-1">
          Editable fields are available for worker, employer and agency accounts.
        </p>
      </div>
    );
  }

  const setField = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateAccountProfile(draft);
      toast.success("Profile updated");
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast.error("Please select an image file");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller");
      e.target.value = "";
      return;
    }
    setPhotoUploading(true);
    try {
      await uploadAccountPhoto(file);
      toast.success("Photo updated");
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Photo upload failed");
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border/60 p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-foreground">Profile details</div>
          <p className="text-xs text-muted-foreground mt-1">
            Update your contact and organisation information. Changes save immediately when you click Save.
          </p>
        </div>
        <Badge variant="secondary" className="uppercase text-[10px] tracking-wide">
          {profile.kind}
        </Badge>
      </div>

      {profile.kind === "worker" ? (
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-muted flex items-center justify-center border border-border/60">
            {profile.fields.photo ? (
              <img src={profile.fields.photo} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={handlePhotoClick} disabled={photoUploading}>
              <Camera className="w-4 h-4 mr-2" />
              {photoUploading ? "Uploading…" : profile.fields.photo ? "Replace photo" : "Upload photo"}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-1.5">JPG or PNG, up to 5 MB.</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profile.kind === "worker" && (
          <>
            <Field label="Full Name" value={draft.name ?? ""} onChange={setField("name")} />
            <Field label="Contact Number" value={draft.contactNumber ?? ""} onChange={setField("contactNumber")} />
            <FieldArea
              className="md:col-span-2"
              label="Address"
              value={draft.address ?? ""}
              onChange={setField("address")}
            />
            <ReadOnlyField label="Passport" value={profile.fields.passportNumber || "—"} />
            <ReadOnlyField label="Email" value={profile.fields.email || "—"} />
          </>
        )}

        {profile.kind === "employer" && (
          <>
            <Field label="Company Name" value={draft.companyName ?? ""} onChange={setField("companyName")} />
            <Field label="Company Phone" value={draft.companyPhone ?? ""} onChange={setField("companyPhone")} />
            <FieldArea
              className="md:col-span-2"
              label="Address"
              value={draft.address ?? ""}
              onChange={setField("address")}
            />
            <Field
              label="Contact Person"
              value={draft.contactPerson ?? ""}
              onChange={setField("contactPerson")}
            />
            <Field
              label="Contact Person Phone"
              value={draft.contactPersonPhone ?? ""}
              onChange={setField("contactPersonPhone")}
            />
            <Field label="Position" value={draft.position ?? ""} onChange={setField("position")} />
            <ReadOnlyField label="SSM / ROC / ROB No" value={profile.fields.ssmNumber || "—"} />
            <ReadOnlyField label="Email" value={profile.fields.email || "—"} />
          </>
        )}

        {profile.kind === "agency" && (
          <>
            <Field label="Agent Name" value={draft.agentName ?? ""} onChange={setField("agentName")} />
            <Field
              label="Organization"
              value={draft.organizationName ?? ""}
              onChange={setField("organizationName")}
            />
            <Field
              label="Contact Number"
              value={draft.contactNumber ?? ""}
              onChange={setField("contactNumber")}
            />
            <Field
              label="IC / Passport"
              value={draft.icPassport ?? ""}
              onChange={setField("icPassport")}
            />
            <ReadOnlyField label="Email" value={profile.fields.email || "—"} />
          </>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t border-border/40">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={onChange} />
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea value={value} onChange={onChange} rows={3} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} disabled />
    </div>
  );
}
