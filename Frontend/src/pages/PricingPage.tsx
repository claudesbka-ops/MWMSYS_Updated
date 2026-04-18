import DashboardLayout from "@/components/DashboardLayout";
import { useRole } from "@/contexts/RoleContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, CreditCard } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import { getSubscriptionMe } from "@/services/subscriptionService";

type SubscriptionResponse = {
  planType: string;
  status: string;
  endDate?: string | null;
};

const PLANS = [
  {
    key: "Free",
    title: "Free",
    price: "RM 0",
    subtitle: "Start and onboard your team",
    features: ["Create worker accounts", "Complete company profile", "View basic listings"],
  },
  {
    key: "Pro",
    title: "Pro",
    price: "RM 199 / mo",
    subtitle: "Unlock HRMS core",
    features: ["Attendance", "Leave management", "Payroll uploads", "Incident history"],
  },
  {
    key: "Enterprise",
    title: "Enterprise",
    price: "Custom",
    subtitle: "For large operations",
    features: ["Advanced compliance", "Custom reporting", "Dedicated support"],
  },
];

export default function PricingPage() {
  const { currentRole } = useRole();

  const subscriptionQuery = useQuery({
    queryKey: ["subscription_me"],
    queryFn: getSubscriptionMe,
    enabled: currentRole === "agency" || currentRole === "employer",
  });

  const purchaseMutation = useMutation({
    mutationFn: async (planType: string) => {
      const res = await apiClient.post("/Api/subscription/purchase", { planType });
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Subscription updated");
      await subscriptionQuery.refetch();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? "Unable to update subscription";
      toast.error(msg);
    },
  });

  const currentPlan = subscriptionQuery.data?.planType ?? "Free";
  const status = subscriptionQuery.data?.status ?? "Active";

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Pricing & Subscription</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Current plan: <span className="font-semibold text-foreground">{currentPlan}</span> ({status})
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => {
            const isCurrent = p.key === currentPlan;
            return (
              <div key={p.key} className={`bg-card rounded-2xl border p-6 ${isCurrent ? "border-primary/60" : "border-border/60"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{p.subtitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{p.price}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-success" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <button
                    disabled={isCurrent || purchaseMutation.isPending || (currentRole !== "agency" && currentRole !== "employer")}
                    onClick={() => purchaseMutation.mutate(p.key)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isCurrent
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    {isCurrent ? "Current Plan" : "Choose Plan"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 bg-muted/40 border border-border/60 rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">
            Payment gateway flow (card/bank/checkout) will be added next. For now, choosing a plan simulates activation.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
