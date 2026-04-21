import DashboardLayout from "@/components/DashboardLayout";
import { useRole } from "@/contexts/RoleContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Check, CreditCard, Headphones, ShieldCheck, Sparkles } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import { getSubscriptionMe } from "@/services/subscriptionService";
import { useEffect, useMemo, useState } from "react";

type SubscriptionResponse = {
  planType: string;
  status: string;
  endDate?: string | null;
};

const PLANS = [
  {
    key: "Free",
    title: "Free",
    subtitle: "Start and onboard your team",
    features: ["Worker onboarding", "Company profile", "Basic listings"],
    highlights: ["Great for small teams", "No credit card required"],
  },
  {
    key: "Pro",
    title: "Pro",
    subtitle: "Everything you need to run day-to-day operations",
    features: ["Attendance & roster", "Leave management", "Payroll uploads", "Incident history & approvals", "Live tracking (optional)"],
    highlights: ["Most popular", "Priority support"],
    recommended: true,
  },
  {
    key: "Enterprise",
    title: "Enterprise",
    subtitle: "For large organizations and advanced compliance",
    features: ["Advanced compliance", "Custom reporting", "Dedicated onboarding", "SLA & dedicated support"],
    highlights: ["Custom contract", "Custom integrations"],
  },
];

export default function PricingPage() {
  const { currentRole } = useRole();
  const [annual, setAnnual] = useState(true);

  const subscriptionQuery = useQuery({
    queryKey: ["subscription_me"],
    queryFn: getSubscriptionMe,
    enabled: currentRole === "agency" || currentRole === "employer",
  });

  const purchaseMutation = useMutation({
    mutationFn: async (planType: string) => {
      if (planType.toLowerCase() === "free") {
        throw new Error("Free plan does not require checkout");
      }

      const origin = window.location.origin;
      const successUrl = `${origin}/pricing?checkout=success`;
      const cancelUrl = `${origin}/pricing?checkout=cancel`;

      const res = await apiClient.post("/Api/subscription/checkout", { planType, successUrl, cancelUrl });
      return res.data as { url?: string };
    },
    onSuccess: async (data) => {
      const url = (data as any)?.url;
      if (url && typeof url === "string") {
        window.location.href = url;
        return;
      }
      toast.error("No checkout URL returned");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? "Unable to update subscription";
      toast.error(msg);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = (params.get("checkout") ?? "").toLowerCase();
    if (checkout === "success") {
      toast.success("Payment received. Updating subscription...");
      subscriptionQuery.refetch().catch(() => undefined);
    } else if (checkout === "cancel") {
      toast.message("Payment cancelled");
    }
  }, []);

  const currentPlan = subscriptionQuery.data?.planType ?? "Free";
  const status = subscriptionQuery.data?.status ?? "Active";
  const endDate = subscriptionQuery.data?.endDate ?? null;

  const prices = useMemo(() => {
    const proMonthly = 199;
    const proAnnual = 1990;
    return {
      Free: { label: "RM 0", sub: "Forever" },
      Pro: annual ? { label: `RM ${proAnnual}`, sub: "Per year" } : { label: `RM ${proMonthly}`, sub: "Per month" },
      Enterprise: { label: "Custom", sub: "Let’s talk" },
    } as Record<string, { label: string; sub: string }>;
  }, [annual]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Premium plans for agencies & employers
              </div>
              <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-foreground">Pricing that scales with your workforce</h2>
              <p className="mt-2 text-sm md:text-base text-muted-foreground">
                Pick a plan that fits today. Upgrade anytime. Payments are handled securely with Stripe.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-2xl border bg-background/60 px-3 py-2">
                  <span className={`text-xs font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
                  <Switch checked={annual} onCheckedChange={setAnnual} />
                  <span className={`text-xs font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>Annual</span>
                  <Badge variant="secondary" className="ml-1">Save</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Current plan: <span className="font-semibold text-foreground">{currentPlan}</span> ({status}{endDate ? `, until ${new Date(endDate).toLocaleDateString()}` : ""})
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:w-[360px]">
              <div className="rounded-2xl border bg-background/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Secure billing
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Stripe Checkout, subscription lifecycle managed automatically.</p>
              </div>
              <div className="rounded-2xl border bg-background/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Headphones className="h-4 w-4 text-primary" />
                  Support
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Pro includes priority support. Enterprise includes SLA options.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => {
            const isCurrent = p.key === currentPlan;
            const isRecommended = !!(p as any).recommended;
            const price = prices[p.key]?.label ?? "";
            const priceSub = prices[p.key]?.sub ?? "";

            const canPurchaseRole = currentRole === "agency" || currentRole === "employer";
            const isPurchasable = p.key.toLowerCase() !== "enterprise" && p.key.toLowerCase() !== "free";
            const disabled = !canPurchaseRole || isCurrent || purchaseMutation.isPending || !isPurchasable;

            return (
              <Card
                key={p.key}
                className={`relative overflow-hidden rounded-3xl ${
                  isRecommended ? "border-primary/60 shadow-lg shadow-primary/10" : "border-border/60"
                }`}
              >
                {isRecommended && (
                  <div className="absolute right-4 top-4">
                    <Badge className="rounded-full">Recommended</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {p.title}
                    {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                  </CardTitle>
                  <CardDescription>{p.subtitle}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-3xl font-bold text-foreground">{price}</div>
                      <div className="text-xs text-muted-foreground mt-1">{priceSub}</div>
                    </div>
                    {p.key === "Pro" && annual ? (
                      <Badge variant="secondary" className="h-fit">Best value</Badge>
                    ) : null}
                  </div>

                  <div className="mt-5 space-y-2">
                    {(p.highlights ?? []).map((h) => (
                      <div key={h} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="w-4 h-4 text-primary" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 h-px bg-border" />

                  <div className="mt-5 space-y-2">
                    {p.features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 w-4 h-4 text-success" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  {p.key === "Enterprise" ? (
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl"
                      onClick={() => (window.location.href = "mailto:sales@mwmsys.com?subject=Enterprise%20Plan%20Request")}
                    >
                      Contact Sales
                    </Button>
                  ) : (
                    <Button
                      className={`w-full rounded-2xl ${isRecommended && !isCurrent ? "shadow-sm" : ""}`}
                      disabled={disabled}
                      onClick={() => purchaseMutation.mutate(p.key)}
                    >
                      <CreditCard className="w-4 h-4" />
                      {isCurrent ? "Current Plan" : p.key === "Free" ? "Included" : "Upgrade"}
                    </Button>
                  )}

                  {!canPurchaseRole ? (
                    <div className="text-xs text-muted-foreground">Only agency/employer accounts can purchase.</div>
                  ) : null}
                  {p.key === "Free" ? (
                    <div className="text-xs text-muted-foreground">Free plan is always available.</div>
                  ) : null}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Feature comparison (quick)</CardTitle>
              <CardDescription>What you get when you upgrade to Pro.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="font-semibold text-muted-foreground">Feature</div>
                <div className="font-semibold text-muted-foreground">Free</div>
                <div className="font-semibold text-muted-foreground">Pro</div>

                {[
                  { name: "Worker onboarding", free: true, pro: true },
                  { name: "Attendance", free: false, pro: true },
                  { name: "Leave management", free: false, pro: true },
                  { name: "Payroll uploads", free: false, pro: true },
                  { name: "Incident history", free: false, pro: true },
                ].map((r) => (
                  <div key={r.name} className="contents">
                    <div className="py-2 text-foreground">{r.name}</div>
                    <div className="py-2">{r.free ? <Check className="h-4 w-4 text-success" /> : <span className="text-muted-foreground">—</span>}</div>
                    <div className="py-2">{r.pro ? <Check className="h-4 w-4 text-success" /> : <span className="text-muted-foreground">—</span>}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>FAQ</CardTitle>
              <CardDescription>Common questions about billing & upgrades.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>Can I upgrade later?</AccordionTrigger>
                  <AccordionContent>Yes. You can upgrade anytime from this page.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>How do payments work?</AccordionTrigger>
                  <AccordionContent>Payments are processed via Stripe Checkout. After payment, you’ll be redirected back to this page.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Do you offer invoicing for Enterprise?</AccordionTrigger>
                  <AccordionContent>Yes. Contact sales and we’ll set up an Enterprise agreement and billing method.</AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 bg-muted/40 border border-border/60 rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">
            Payments are handled via Stripe Checkout. After successful payment you will be redirected back here.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
