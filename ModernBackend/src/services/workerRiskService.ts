import { prisma } from "../db";
import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface RiskBreakdown {
  docScore: number;
  disputeScore: number;
  complianceScore: number;
  totalScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  details: {
    expiredDocs: number;
    expiringDocs: number;
    missingDocs: number;
    activeDisputes: number;
    disputeSeverity: string | null;
  };
}

/**
 * Calculate risk score for a single worker
 * Max score: 75 (25 per component)
 */
export async function calculateWorkerRisk(workerId: string): Promise<RiskBreakdown> {
  // Get document data
  const attachments = await prisma.tbl_Worker_Attachments.findUnique({
    where: { Worker_Id: workerId },
    select: {
      Passport_Expire_Date: true,
      Permit_Expire_Date: true,
      Insurance_Expire_Date: true,
    },
  });

  const personal = await prisma.tbl_Worker_PersonalInfo.findUnique({
    where: { Worker_Id: workerId },
    select: { Passport_Expire_Date: true },
  });

  // Calculate document score (0-25)
  let docScore = 0;
  let expiredDocs = 0;
  let expiringDocs = 0;
  let missingDocs = 0;

  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const checkDate = (date: Date | null | undefined) => {
    if (!date) {
      missingDocs++;
      return;
    }
    if (date < today) {
      expiredDocs++;
    } else if (date <= thirtyDaysFromNow) {
      expiringDocs++;
    }
  };

  checkDate(attachments?.Passport_Expire_Date);
  checkDate(attachments?.Permit_Expire_Date);
  checkDate(attachments?.Insurance_Expire_Date);
  checkDate(personal?.Passport_Expire_Date);

  docScore = Math.min(25,
    expiredDocs * 10 +
    expiringDocs * 5 +
    missingDocs * 8
  );

  // Calculate dispute score (0-25)
  const disputes = await prisma.tbl_SalaryDispute.findMany({
    where: { Worker_Id: workerId },
    select: {
      Status: true,
      Ai_Severity: true,
      Submitted_At: true,
    },
  });

  let disputeScore = 0;
  let activeDisputes = 0;
  let maxDisputeSeverity: string | null = null;
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

  for (const d of disputes) {
    if (d.Status === "Pending") {
      activeDisputes++;
    }
    if (d.Ai_Severity === "critical") {
      disputeScore += 15;
      maxDisputeSeverity = "critical";
    } else if (d.Ai_Severity === "high") {
      disputeScore += 10;
      if (maxDisputeSeverity !== "critical") maxDisputeSeverity = "high";
    }
    if (d.Submitted_At && d.Submitted_At >= ninetyDaysAgo) {
      disputeScore += 3;
    }
  }

  disputeScore += activeDisputes * 5;
  disputeScore = Math.min(25, disputeScore);

  // Calculate compliance score (0-25)
  const complianceAlerts = await prisma.tbl_Compliance_Alerts.findMany({
    where: {
      Worker_Id: workerId,
      Is_Resolved: false,
    },
    select: { Severity: true },
  });

  let complianceScore = 0;
  if (complianceAlerts.length > 0) {
    const hasCritical = complianceAlerts.some(a => a.Severity === "CRITICAL");
    const hasHigh = complianceAlerts.some(a => a.Severity === "HIGH");

    if (hasCritical) {
      complianceScore = 20;
    } else if (hasHigh) {
      complianceScore = 15;
    } else {
      complianceScore = 10;
    }
  } else {
    // Check if compliance scan ever done
    const anyCompliance = await prisma.tbl_Compliance_Alerts.findFirst({
      where: { Worker_Id: workerId },
    });
    if (!anyCompliance) {
      complianceScore = 10; // Unknown = risk
    }
  }

  complianceScore = Math.min(25, complianceScore);

  // Calculate total and level
  const totalScore = docScore + disputeScore + complianceScore;

  let riskLevel: "low" | "medium" | "high" | "critical";
  if (totalScore <= 19) riskLevel = "low";
  else if (totalScore <= 37) riskLevel = "medium";
  else if (totalScore <= 56) riskLevel = "high";
  else riskLevel = "critical";

  return {
    docScore,
    disputeScore,
    complianceScore,
    totalScore,
    riskLevel,
    details: {
      expiredDocs,
      expiringDocs,
      missingDocs,
      activeDisputes,
      disputeSeverity: maxDisputeSeverity,
    },
  };
}

