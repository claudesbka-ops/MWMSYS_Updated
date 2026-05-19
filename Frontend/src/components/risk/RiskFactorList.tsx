import { FileText, Scale, Shield } from "lucide-react";

interface RiskBreakdown {
  docScore: number;
  disputeScore: number;
  complianceScore: number;
  details: {
    expiredDocs: number;
    expiringDocs: number;
    missingDocs: number;
    activeDisputes: number;
    disputeSeverity: string | null;
  };
}

interface RiskFactorListProps {
  breakdown: RiskBreakdown;
}

function getScoreColor(score: number): string {
  if (score <= 8) return "bg-green-500";
  if (score <= 16) return "bg-amber-500";
  if (score <= 20) return "bg-orange-500";
  return "bg-red-500";
}

export function RiskFactorList({ breakdown }: RiskFactorListProps) {
  const factors = [
    {
      name: "Documents",
      icon: FileText,
      score: breakdown.docScore,
      max: 25,
      details: [
        breakdown.details.expiredDocs > 0 && `${breakdown.details.expiredDocs} expired`,
        breakdown.details.expiringDocs > 0 && `${breakdown.details.expiringDocs} expiring soon`,
        breakdown.details.missingDocs > 0 && `${breakdown.details.missingDocs} missing`,
      ].filter(Boolean),
    },
    {
      name: "Disputes",
      icon: Scale,
      score: breakdown.disputeScore,
      max: 25,
      details: [
        breakdown.details.activeDisputes > 0 && `${breakdown.details.activeDisputes} active`,
        breakdown.details.disputeSeverity === "critical" && "Critical severity",
        breakdown.details.disputeSeverity === "high" && "High severity",
      ].filter(Boolean),
    },
    {
      name: "Compliance",
      icon: Shield,
      score: breakdown.complianceScore,
      max: 25,
      details: [
        breakdown.complianceScore > 15 && "Critical alerts",
        breakdown.complianceScore > 10 && breakdown.complianceScore <= 15 && "High alerts",
        breakdown.complianceScore > 0 && breakdown.complianceScore <= 10 && "Medium alerts",
      ].filter(Boolean),
    },
  ];

  return (
    <div className="space-y-3">
      {factors.map((factor) => {
        const Icon = factor.icon;
        const colorClass = getScoreColor(factor.score);
        const percentage = (factor.score / factor.max) * 100;

        return (
          <div key={factor.name} className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                <Icon className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{factor.name}</span>
                  <span className={`text-sm font-semibold ${factor.score > 15 ? "text-red-600" : factor.score > 8 ? "text-amber-600" : "text-green-600"}`}>
                    {factor.score}/{factor.max}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full transition-all ${colorClass}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
            {factor.details.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {factor.details.map((detail, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 bg-white rounded text-slate-600 border border-slate-200"
                  >
                    {detail}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
