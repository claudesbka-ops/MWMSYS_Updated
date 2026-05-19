import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";

interface RiskScoreGaugeProps {
  workerId: string;
}

interface RiskData {
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  aiSummary: string | null;
  calculatedAt: string;
}

const levelConfig = {
  low: { color: "#22c55e", label: "LOW", bg: "bg-green-50", border: "border-green-200" },
  medium: { color: "#f59e0b", label: "MEDIUM", bg: "bg-amber-50", border: "border-amber-200" },
  high: { color: "#f97316", label: "HIGH", bg: "bg-orange-50", border: "border-orange-200" },
  critical: { color: "#ef4444", label: "CRITICAL", bg: "bg-red-50", border: "border-red-200" },
};

export function RiskScoreGauge({ workerId }: RiskScoreGaugeProps) {
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const res = await apiClient.get(`/Api/Risk/Score/${workerId}`);
        setRisk(res.data);
      } catch (err) {
        // No risk score yet
        setRisk(null);
      } finally {
        setLoading(false);
      }
    };
    fetchRisk();
  }, [workerId]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="w-24 h-24 mx-auto rounded-full bg-slate-200" />
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="text-center">
        <div className="w-24 h-24 mx-auto rounded-full border-4 border-slate-200 flex items-center justify-center">
          <span className="text-2xl text-slate-400">—</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">Not calculated</p>
      </div>
    );
  }

  const config = levelConfig[risk.riskLevel];
  const percentage = (risk.riskScore / 75) * 100;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={config.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color: config.color }}>
            {risk.riskScore}
          </span>
          <span className="text-[10px] text-slate-500">/75</span>
        </div>
      </div>
      <span
        className={`mt-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.border}`}
        style={{ color: config.color }}
      >
        {config.label}
      </span>
      {risk.aiSummary && (
        <p className="text-xs text-slate-600 mt-2 text-center max-w-[200px]">
          {risk.aiSummary}
        </p>
      )}
    </div>
  );
}
