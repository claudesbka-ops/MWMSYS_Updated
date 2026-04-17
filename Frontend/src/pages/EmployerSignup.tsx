import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

const SECTORS = ["Construction", "Manufacturing", "Services", "Agriculture", "Domestic"]; 

export default function EmployerSignup() {
  const navigate = useNavigate();
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
    attachmentName: "",
    password: "",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      !form.attachmentName.trim() ||
      !form.password.trim()
    ) {
      toast.error("Please fill all required (*) fields");
      return;
    }

    try {
      await apiClient.post("/signup", {
        userId: form.ssmRocRobNo.trim(),
        emailId: form.emailId.trim(),
        password: form.password,
        role: "employer",
      });
      toast.success("Account created");
      navigate("/login/employer");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Signup failed";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Employer Sign Up</CardTitle>
          <CardDescription>Register a company account (demo form)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employerName">Employer Name:*</Label>
                <Input id="employerName" value={form.employerName} onChange={(e) => setForm((p) => ({ ...p, employerName: e.target.value }))} placeholder="Employer Name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person:*</Label>
                <Input id="contactPerson" value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} placeholder="Contact Person" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Position:</Label>
                <Input id="position" value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} placeholder="Position" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailId">EmailId:*</Label>
                <Input id="emailId" value={form.emailId} onChange={(e) => setForm((p) => ({ ...p, emailId: e.target.value }))} placeholder="Email Address" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNo">Phone No:*</Label>
                <Input id="phoneNo" value={form.phoneNo} onChange={(e) => setForm((p) => ({ ...p, phoneNo: e.target.value }))} placeholder="Phone No" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssm">SSM/ROC/ROB No:*</Label>
                <Input id="ssm" value={form.ssmRocRobNo} onChange={(e) => setForm((p) => ({ ...p, ssmRocRobNo: e.target.value }))} placeholder="SSM/ROC/ROB No" />
              </div>

              <div className="space-y-2">
                <Label>Sector:</Label>
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
                <Label htmlFor="telephoneNo">Telephone No:*</Label>
                <Input id="telephoneNo" value={form.telephoneNo} onChange={(e) => setForm((p) => ({ ...p, telephoneNo: e.target.value }))} placeholder="Telephone No" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ic">Contact Person Ic No:*</Label>
                <Input id="ic" value={form.contactPersonIcNo} onChange={(e) => setForm((p) => ({ ...p, contactPersonIcNo: e.target.value }))} placeholder="Contact No" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hp">H/P Number:*</Label>
                <Input id="hp" value={form.hpNumber} onChange={(e) => setForm((p) => ({ ...p, hpNumber: e.target.value }))} placeholder="H/P Number" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fax">Fax No:</Label>
                <Input id="fax" value={form.faxNo} onChange={(e) => setForm((p) => ({ ...p, faxNo: e.target.value }))} placeholder="Fax No" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address:*</Label>
              <Textarea id="address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Address" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employmentDescription">Employment Description:</Label>
              <Textarea id="employmentDescription" value={form.employmentDescription} onChange={(e) => setForm((p) => ({ ...p, employmentDescription: e.target.value }))} placeholder="Employment Description" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachment">Attachment:*</Label>
              <Input
                id="attachment"
                type="file"
                onChange={(e) => setForm((p) => ({ ...p, attachmentName: e.target.files?.[0]?.name ?? "" }))}
              />
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
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/login/employer")}
              >
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
