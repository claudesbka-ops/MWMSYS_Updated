import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAccountProfile,
  updateAccountProfile,
  type RoleProfile,
} from "@/services/accountService";
import { logout } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, ShieldCheck, LogOut } from "lucide-react";

/**
 * Returns the list of draft field keys that are required for a given role.
 * Keep these in sync with the backend `allFilled` checks in accountRoutes.ts.
 */
function requiredKeysFor(profile: RoleProfile | null | undefined): string[] {
  if (!profile) return [];
  if (profile.kind === "worker") return ["name", "contactNumber", "address", "passportNumber"];
  if (profile.kind === "employer") return ["companyName", "address", "contactPerson", "contactPersonPhone"];
  if (profile.kind === "agency") return ["agentName", "organizationName", "contactNumber", "icPassport"];
  return [];
}

/**
 * CompleteProfilePage — dedicated screen shown by RequireCompleteProfile when
 * a worker / employer / agency account has not yet filled in the mandatory
 * profile fields after signup. Keeps the flow linear: user can only proceed
 * to the app once every required field is populated.
 */
export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refresh } = useAuth();

  const profileQuery = useQuery({
    queryKey: ["account_profile"],
    queryFn: getAccountProfile,
    staleTime: 30_000,
  });

  const profile = profileQuery.data?.profile ?? null;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) {
      setDraft({});
      return;
    }
    setDraft({ ...(profile.fields as Record<string, unknown>) } as Record<string, string>);
  }, [profile]);

  // Bounce away if we arrive here with a profile that's already complete or
  // for a role that doesn't need the gate (admin/embassy/labour).
  useEffect(() => {
    if (profileQuery.isLoading) return;
    if (!profile || profile.complete) {
      navigate("/", { replace: true });
    }
  }, [profile, profileQuery.isLoading, navigate]);

  const requiredKeys = useMemo(() => requiredKeysFor(profile), [profile]);

  const missingCount = useMemo(() => {
    return requiredKeys.filter((k) => !draft[k]?.trim()).length;
  }, [requiredKeys, draft]);

  const setField =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (saving) return;
    if (missingCount > 0) {
      toast.error(`Please fill in ${missingCount} more required field${missingCount === 1 ? "" : "s"}`);
      return;
    }
    setSaving(true);
    try {
      await updateAccountProfile(draft);
      toast.success("Profile completed");
      await queryClient.invalidateQueries({ queryKey: ["account_profile"] });
      await refresh();
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    logout();
    localStorage.setItem("mwmsys_logged_in", "false");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card rounded-2xl border border-border/60 shadow-xl overflow-hidden">
        <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(215,32%,22%)] to-[hsl(187,78%,25%)] px-6 py-7">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary uppercase tracking-widest">
                One more step
              </span>
            </div>
            <h1 className="text-xl font-bold text-[hsl(0,0%,100%)]">Complete your profile</h1>
            <p className="text-[hsl(210,20%,75%)] text-sm mt-1.5 max-w-md">
              We need a few more details before you can continue. This keeps your account
              verifiable by authorities and unlocks the full dashboard.
            </p>
          </div>
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/20 blur-3xl" />
        </div>

        <div className="p-6 space-y-6">
          {profileQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !profile ? (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
              <p className="text-sm font-medium text-foreground">No profile record found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please contact support — your signup appears to be incomplete.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Signed in as <span className="font-semibold text-foreground">{user?.name ?? user?.id}</span>
                </div>
                <Badge variant="secondary" className="uppercase text-[10px] tracking-wide">
                  {profile.kind}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.kind === "worker" && (
                  <>
                    <Field
                      label="Full Name"
                      value={draft.name ?? ""}
                      onChange={setField("name")}
                      required
                    />
                    <Field
                      label="Contact Number"
                      value={draft.contactNumber ?? ""}
                      onChange={setField("contactNumber")}
                      required
                    />
                    <Field
                      label="Passport Number"
                      value={draft.passportNumber ?? ""}
                      onChange={setField("passportNumber")}
                      required
                    />
                    <FieldArea
                      className="md:col-span-2"
                      label="Address"
                      value={draft.address ?? ""}
                      onChange={setField("address")}
                      required
                    />
                  </>
                )}

                {profile.kind === "employer" && (
                  <>
                    <Field
                      label="Company Name"
                      value={draft.companyName ?? ""}
                      onChange={setField("companyName")}
                      required
                    />
                    <Field
                      label="Contact Person"
                      value={draft.contactPerson ?? ""}
                      onChange={setField("contactPerson")}
                      required
                    />
                    <Field
                      label="Contact Person Phone"
                      value={draft.contactPersonPhone ?? ""}
                      onChange={setField("contactPersonPhone")}
                      required
                    />
                    <Field
                      label="Company Phone"
                      value={draft.companyPhone ?? ""}
                      onChange={setField("companyPhone")}
                    />
                    <FieldArea
                      className="md:col-span-2"
                      label="Company Address"
                      value={draft.address ?? ""}
                      onChange={setField("address")}
                      required
                    />
                  </>
                )}

                {profile.kind === "agency" && (
                  <>
                    <Field
                      label="Agent Name"
                      value={draft.agentName ?? ""}
                      onChange={setField("agentName")}
                      required
                    />
                    <Field
                      label="Organization Name"
                      value={draft.organizationName ?? ""}
                      onChange={setField("organizationName")}
                      required
                    />
                    <Field
                      label="Contact Number"
                      value={draft.contactNumber ?? ""}
                      onChange={setField("contactNumber")}
                      required
                    />
                    <Field
                      label="IC / Passport"
                      value={draft.icPassport ?? ""}
                      onChange={setField("icPassport")}
                      required
                    />
                  </>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
                <Button onClick={handleSave} disabled={saving || missingCount > 0}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving…" : missingCount > 0 ? `${missingCount} field${missingCount === 1 ? "" : "s"} left` : "Save & Continue"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
  required,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input value={value} onChange={onChange} />
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  className,
  required,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Textarea value={value} onChange={onChange} rows={3} />
    </div>
  );
}
