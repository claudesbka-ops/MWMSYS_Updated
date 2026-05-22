import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "sonner";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { login, EmailNotVerifiedError, TwoFARequiredError } from "@/services/authService";

export default function EmbassyLogin({ variant }: { variant: "source" | "destination" }) {
  const navigate = useNavigate();
  const { refresh: refreshAuth } = useAuth();
  const { setCurrentRole } = useRole();
  const [form, setForm] = useState({
    emailId: "",
    password: "",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.emailId.trim() || !form.password.trim()) {
      toast.error("Enter Email Id and Password");
      return;
    }

    try {
      await login({
        userName: form.emailId.trim(),
        password: form.password,
      });

      toast.success("Embassy login successful");
      setCurrentRole(variant === "source" ? "embassy_source" : "embassy_destination");
      localStorage.setItem("mwmsys_logged_in", "true");
      navigate("/embassy-dashboard");
      void refreshAuth();
    } catch (err: any) {
      if (err instanceof TwoFARequiredError) {
        navigate("/login/verify-2fa");
        return;
      }
      if (err instanceof EmailNotVerifiedError) {
        toast.message("Please verify your email to continue");
        const qs = new URLSearchParams();
        qs.set("userId", err.userId);
        if (err.emailId) qs.set("email", err.emailId);
        navigate(`/verify-email?${qs.toString()}`);
        return;
      }
      const msg = err?.response?.data?.error ?? "Invalid credentials";
      toast.error(msg);
    }
  };

  return (
    <AuthLayout
      title={variant === "source" ? "Embassy (Source) Sign in" : "Embassy (Destination) Sign in"}
      subtitle="Login with your Embassy credentials"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="emailId">Email Id</Label>
          <Input
            id="emailId"
            value={form.emailId}
            onChange={(e) => setForm((p) => ({ ...p, emailId: e.target.value }))}
            placeholder="Email Address"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            placeholder="Password"
            autoComplete="current-password"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() =>
              navigate(variant === "source" ? "/signup/embassy-source" : "/signup/embassy-destination")
            }
          >
            Create account
          </Button>
          <Button type="submit" className="flex-1">
            Login
          </Button>
        </div>

        <div className="pt-2">
          <Button type="button" variant="secondary" className="w-full" onClick={() => navigate("/login")}>
            Back to Login Options
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
