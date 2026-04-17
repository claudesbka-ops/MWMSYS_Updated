import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

const DEPARTMENTS = ["Customer Service", "Admin", "Operations"];
const COUNTRIES = ["Malaysia", "Nepal", "Bangladesh", "Myanmar", "Indonesia"];
const STATUSES = ["Active", "Inactive"];
const TITLES = ["Mr", "Ms", "Mrs"];

export default function AgencySignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    organization: "",
    icOrPassport: "",
    emailId: "",
    dateOfBirth: "",
    department: "",
    country: "",
    contactNo: "",
    status: "",
    title: "",
    password: "",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.fullName.trim() ||
      !form.organization.trim() ||
      !form.icOrPassport.trim() ||
      !form.emailId.trim() ||
      !form.department ||
      !form.country ||
      !form.contactNo.trim() ||
      !form.status ||
      !form.password.trim()
    ) {
      toast.error("Please fill all required (*) fields");
      return;
    }

    try {
      await apiClient.post("/signup", {
        userId: form.icOrPassport.trim(),
        emailId: form.emailId.trim(),
        password: form.password,
        role: "agency",
      });
      toast.success("Account created");
      navigate("/login/agency");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Signup failed";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Agent Sign Up</CardTitle>
          <CardDescription>Register an agency/agent account (demo form)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name:*</Label>
                <Input id="fullName" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Full Name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization">Organization:*</Label>
                <Input id="organization" value={form.organization} onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))} placeholder="Organization" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="icOrPassport">IC/Passport:*</Label>
                <Input id="icOrPassport" value={form.icOrPassport} onChange={(e) => setForm((p) => ({ ...p, icOrPassport: e.target.value }))} placeholder="IC/Passport" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailId">Email Id:*</Label>
                <Input id="emailId" value={form.emailId} onChange={(e) => setForm((p) => ({ ...p, emailId: e.target.value }))} placeholder="Email Id" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth:</Label>
                <Input id="dob" value={form.dateOfBirth} onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))} placeholder="Date Of Birth" />
              </div>

              <div className="space-y-2">
                <Label>Department:*</Label>
                <Select value={form.department} onValueChange={(v) => setForm((p) => ({ ...p, department: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="--Select Department--" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Country *</Label>
                <Select value={form.country} onValueChange={(v) => setForm((p) => ({ ...p, country: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="--Select Country--" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNo">Contact No:*</Label>
                <Input id="contactNo" value={form.contactNo} onChange={(e) => setForm((p) => ({ ...p, contactNo: e.target.value }))} placeholder="Contact No" />
              </div>

              <div className="space-y-2">
                <Label>Status:*</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="--Select Status--" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title:</Label>
                <Select value={form.title} onValueChange={(v) => setForm((p) => ({ ...p, title: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="--Select Title--" />
                  </SelectTrigger>
                  <SelectContent>
                    {TITLES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password:*</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Password"
                autoComplete="new-password"
              />
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/login/agency")}>
                Do you want to Sign In?
              </Button>
              <Button type="submit" className="flex-1">Sign Up</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
