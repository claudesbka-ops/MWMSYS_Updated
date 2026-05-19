import { prisma } from "../db";
import {
  scoreDispute,
  scoreDisputesBatch,
  DisputeForScoring,
  DisputeAiScore,
} from "../services/disputeAiService";

/**
 * Score a single dispute by ID
 * Triggered manually via API or auto-triggered on create/update
 */
export async function scoreSingleDispute(
  disputeId: number
): Promise<DisputeAiScore | null> {
  // Fetch dispute with related data
  const dispute = await prisma.tbl_SalaryDispute.findUnique({
    where: { Id: disputeId },
  });

  if (!dispute) return null;

  // Calculate days unresolved
  const submittedAt = dispute.Submitted_At
    ? new Date(dispute.Submitted_At)
    : new Date();
  const daysUnresolved = Math.floor(
    (Date.now() - submittedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Count previous disputes by this worker
  const previousCount = await prisma.tbl_SalaryDispute.count({
    where: {
      Worker_Id: dispute.Worker_Id,
      Id: { not: disputeId },
      Submitted_At: { lt: dispute.Submitted_At || new Date() },
    },
  });

  const scoringData: DisputeForScoring = {
    id: dispute.Id,
    workerId: dispute.Worker_Id,
    employerId: dispute.Employer_Id,
    expectedAmount: Number(dispute.Expected_Amount),
    receivedAmount: Number(dispute.Received_Amount),
    description: dispute.Description,
    hasProof: !!dispute.Proof_File_Path,
    daysUnresolved: Math.max(0, daysUnresolved),
    previousDisputeCount: previousCount,
  };

  // Get AI score
  const score = await scoreDispute(scoringData);

  // Save to database
  await prisma.tbl_SalaryDispute.update({
    where: { Id: disputeId },
    data: {
      Ai_Severity: score.severity,
      Ai_Severity_Score: score.score,
      Ai_Severity_Reason: score.reason,
      Ai_Escalation_Risk: score.escalation_risk,
      Ai_Scored_At: new Date(),
    },
  });

  return score;
}

/**
 * Score ALL unscored disputes in ONE batch call
 * Admin-only endpoint for bulk scoring
 */
export async function scoreAllUnscoredDisputes(): Promise<{
  scored: number;
  failed: number;
  disputes: Array<{ id: number } & DisputeAiScore>;
}> {
  // Find all disputes without AI scoring
  const unscored = await prisma.tbl_SalaryDispute.findMany({
    where: {
      Ai_Severity: null,
    },
    orderBy: { Submitted_At: "desc" },
    take: 50, // Limit batch size
  });

  if (unscored.length === 0) {
    return { scored: 0, failed: 0, disputes: [] };
  }

  // Build scoring data for all
  const scoringDataList: DisputeForScoring[] = await Promise.all(
    unscored.map(async (dispute) => {
      const submittedAt = dispute.Submitted_At
        ? new Date(dispute.Submitted_At)
        : new Date();
      const daysUnresolved = Math.floor(
        (Date.now() - submittedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      const previousCount = await prisma.tbl_SalaryDispute.count({
        where: {
          Worker_Id: dispute.Worker_Id,
          Id: { not: dispute.Id },
          Submitted_At: { lt: dispute.Submitted_At || new Date() },
        },
      });

      return {
        id: dispute.Id,
        workerId: dispute.Worker_Id,
        employerId: dispute.Employer_Id,
        expectedAmount: Number(dispute.Expected_Amount),
        receivedAmount: Number(dispute.Received_Amount),
        description: dispute.Description,
        hasProof: !!dispute.Proof_File_Path,
        daysUnresolved: Math.max(0, daysUnresolved),
        previousDisputeCount: previousCount,
      };
    })
  );

  // Single batched AI call
  const scores = await scoreDisputesBatch(scoringDataList);

  // Update all disputes with scores
  let scored = 0;
  let failed = 0;
  const results: Array<{ id: number } & DisputeAiScore> = [];

  for (const [id, score] of scores.entries()) {
    try {
      await prisma.tbl_SalaryDispute.update({
        where: { Id: id },
        data: {
          Ai_Severity: score.severity,
          Ai_Severity_Score: score.score,
          Ai_Severity_Reason: score.reason,
          Ai_Escalation_Risk: score.escalation_risk,
          Ai_Scored_At: new Date(),
        },
      });
      scored++;
      results.push({ id, ...score });
    } catch (err) {
      console.error(`[disputeAi] Failed to save score for dispute ${id}:`, err);
      failed++;
    }
  }

  return { scored, failed, disputes: results };
}

/**
 * Get severity summary counts
 */
export async function getSeveritySummary(): Promise<{
  critical: number;
  high: number;
  medium: number;
  low: number;
  unscored: number;
  total: number;
}> {
  const [critical, high, medium, low, unscored, total] = await Promise.all([
    prisma.tbl_SalaryDispute.count({ where: { Ai_Severity: "critical" } }),
    prisma.tbl_SalaryDispute.count({ where: { Ai_Severity: "high" } }),
    prisma.tbl_SalaryDispute.count({ where: { Ai_Severity: "medium" } }),
    prisma.tbl_SalaryDispute.count({ where: { Ai_Severity: "low" } }),
    prisma.tbl_SalaryDispute.count({ where: { Ai_Severity: null } }),
    prisma.tbl_SalaryDispute.count(),
  ]);

  return { critical, high, medium, low, unscored, total };
}

/**
 * Get AI-scored disputes with filters
 */
export async function getScoredDisputes(filters: {
  severity?: string;
  employerId?: string;
  workerId?: string;
  unscoredOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  disputes: Array<{
    id: number;
    workerId: string;
    employerId: string;
    severity: string | null;
    score: number | null;
    reason: string | null;
    escalationRisk: string | null;
    scoredAt: Date | null;
  }>;
  total: number;
}> {
  const where: any = {};

  if (filters.unscoredOnly) {
    where.Ai_Severity = null;
  } else if (filters.severity && filters.severity !== "All") {
    where.Ai_Severity = filters.severity;
  }

  if (filters.employerId) {
    where.Employer_Id = filters.employerId;
  }

  if (filters.workerId) {
    where.Worker_Id = filters.workerId;
  }

  const [disputes, total] = await Promise.all([
    prisma.tbl_SalaryDispute.findMany({
      where,
      orderBy: { Ai_Scored_At: "desc" },
      take: filters.limit || 50,
      skip: filters.offset || 0,
      select: {
        Id: true,
        Worker_Id: true,
        Employer_Id: true,
        Ai_Severity: true,
        Ai_Severity_Score: true,
        Ai_Severity_Reason: true,
        Ai_Escalation_Risk: true,
        Ai_Scored_At: true,
      },
    }),
    prisma.tbl_SalaryDispute.count({ where }),
  ]);

  return {
    disputes: disputes.map((d) => ({
      id: d.Id,
      workerId: d.Worker_Id,
      employerId: d.Employer_Id,
      severity: d.Ai_Severity,
      score: d.Ai_Severity_Score,
      reason: d.Ai_Severity_Reason,
      escalationRisk: d.Ai_Escalation_Risk,
      scoredAt: d.Ai_Scored_At,
    })),
    total,
  };
}
