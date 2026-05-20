import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Auto-redirect to dashboard after 5 seconds
    const timer = setTimeout(() => {
      navigate("/dashboard");
    }, 5000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">🎉 Payment Successful!</CardTitle>
          <CardDescription>
            Your plan is now active. You can start using all premium features immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            You'll be redirected to the dashboard in a few seconds...
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            Go to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
