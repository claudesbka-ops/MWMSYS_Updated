import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

export default function LabourSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    userId: "",
    emailId: "",
    password: "",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.userId.trim() || !form.emailId.trim() || !form.password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      await apiClient.post("/signup", {
        userId: form.userId.trim(),
        emailId: form.emailId.trim(),
        password: form.password,
        role: "labour",
      });
      toast.success("Account created");
      navigate("/login/labour");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Signup failed";
      toast.error(msg);
    }
  };

  return (
    <AuthLayout title="Labour Department Signup" subtitle="Create a Labour Department account">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="userId">User Id</Label>
          <Input
            id="userId"
            value={form.userId}
            onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
            placeholder="labour_user"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emailId">Email Id</Label>
          <Input
            id="emailId"
            value={form.emailId}
            onChange={(e) => setForm((p) => ({ ...p, emailId: e.target.value }))}
            placeholder="labour@example.com"
            autoComplete="email"
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
            autoComplete="new-password"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/login/labour")}>
            Back to Login
          </Button>
          <Button type="submit" className="flex-1">
            Create Account
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
