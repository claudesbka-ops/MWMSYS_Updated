import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

const SECTORS = ["Construction", "Manufacturing", "Services", "Agriculture", "Domestic"]; 

export default function EmployerSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    employerName: "",
    address: "",
    contactPerson: "",
    position: "",
    emailId: "",
    phoneNo: "",
    ssmRocRobNo: "",
    sector: "",
    telephoneNo: "",
    contactPersonIcNo: "",
    hpNumber: "",
    faxNo: "",
    employmentDescription: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (
      !form.employerName.trim() ||
      !form.address.trim() ||
      !form.contactPerson.trim() ||
      !form.emailId.trim() ||
      !form.phoneNo.trim() ||
      !form.ssmRocRobNo.trim() ||
      !form.telephoneNo.trim() ||
      !form.contactPersonIcNo.trim() ||
      !form.hpNumber.trim() ||
      !form.password.trim()
    ) {
      toast.error("Please fill all required (*) fields");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post("/signup", {
        userId: form.ssmRocRobNo.trim(),
        emailId: form.emailId.trim(),
        password: form.password,
        role: "employer",
        employerName: form.employerName.trim(),
        address: form.address.trim(),
        companyPhone: form.telephoneNo.trim() || form.phoneNo.trim(),
        ssmNumber: form.ssmRocRobNo.trim(),
        sector: form.sector,
        contactPersonName: form.contactPerson.trim(),
        contactPersonPosition: form.position.trim(),
        contactPersonIc: form.contactPersonIcNo.trim(),
        contactPersonEmail: form.emailId.trim(),
        contactPersonPhone: form.hpNumber.trim() || form.phoneNo.trim(),
      });
      toast.success("Account created");
      navigate("/login/employer");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Signup failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const canNextStep1 =
    !!form.employerName.trim() &&
    !!form.ssmRocRobNo.trim() &&
    !!form.sector &&
    !!form.telephoneNo.trim() &&
    !!form.address.trim();

  const canNextStep2 =
    !!form.contactPerson.trim() &&
    !!form.contactPersonIcNo.trim() &&
    !!form.hpNumber.trim() &&
    !!form.emailId.trim() &&
    !!form.phoneNo.trim() &&
    !!form.password.trim();

  return (
    <AuthLayout title="Employer Onboarding" subtitle={`Step ${step} of 2 · Create your employer account`}>
      <form onSubmit={onSubmit} className="space-y-6">
        {step === 1 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employerName">Company Name:*</Label>
                <Input id="employerName" value={form.employerName} onChange={(e) => setForm((p) => ({ ...p, employerName: e.target.value }))} placeholder="Company Name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ssm">SSM/ROC/ROB No:*</Label>
                <Input id="ssm" value={form.ssmRocRobNo} onChange={(e) => setForm((p) => ({ ...p, ssmRocRobNo: e.target.value }))} placeholder="SSM/ROC/ROB No" />
              </div>
              <div className="space-y-2">
                <Label>Sector:*</Label>
                <Select value={form.sector} onValueChange={(v) => setForm((p) => ({ ...p, sector: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="--Select--" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephoneNo">Company Phone:*</Label>
                <Input id="telephoneNo" value={form.telephoneNo} onChange={(e) => setForm((p) => ({ ...p, telephoneNo: e.target.value }))} placeholder="Company Phone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Company Address:*</Label>
              <Textarea id="address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Address" />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/login/employer")}>
                Do you want to Sign In?
              </Button>
              <Button type="button" className="flex-1" disabled={!canNextStep1} onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person Name:*</Label>
                <Input id="contactPerson" value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} placeholder="Contact Person" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ic">Contact Person IC/Passport:*</Label>
                <Input id="ic" value={form.contactPersonIcNo} onChange={(e) => setForm((p) => ({ ...p, contactPersonIcNo: e.target.value }))} placeholder="IC/Passport" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hp">Contact Person Phone:*</Label>
                <Input id="hp" value={form.hpNumber} onChange={(e) => setForm((p) => ({ ...p, hpNumber: e.target.value }))} placeholder="Phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position:</Label>
                <Input id="position" value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} placeholder="Position" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailId">Email:*</Label>
                <Input id="emailId" value={form.emailId} onChange={(e) => setForm((p) => ({ ...p, emailId: e.target.value }))} placeholder="Email Address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNo">Alternate Phone:*</Label>
                <Input id="phoneNo" value={form.phoneNo} onChange={(e) => setForm((p) => ({ ...p, phoneNo: e.target.value }))} placeholder="Phone" />
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
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={!canNextStep2 || submitting}>
                {submitting ? "Creating…" : "Create Account"}
              </Button>
            </div>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
