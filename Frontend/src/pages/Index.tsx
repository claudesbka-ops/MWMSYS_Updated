import DashboardLayout from "@/components/DashboardLayout";
import { useRole } from "@/contexts/RoleContext";
import AdminView from "@/components/views/AdminView";
import EmployerView from "@/components/views/EmployerView";
import WorkerView from "@/components/views/WorkerView";
import EmbassyView from "@/components/views/EmbassyView";
import LabourDeptView from "@/components/views/LabourDeptView";

export default function HomePage() {
  const { currentRole } = useRole();

  const renderView = () => {
    switch (currentRole) {
      case "admin":
        return <AdminView title="Mission Control" />;
      case "agency":
        return <AdminView title="Agency Portal" />;
      case "employer":
        return <EmployerView />;
      case "worker":
        return <WorkerView />;
      case "embassy_source":
        return <EmbassyView variant="source" />;
      case "embassy_destination":
        return <EmbassyView variant="destination" />;
      case "labour":
        return <LabourDeptView />;
      default:
        return <AdminView />;
    }
  };

  return (
    <DashboardLayout>
      {renderView()}
    </DashboardLayout>
  );
}
