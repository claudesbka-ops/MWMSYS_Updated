import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

interface RiskWorker {
  workerId: string;
  workerName: string | null;
  score: number;
  level: "low" | "medium" | "high" | "critical";
  topFactor: string;
}

interface WorkerRiskTableProps {
  workers: RiskWorker[];
  isLoading?: boolean;
  onRecalculate?: (workerId: string) => Promise<void>;
}

const levelConfig = {
  low: { cls: "bg-green-100 text-green-800 border-green-200" },
  medium: { cls: "bg-amber-100 text-amber-800 border-amber-200" },
  high: { cls: "bg-orange-100 text-orange-800 border-orange-200" },
  critical: { cls: "bg-red-100 text-red-800 border-red-200" },
};

export function WorkerRiskTable({ workers, isLoading, onRecalculate }: WorkerRiskTableProps) {
  const [recalculating, setRecalculating] = useState<string | null>(null);

  const handleRecalculate = async (workerId: string) => {
    setRecalculating(workerId);
    try {
      await apiClient.post(`/Api/Risk/Calculate/${workerId}`);
      toast.success("Risk score recalculated");
      onRecalculate?.(workerId);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to recalculate");
    } finally {
      setRecalculating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Worker</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Risk Score</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Level</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Top Factor</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No risk scores calculated yet. Click "Calculate All" to begin.
                </td>
              </tr>
            ) : (
              workers.map((w) => {
                const config = levelConfig[w.level];
                return (
                  <tr key={w.workerId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{w.workerName || w.workerId}</div>
                      <div className="text-xs text-slate-500">{w.workerId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              w.level === "critical"
                                ? "bg-red-500"
                                : w.level === "high"
                                ? "bg-orange-500"
                                : w.level === "medium"
                                ? "bg-amber-500"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${(w.score / 75) * 100}%` }}
                          />
                        </div>
                        <span className="font-semibold text-slate-700">{w.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${config.cls}`}>
                        {w.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{w.topFactor}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRecalculate(w.workerId)}
                        disabled={recalculating === w.workerId}
                      >
                        <RefreshCw className={`w-4 h-4 ${recalculating === w.workerId ? "animate-spin" : ""}`} />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
