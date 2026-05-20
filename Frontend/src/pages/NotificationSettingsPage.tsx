import { useState } from "react";
import { Bell, Mail, AlertTriangle, FileWarning, ShieldAlert, Clock, Send, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface NotificationPreferences {
  emailDocExpiry: boolean;
  emailComplianceAlerts: boolean;
  emailDisputes: boolean;
  emailRiskCritical: boolean;
  emailLeaveUpdates: boolean;
  inAppEnabled: boolean;
  alertDaysBefore: number;
}

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const [testEmailSending, setTestEmailSending] = useState(false);

  // Fetch preferences
  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: async () => {
      const response = await apiClient.get("/Api/Notifications/Preferences");
      return response.data.data as NotificationPreferences;
    },
  });

  // Update preferences mutation
  const updatePrefsMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const response = await apiClient.put("/Api/Notifications/Preferences", updates);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationPreferences"] });
      toast.success("Preferences saved");
    },
    onError: () => {
      toast.error("Failed to save preferences");
    },
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      // Get current user email from auth context or API
      const response = await apiClient.post("/Api/Notifications/TestEmail", {
        email: "user@example.com", // Will be replaced by backend with user's email
      });
      return response.data;
    },
    onMutate: () => {
      setTestEmailSending(true);
    },
    onSuccess: (data) => {
      setTestEmailSending(false);
      if (data.fallback) {
        toast.info("Email provider not configured - notification logged only");
      } else {
        toast.success("Test email sent!");
      }
    },
    onError: () => {
      setTestEmailSending(false);
      toast.error("Failed to send test email");
    },
  });

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    updatePrefsMutation.mutate({ [key]: !prefs[key] });
  };

  const handleDaysChange = (value: number[]) => {
    updatePrefsMutation.mutate({ alertDaysBefore: value[0] });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Failed to load preferences</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Notification Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure how and when you receive alerts and notifications
        </p>
      </div>

      <div className="space-y-6">
        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Choose which events send you an email alert
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-amber-500" />
                <div>
                  <Label className="font-medium">Document Expiry</Label>
                  <p className="text-sm text-muted-foreground">
                    Alerts when passports, permits, or insurance expire
                  </p>
                </div>
              </div>
              <Switch
                checked={prefs.emailDocExpiry}
                onCheckedChange={() => handleToggle("emailDocExpiry")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <div>
                  <Label className="font-medium">Critical Risk Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notifications for workers with critical risk scores
                  </p>
                </div>
              </div>
              <Switch
                checked={prefs.emailRiskCritical}
                onCheckedChange={() => handleToggle("emailRiskCritical")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileWarning className="w-4 h-4 text-orange-500" />
                <div>
                  <Label className="font-medium">Dispute Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Weekly reminders for unresolved disputes
                  </p>
                </div>
              </div>
              <Switch
                checked={prefs.emailDisputes}
                onCheckedChange={() => handleToggle("emailDisputes")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 text-purple-500" />
                <div>
                  <Label className="font-medium">Compliance Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Alerts when employer compliance scores drop
                  </p>
                </div>
              </div>
              <Switch
                checked={prefs.emailComplianceAlerts}
                onCheckedChange={() => handleToggle("emailComplianceAlerts")}
              />
            </div>
          </CardContent>
        </Card>

        {/* In-App Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              In-App Notifications
            </CardTitle>
            <CardDescription>
              Show notifications in the app header
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Enable In-App Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Display notification bell and dropdown in the header
                </p>
              </div>
              <Switch
                checked={prefs.inAppEnabled}
                onCheckedChange={() => handleToggle("inAppEnabled")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Alert Timing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Alert Timing
            </CardTitle>
            <CardDescription>
              How many days before expiry to send alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Days before expiry</span>
                <span className="font-medium">{prefs.alertDaysBefore} days</span>
              </div>
              <Slider
                value={[prefs.alertDaysBefore]}
                onValueChange={handleDaysChange}
                min={1}
                max={90}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Alerts will also be sent at 7 days and 1 day before expiry, and on the expiry date
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Test Email
            </CardTitle>
            <CardDescription>
              Send a test notification to verify your email configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => testEmailMutation.mutate()}
              disabled={testEmailSending || testEmailMutation.isPending}
              variant="outline"
            >
              {testEmailSending || testEmailMutation.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Status */}
        {updatePrefsMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Saving...
          </div>
        )}
        {updatePrefsMutation.isSuccess && (
          <div className="flex items-center justify-center gap-2 text-sm text-green-600">
            <Check className="w-4 h-4" />
            Changes saved
          </div>
        )}
      </div>
    </div>
  );
}
