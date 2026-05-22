import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthLayout from "@/components/AuthLayout";
import { verify2FA, TEMP_TOKEN_KEY } from "@/services/authService";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";

const RESEND_SECONDS = 30;

export default function TwoFAVerifyPage() {
  const navigate = useNavigate();
  const { setCurrentRole } = useRole();
  const { refresh: refreshAuth } = useAuth();

  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionStorage.getItem(TEMP_TOKEN_KEY)) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const startCooldown = () => {
    setCooldown(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setSubmitting(true);
    try {
      await verify2FA(otp.trim());
      localStorage.setItem("mwmsys_logged_in", "true");
      await refreshAuth();
      const role = (await import("@/services/apiClient")).getAccessToken();
      if (role) {
        try {
          const parts = role.split(".");
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          setCurrentRole(payload.appRole ?? "worker");
        } catch {
          // ignore, default role
        }
      }
      toast.success("Verified! Welcome back.");
      navigate("/");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Invalid or expired code";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    toast.info("Resend is not available — please log in again to receive a new code.");
    startCooldown();
  };

  return (
    <AuthLayout
      title="Two-Factor Authentication"
      subtitle="Enter the 6-digit code sent to your email"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center text-2xl tracking-[0.5em] font-mono"
            autoFocus
          />
          <p className="text-xs text-muted-foreground text-center">
            Code expires in 5 minutes. Check your inbox.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={submitting || otp.length !== 6}>
          {submitting ? "Verifying…" : "Verify"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full text-xs"
          disabled={cooldown > 0}
          onClick={handleResend}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => { sessionStorage.removeItem(TEMP_TOKEN_KEY); navigate("/login"); }}
        >
          Back to Login
        </Button>
      </form>
    </AuthLayout>
  );
}
