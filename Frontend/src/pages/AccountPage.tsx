import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Mail, UserCircle, ShieldCheck, Crown, Sparkles, ArrowUpRight } from "lucide-react";
import { getAccountProfile } from "@/services/accountService";

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

        {/* Placeholder for Batch E profile editor */}
        <div className="bg-card rounded-2xl border border-dashed border-border/60 p-6">
          <div className="text-sm font-semibold text-foreground">Profile details</div>
          <p className="text-xs text-muted-foreground mt-1">
            Editable fields (photo, phone, address, IC/passport) arrive in the next release.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
