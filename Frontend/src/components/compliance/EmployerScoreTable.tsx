import { useState } from "react";
import { ChevronDown, ChevronUp, Building2, AlertTriangle, Clock } from "lucide-react";

interface EmployerScore {
  Id: number;
  Employer_Id: string;
  Score: number;
  Total_Workers: number;
  Expired_Docs: number;
  Expiring_Soon: number;
  Missing_Docs: number;
  Active_Disputes: number;
  Scanned_At: string;
}

interface EmployerScoreTableProps {
  scores: EmployerScore[];
  isLoading?: boolean;
}

function getScoreColor(score: number): string {
  if (score < 50) return "bg-red-100 text-red-800 border-red-200";
  if (score < 75) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-green-100 text-green-800 border-green-200";
}

function getScoreBadge(score: number): string {
  if (score < 50) return "At Risk";
  if (score < 75) return "Needs Attention";
  return "Compliant";
}

export function EmployerScoreTable({ scores, isLoading }: EmployerScoreTableProps) {
  const [sortField, setSortField] = useState<keyof EmployerScore>("Score");
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: keyof EmployerScore) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedScores = [...scores].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    return sortAsc
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const SortIcon = sortAsc ? ChevronUp : ChevronDown;

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
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">Employer Compliance Scores</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Sorted by score (worst first) • Click column headers to sort
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort("Employer_Id")}
              >
                <div className="flex items-center gap-1">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  Employer
                  {sortField === "Employer_Id" && <SortIcon className="w-4 h-4" />}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort("Score")}
              >
                <div className="flex items-center gap-1">
                  Score
                  {sortField === "Score" && <SortIcon className="w-4 h-4" />}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort("Total_Workers")}
              >
                <div className="flex items-center gap-1">
                  Workers
                  {sortField === "Total_Workers" && <SortIcon className="w-4 h-4" />}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort("Expired_Docs")}
              >
                <div className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  Expired
                  {sortField === "Expired_Docs" && <SortIcon className="w-4 h-4" />}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort("Expiring_Soon")}
              >
                <div className="flex items-center gap-1 text-orange-600">
                  <Clock className="w-4 h-4" />
                  Expiring
                  {sortField === "Expiring_Soon" && <SortIcon className="w-4 h-4" />}
                </div>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedScores.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No employer scores available. Run a compliance scan to generate scores.
                </td>
              </tr>
            ) : (
              sortedScores.map((score) => (
                <tr key={score.Id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{score.Employer_Id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            score.Score < 50
                              ? "bg-red-500"
                              : score.Score < 75
                              ? "bg-amber-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, score.Score))}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-700">{score.Score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{score.Total_Workers}</td>
                  <td className="px-4 py-3">
                    {score.Expired_Docs > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        {score.Expired_Docs}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {score.Expiring_Soon > 0 ? (
                      <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                        <Clock className="w-4 h-4" />
                        {score.Expiring_Soon}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getScoreColor(
                        score.Score
                      )}`}
                    >
                      {getScoreBadge(score.Score)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
