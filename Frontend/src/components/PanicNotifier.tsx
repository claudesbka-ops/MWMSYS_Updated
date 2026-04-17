import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getLatestPanic } from "@/services/panicService";
import { useRole } from "@/contexts/RoleContext";

export default function PanicNotifier() {
  const navigate = useNavigate();
  const { currentRole } = useRole();
  const lastSeenIdRef = useRef<number>(Number(localStorage.getItem("mwmsys_last_panic_id") ?? 0));

  const isAdminLevel =
    currentRole === "admin" ||
    currentRole === "embassy_source" ||
    currentRole === "embassy_destination" ||
    currentRole === "labour";

  const { data } = useQuery({
    queryKey: ["panic_latest", isAdminLevel],
    enabled: isAdminLevel,
    queryFn: async () => {
      const sinceId = lastSeenIdRef.current;
      return getLatestPanic({ sinceId });
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!isAdminLevel) return;
    if (!data || data.length === 0) return;

    const newest = data[data.length - 1];
    if (!newest?.ProblemAndActionId) return;

    lastSeenIdRef.current = Number(newest.ProblemAndActionId);
    localStorage.setItem("mwmsys_last_panic_id", String(lastSeenIdRef.current));

    const workerName = (newest.MemberName ?? newest.FullName ?? "Unknown").toString();
    const passport = (newest.PassportNumber ?? "").toString();
    const employer = (newest.EmployerName ?? "").toString();

    toast.error("Panic Alert", {
      description: `${workerName}${passport ? ` (${passport})` : ""}${employer ? ` · ${employer}` : ""}`,
      action: {
        label: "Respond Now",
        onClick: () => navigate(`/incident/${newest.ProblemAndActionId}`),
      },
      duration: 10000,
    });
  }, [data, isAdminLevel, navigate]);

  return null;
}
