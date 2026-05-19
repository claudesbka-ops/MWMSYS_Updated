import { prisma } from "../db";
import {
  calculateWorkerRisk,
  generateRiskSummary,
  calculateBatchRisk,
  generateBatchRiskSummaries,
  type RiskBreakdown,
} from "../services/workerRiskService";

export interface RiskScoreResult {
  workerId: string;
  riskScore: number;
  riskLevel: string;
  breakdown: RiskBreakdown;
  aiSummary: string | null;
  calculatedAt: Date;
}

/**
 * Calculate and store risk score for a single worker
 */
export async function calculateAndStoreWorkerRisk(
  workerId: string
): Promise<RiskScoreResult | null> {
  // Verify worker exists
  const worker = await prisma.tbl_Worker_PersonalInfo.findUnique({
    where: { Worker_Id: workerId },
    select: { Worker_Id: true, Name: true },
  });

  if (!worker) return null;

  // Calculate risk
  const breakdown = await calculateWorkerRisk(workerId);

  // Generate AI summary
  const aiSummary = await generateRiskSummary(workerId, breakdown);

  // Store in database
  await prisma.tbl_Worker_Risk_Scores.create({
    data: {
      Worker_Id: workerId,
      Risk_Score: breakdown.totalScore,
      Risk_Level: breakdown.riskLevel,
      Doc_Score: breakdown.docScore,
      Dispute_Score: breakdown.disputeScore,
      Compliance_Score: breakdown.complianceScore,
      Expired_Docs: breakdown.details.expiredDocs,
      Expiring_Docs: breakdown.details.expiringDocs,
      Active_Disputes: breakdown.details.activeDisputes,
      Dispute_Severity: breakdown.details.disputeSeverity,
      Missing_Docs: breakdown.details.missingDocs,
      Ai_Risk_Summary: aiSummary,
    },
  });

  return {
    workerId,
    riskScore: breakdown.totalScore,
    riskLevel: breakdown.riskLevel,
    breakdown,
    aiSummary,
    calculatedAt: new Date(),
  };
}

/**
 * Get latest risk score for a worker
 */
export async function getWorkerRiskScore(
  workerId: string
): Promise<RiskScoreResult | null> {
  const latest = await prisma.tbl_Worker_Risk_Scores.findFirst({
    where: { Worker_Id: workerId },
    orderBy: { Calculated_At: "desc" },
  });

  if (!latest) return null;

  return {
    workerId,
    riskScore: latest.Risk_Score,
    riskLevel: latest.Risk_Level,
    breakdown: {
      docScore: latest.Doc_Score,
      disputeScore: latest.Dispute_Score,
      complianceScore: latest.Compliance_Score,
      totalScore: latest.Risk_Score,
      riskLevel: latest.Risk_Level as any,
      details: {
        expiredDocs: latest.Expired_Docs,
        expiringDocs: latest.Expiring_Docs,
        activeDisputes: latest.Active_Disputes,
        disputeSeverity: latest.Dispute_Severity,
        missingDocs: latest.Missing_Docs,
      },
    },
    aiSummary: latest.Ai_Risk_Summary,
    calculatedAt: latest.Calculated_At,
  };
}

/**
 * Calculate risk for all workers in scope (Admin only)
 */
export async function calculateAllWorkerRisks(): Promise<{
  calculated: number;
  failed: number;
  workers: Array<{ workerId: string; score: number; level: string }>;
}> {
  // Get all workers
  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    select: { Worker_Id: true },
    take: 500, // Limit batch size
  });

  const workerIds = workers.map((w) => w.Worker_Id);

  // Calculate batch risk
  const riskResults = await calculateBatchRisk(workerIds);

  // Prepare for AI summaries
  const workersWithRisk = Array.from(riskResults.entries()).map(
    ([workerId, breakdown]) => ({
      workerId,
      breakdown,
    })
  );

  // Generate batch AI summaries
  const summaries = await generateBatchRiskSummaries(workersWithRisk);

  // Store all results
  let calculated = 0;
  let failed = 0;
  const results: Array<{ workerId: string; score: number; level: string }> = [];

  for (const [workerId, breakdown] of riskResults.entries()) {
    try {
      const aiSummary = summaries.get(workerId) || null;

      await prisma.tbl_Worker_Risk_Scores.create({
        data: {
          Worker_Id: workerId,
          Risk_Score: breakdown.totalScore,
          Risk_Level: breakdown.riskLevel,
          Doc_Score: breakdown.docScore,
          Dispute_Score: breakdown.disputeScore,
          Compliance_Score: breakdown.complianceScore,
          Expired_Docs: breakdown.details.expiredDocs,
          Expiring_Docs: breakdown.details.expiringDocs,
          Active_Disputes: breakdown.details.activeDisputes,
          Dispute_Severity: breakdown.details.disputeSeverity,
          Missing_Docs: breakdown.details.missingDocs,
          Ai_Risk_Summary: aiSummary,
        },
      });

      calculated++;
      results.push({
        workerId,
        score: breakdown.totalScore,
        level: breakdown.riskLevel,
      });
    } catch (err) {
      console.error(`[workerRisk] Failed to store score for ${workerId}:`, err);
      failed++;
    }
  }

  return { calculated, failed, workers: results };
}

