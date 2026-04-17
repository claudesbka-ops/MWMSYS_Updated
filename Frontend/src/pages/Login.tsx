import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import { useRole } from "@/contexts/RoleContext";

export default function Login() {
  const navigate = useNavigate();
  const { setCurrentRole } = useRole();

  const demoLogin = (role: Parameters<typeof setCurrentRole>[0]) => {
    setCurrentRole(role);
    localStorage.setItem("mwmsys_logged_in", "true");
    localStorage.removeItem("mwmsys_worker_passport");
    localStorage.removeItem("mwmsys_employer_name");
    navigate("/");
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Choose your stakeholder access to continue"
    >
      <div className="space-y-3">
        <Button className="w-full h-11" onClick={() => navigate("/login/admin")}>
          Admin Login
        </Button>
        <Button className="w-full h-11" onClick={() => navigate("/login/worker")}>
          Worker Login
        </Button>
        <Button className="w-full h-11" onClick={() => navigate("/login/employer")}>
          Employer Login
        </Button>
        <Button className="w-full h-11" onClick={() => navigate("/login/agency")}>
          Agency Login
        </Button>

        <div className="pt-4 mt-4 border-t border-border/50 space-y-3">
          <Button variant="outline" className="w-full" onClick={() => navigate("/login/embassy-source")}>
            Embassy (Source) Login
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/login/embassy-destination")}>
            Embassy (Destination) Login
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/login/labour")}>
            Labour Department Login
          </Button>
        </div>

        <div className="pt-4 mt-4 border-t border-border/50 space-y-3">
          <Button variant="outline" className="w-full" onClick={() => navigate("/signup")}>
            Create an account
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => navigate("/panic")}>
            Demo: Panic Button
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
