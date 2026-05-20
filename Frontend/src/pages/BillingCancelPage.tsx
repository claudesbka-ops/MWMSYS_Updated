import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingCancelPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Checkout Cancelled</CardTitle>
          <CardDescription>
            No charges were made. You can subscribe anytime from Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your current plan remains unchanged. You can upgrade whenever you're ready.
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/pricing")} className="flex-1">
            Back to Pricing
          </Button>
          <Button onClick={() => navigate("/dashboard")} className="flex-1">
            Go to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