/**
 * Get dashboard summary for Admin/Agency
 */
export async function getRiskDashboardSummary(agencyId?: string): Promise<{
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgScore: number;
  topRiskWorkers: Array<{
    workerId: string;
    workerName: string | null;
    score: number;
    level: string;
    topFactor: string;
  }>;
  lastCalculatedAt: Date | null;
}> {
  // Build worker scope
  let workerWhere: any = {};
  if (agencyId) {
    // Get workers linked to this agency
    const linkedWorkers = await prisma.tbl_Worker_RecruitAgent.findMany({
      where: { Malaysian_Reqruitment_Agency: agencyId },
      select: { Worker_Id: true },
    });
    const workerIds = linkedWorkers.map((w) => w.Worker_Id);
    if (workerIds.length === 0) {
      return {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        avgScore: 0,
        topRiskWorkers: [],
        lastCalculatedAt: null,
      };
    }
    workerWhere = { Worker_Id: { in: workerIds } };
  }

  // Get counts by level
  const [critical, high, medium, low, allScores, lastCalc] = await Promise.all([
    prisma.tbl_Worker_Risk_Scores.count({
      where: { ...workerWhere, Risk_Level: "critical" },
    }),
    prisma.tbl_Worker_Risk_Scores.count({
      where: { ...workerWhere, Risk_Level: "high" },
    }),
    prisma.tbl_Worker_Risk_Scores.count({
      where: { ...workerWhere, Risk_Level: "medium" },
    }),
    prisma.tbl_Worker_Risk_Scores.count({
      where: { ...workerWhere, Risk_Level: "low" },
    }),
    prisma.tbl_Worker_Risk_Scores.findMany({
      where: workerWhere,
      select: { Risk_Score: true },
    }),
    prisma.tbl_Worker_Risk_Scores.findFirst({
      where: workerWhere,
      orderBy: { Calculated_At: "desc" },
      select: { Calculated_At: true },
    }),
  ]);

  // Calculate average
  const avgScore =
    allScores.length > 0
      ? Math.round(
          allScores.reduce((sum, s) => sum + s.Risk_Score, 0) / allScores.length
        )
      : 0;

  // Get top 10 riskiest workers
  const topRisk = await prisma.tbl_Worker_Risk_Scores.findMany({
    where: workerWhere,
    orderBy: { Risk_Score: "desc" },
    take: 10,
    select: {
      Worker_Id: true,
      Risk_Score: true,
      Risk_Level: true,
      Doc_Score: true,
      Dispute_Score: true,
      Compliance_Score: true,
      Ai_Risk_Summary: true,
    },
  });

  // Get worker names
  const workerIds = topRisk.map((w) => w.Worker_Id);
  const workerNames = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: { Worker_Id: { in: workerIds } },
    select: { Worker_Id: true, Name: true },
  });
  const nameMap = new Map(workerNames.map((w) => [w.Worker_Id, w.Name]));

  const topRiskWorkers = topRisk.map((w) => {
    const maxScore = Math.max(w.Doc_Score, w.Dispute_Score, w.Compliance_Score);
    let topFactor = "Unknown";
    if (maxScore === w.Doc_Score) topFactor = "Documents";
    else if (maxScore === w.Dispute_Score) topFactor = "Disputes";
    else if (maxScore === w.Compliance_Score) topFactor = "Compliance";

    return {
      workerId: w.Worker_Id,
      workerName: nameMap.get(w.Worker_Id) || null,
      score: w.Risk_Score,
      level: w.Risk_Level,
      topFactor,
    };
  });

  return {
    critical,
    high,
    medium,
    low,
    avgScore,
    topRiskWorkers,
    lastCalculatedAt: lastCalc?.Calculated_At || null,
  };
}