/**
 * Generate AI risk summary for a worker
 */
export async function generateRiskSummary(
  workerId: string,
  breakdown: RiskBreakdown
): Promise<string> {
  if (!client) {
    return `Worker has risk score ${breakdown.totalScore}/75 (${breakdown.riskLevel}). Primary factors: ${breakdown.docScore > 10 ? "document issues" : ""} ${breakdown.disputeScore > 10 ? "dispute history" : ""} ${breakdown.complianceScore > 10 ? "compliance alerts" : ""}`.trim();
  }

  const prompt = `As a labour risk analyst, write one concise sentence summarizing the main risk factor for this worker:

Risk Score: ${breakdown.totalScore}/75 (${breakdown.riskLevel})
Document Issues: ${breakdown.details.expiredDocs} expired, ${breakdown.details.expiringDocs} expiring, ${breakdown.details.missingDocs} missing (score: ${breakdown.docScore}/25)
Disputes: ${breakdown.details.activeDisputes} active, max severity: ${breakdown.details.disputeSeverity || "none"} (score: ${breakdown.disputeScore}/25)
Compliance: score ${breakdown.complianceScore}/25

Write ONE sentence, max 15 words. Example: "Worker has 2 expired documents and an unresolved high-severity dispute."`;

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 80,
    });

    return response.choices[0]?.message?.content?.trim() ||
      `Risk score ${breakdown.totalScore}/75 - ${breakdown.riskLevel} risk level`;
  } catch {
    return `Risk score ${breakdown.totalScore}/75 - ${breakdown.riskLevel} risk level`;
  }
}

/**
 * Calculate risk for multiple workers in batch
 */
export async function calculateBatchRisk(
  workerIds: string[]
): Promise<Map<string, RiskBreakdown>> {
  const results = new Map<string, RiskBreakdown>();

  for (const workerId of workerIds) {
    try {
      const breakdown = await calculateWorkerRisk(workerId);
      results.set(workerId, breakdown);
    } catch (err) {
      console.error(`[workerRisk] Failed to calculate for ${workerId}:`, err);
    }
  }

  return results;
}

/**
 * Generate batch AI summaries in one call
 */
export async function generateBatchRiskSummaries(
  workers: Array<{ workerId: string; breakdown: RiskBreakdown }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  if (!client || workers.length === 0) {
    for (const w of workers) {
      results.set(w.workerId, `Risk score ${w.breakdown.totalScore}/75 (${w.breakdown.riskLevel})`);
    }
    return results;
  }

  const summaries = workers.map((w, i) =>
    `[${i + 1}] Worker ${w.workerId}: score ${w.breakdown.totalScore}/75, doc ${w.breakdown.docScore}, dispute ${w.breakdown.disputeScore}, compliance ${w.breakdown.complianceScore}`
  ).join("\n");

  const prompt = `Write one concise risk summary per worker (${workers.length} total). Max 12 words each. Format: [N] <summary>

${summaries}

Respond with JSON array: ["summary 1", "summary 2", ...]`;

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length === workers.length) {
        for (let i = 0; i < workers.length; i++) {
          results.set(workers[i].workerId, parsed[i]);
        }
        return results;
      }
    }
  } catch {
    // Fallback to individual summaries
  }

  // Fallback
  for (const w of workers) {
    results.set(w.workerId, `Risk score ${w.breakdown.totalScore}/75 (${w.breakdown.riskLevel})`);
  }
  return results;
}
