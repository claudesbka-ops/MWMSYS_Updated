import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { format, differenceInDays } from "date-fns";
import { CreditCard, Users, Building2, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface BillingStatus {
  plan: string;
  status: string;
  workersLimit: number;
  employersLimit: number;
  periodEnd: string | null;
  trialEnd: string | null;
  isTrialing: boolean;
}

export default function BillingDashboardPage() {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["billing_status"],
    queryFn: async () => {
      const res = await apiClient.get("/Api/Billing/Status");
      return res.data as BillingStatus;
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.get("/Api/Billing/Portal");
      return res.data as { portalUrl: string };
    },
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    },
    onError: () => {
      toast.error("Failed to open billing portal");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/Api/Billing/Cancel");
      return res.data as { cancelledAt: number };
    },
    onSuccess: () => {
      toast.success("Subscription will cancel at period end");
      statusQuery.refetch();
      setShowCancelConfirm(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to cancel subscription");
    },
  });

  const status = statusQuery.data;
  const isLoading = statusQuery.isLoading;

  const getStatusBadge = (planStatus: string) => {
    const configs: Record<string, { color: string; icon: any }> = {
      active: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      trialing: { color: "bg-blue-100 text-blue-800", icon: Clock },
      past_due: { color: "bg-red-100 text-red-800", icon: AlertTriangle },
      cancelling: { color: "bg-orange-100 text-orange-800", icon: Clock },
      cancelled: { color: "bg-gray-100 text-gray-800", icon: XCircle },
    };
    const config = configs[planStatus] || configs.cancelled;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {planStatus}
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  if (!status) {
    return <div className="container mx-auto p-6">Failed to load billing information</div>;
  }

  const planName = status.plan.charAt(0).toUpperCase() + status.plan.slice(1);
  const daysInTrial = status.trialEnd ? differenceInDays(new Date(status.trialEnd), new Date()) : 0;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold">Billing</h1>
      </div>

      {/* Current Plan Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl">{planName} Plan</CardTitle>
              <CardDescription className="mt-1">
                {getStatusBadge(status.status)}
              </CardDescription>
            </div>
            {status.isTrialing && (
              <Badge variant="outline" className="text-blue-600">
                {daysInTrial} days left in trial
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Workers</p>
                <p className="text-2xl font-bold">
                  Used / {status.workersLimit}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Employers</p>
                <p className="text-2xl font-bold">
                  Used / {status.employersLimit}
                </p>
              </div>
            </div>
          </div>

          {/* Billing Info */}
          {status.periodEnd && (
            <div className="text-sm text-muted-foreground">
              {status.status === "cancelling" ? (
                <p>Cancels on {format(new Date(status.periodEnd), "MMMM d, yyyy")}</p>
              ) : (
                <p>Next billing date: {format(new Date(status.periodEnd), "MMMM d, yyyy")}</p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending || status.plan === "free"}
          >
            {portalMutation.isPending ? "Opening..." : "Manage Payment Method"}
          </Button>

          {status.plan !== "free" && status.status !== "cancelling" ? (
            <Button
              variant="destructive"
              onClick={() => setShowCancelConfirm(true)}
              disabled={cancelMutation.isPending}
            >
              Cancel Subscription
            </Button>
          ) : status.status === "cancelling" ? (
            <Button variant="outline" disabled>
              Cancelling at period end
            </Button>
          ) : null}

          {status.plan !== "enterprise" && (
            <Button onClick={() => window.location.href = "/pricing"}>
              Upgrade Plan
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Cancel Confirmation */}
      {showCancelConfirm && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Cancel Subscription?</CardTitle>
            <CardDescription>
              Your subscription will remain active until the end of the current billing period, then downgrade to Free.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
