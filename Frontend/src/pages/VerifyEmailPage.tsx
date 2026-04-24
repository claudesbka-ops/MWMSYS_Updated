import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import { resendOtp, verifyEmail } from "@/services/otpService";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialUserId = searchParams.get("userId") ?? "";
  const initialEmail = searchParams.get("email") ?? "";

  const [userId, setUserId] = useState(initialUserId);
  const [email] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  const canSubmit = useMemo(
    () => userId.trim().length > 0 && /^[0-9]{6}$/.test(otp.trim()) && !submitting,
    [userId, otp, submitting]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const resp = await verifyEmail({ userId: userId.trim(), otp: otp.trim() });
      if (!resp?.access_token) {
        toast.error("Verification succeeded but no token returned. Please log in.");
        navigate("/login");
        return;
      }
      toast.success("Email verified. Welcome aboard.");
      navigate("/");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Invalid or expired code";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0 || resending) return;
    if (!userId.trim()) {
      toast.error("Enter your user ID first");
      return;
    }
    setResending(true);
    try {
      const resp = await resendOtp(userId.trim());
      const remaining = resp?.remainingSends ?? 0;
      if (resp?.smtpFallback) {
        toast.message("A new code has been generated. SMTP is not configured — ask the admin to check server logs.");
      } else {
        toast.success(
          remaining > 0
            ? `New code sent. ${remaining} resend${remaining === 1 ? "" : "s"} remaining this hour.`
            : "New code sent."
        );
      }
      setCooldown(30);
    } catch (err: any) {
      const status = Number(err?.response?.status ?? 0);
      const msg = err?.response?.data?.error ?? "Unable to resend code";
      toast.error(msg);
      if (status === 429) setCooldown(60);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        email
          ? `Enter the 6-digit code we sent to ${email}.`
          : "Enter the 6-digit code we emailed you."
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="userId">User Id</Label>
          <Input
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Your user ID"
            autoComplete="username"
            disabled={!!initialUserId}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="otp">6-digit code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="000000"
            autoComplete="one-time-code"
            className="tracking-[0.5em] text-center text-lg font-semibold"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Codes expire after 15 minutes. Check your spam folder if you don't see the email.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {submitting ? "Verifying…" : "Verify email"}
          </Button>

          <div className="flex items-center justify-between text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResend}
              disabled={cooldown > 0 || resending}
            >
              {resending
                ? "Sending…"
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend code"}
            </Button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to login
            </button>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}
