import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    userId: "",
    emailId: "",
    passportNo: "",
    password: "",
    role: "worker" as
      | "worker"
      | "employer"
      | "agency"
      | "embassy_source"
      | "embassy_destination"
      | "labour"
      | "admin",
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.userId.trim() || !form.emailId.trim() || !form.password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (form.role === "worker" && !form.passportNo.trim()) {
      toast.error("Passport Number is required for worker signup");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post("/signup", {
        userId: form.userId.trim(),
        emailId: form.emailId.trim(),
        passportNo: form.role === "worker" ? form.passportNo.trim() : undefined,
        password: form.password,
        role: form.role,
      });
      const body = res.data as { userId?: string; emailId?: string };
      toast.success("Verification email sent");
      const qs = new URLSearchParams();
      qs.set("userId", body?.userId ?? form.userId.trim());
      if (body?.emailId || form.emailId) qs.set("email", body?.emailId ?? form.emailId.trim());
      navigate(`/verify-email?${qs.toString()}`);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Signup failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Register a stakeholder profile for MWMSYS"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="userId">User Id</Label>
          <Input
            id="userId"
            value={form.userId}
            onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
            placeholder="user123"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emailId">Email Id</Label>
          <Input
            id="emailId"
            value={form.emailId}
            onChange={(e) => setForm((p) => ({ ...p, emailId: e.target.value }))}
            placeholder="user123@example.com"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v as any }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="employer">Employer</SelectItem>
              <SelectItem value="agency">Agency</SelectItem>
              <SelectItem value="embassy_source">Embassy (Source)</SelectItem>
              <SelectItem value="embassy_destination">Embassy (Destination)</SelectItem>
              <SelectItem value="labour">Labour Department</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.role === "worker" ? (
          <div className="space-y-2">
            <Label htmlFor="passportNo">Passport Number</Label>
            <Input
              id="passportNo"
              value={form.passportNo}
              onChange={(e) => setForm((p) => ({ ...p, passportNo: e.target.value }))}
              placeholder="Passport Number"
              autoComplete="off"
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            placeholder="Password"
            autoComplete="new-password"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/login")}>
            Back to Login
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? "Creating…" : "Create Account"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
