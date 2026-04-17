import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRole, type UserRole } from "@/contexts/RoleContext";

export default function ProtectedRoute({
  allow,
  children,
}: {
  allow: UserRole[];
  children: ReactNode;
}) {
  const { currentRole } = useRole();

  if (!allow.includes(currentRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
