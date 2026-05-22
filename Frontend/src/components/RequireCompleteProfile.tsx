import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAccountProfile } from "@/services/accountService";

/**
 * Gate that keeps worker / employer / agency accounts on /complete-profile
 * until the backend reports their role-specific profile as complete. Other
 * roles (admin, embassy, labour) pass through unchanged.
 *
 * The check is skipped on a small allow-list of routes so users can still
 * reach the complete-profile page itself, the auth flow, and public pages.
 */
const SKIP_PATHS = [
  "/complete-profile",
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/logout",
  "/blog",
];

export default function RequireCompleteProfile({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isLoggedIn = typeof window !== "undefined" && localStorage.getItem("mwmsys_logged_in") === "true";

  const profileQuery = useQuery({
    queryKey: ["account_profile"],
    queryFn: getAccountProfile,
    enabled: isLoggedIn,
    staleTime: 30_000,
    retry: false,
  });

  const profile = profileQuery.data?.profile ?? null;

  // While the profile is still loading on the very first render we let the
  // children render; the AccountPage / dashboard views already handle their
  // own loading states, so there's no flash of blocked content.
  const needsGate = !!profile && profile.complete === false;
  const pathname = location.pathname;
  const isSkipped = SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    // No-op effect kept for future instrumentation if we ever want to log
    // how often the gate redirects.
  }, [needsGate, pathname]);

  if (isLoggedIn && needsGate && !isSkipped) {
    return <Navigate to="/complete-profile" replace state={{ from: pathname }} />;
  }

  return <>{children}</>;
}
