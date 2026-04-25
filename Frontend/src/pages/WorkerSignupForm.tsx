import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/services/apiClient";
import { listPublicEmployers } from "@/services/relationshipService";
import { toast } from "sonner";

export default function WorkerSignupForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    userId: "",
    fullName: "",
    emailId: "",
    passportNo: "",
    password: "",
    employerId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const employersQuery = useQuery({
    queryKey: ["public_employers"],
    queryFn: () => listPublicEmployers(),
  });

  const employers = employersQuery.data ?? [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.userId.trim() || !form.emailId.trim() || !form.password.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!form.passportNo.trim()) {
      toast.error("Passport number is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post("/signup", {
        userId: form.userId.trim(),
        emailId: form.emailId.trim(),
        passportNo: form.passportNo.trim(),
        password: form.password,
        role: "worker",
        name: form.fullName.trim() || undefined,
        employerId: form.employerId || undefined,
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
      title="Worker registration"
      subtitle="Register as a migrant worker on MWMSYS"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="userId">User Id</Label>
          <Input
            id="userId"
            value={form.userId}
            onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
            placeholder="worker123"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
            placeholder="Full name as per passport"
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emailId">Email</Label>
          <Input
            id="emailId"
            type="email"
            value={form.emailId}
            onChange={(e) => setForm((p) => ({ ...p, emailId: e.target.value }))}
            placeholder="worker@example.com"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="passportNo">Passport Number</Label>
          <Input
            id="passportNo"
            value={form.passportNo}
            onChange={(e) => setForm((p) => ({ ...p, passportNo: e.target.value }))}
            placeholder="A12345678"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label>Employer</Label>
          <Select
            value={form.employerId || "__none__"}
            onValueChange={(v) => setForm((p) => ({ ...p, employerId: v === "__none__" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={employersQuery.isLoading ? "Loading employers…" : "Select your employer (optional)"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No employer yet</SelectItem>
              {employers.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.companyName || e.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            You will appear under this employer immediately after registration.
          </p>
        </div>

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
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/login/worker")}>
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
