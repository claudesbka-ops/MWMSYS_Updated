import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type DisputeSeverity = "critical" | "high" | "medium" | "low";
export type EscalationRisk = "likely" | "possible" | "unlikely";

export interface DisputeAiScore {
  severity: DisputeSeverity;
  score: number; // 0-100
  reason: string;
  escalation_risk: EscalationRisk;
}

export interface DisputeForScoring {
  id: number;
  workerId: string;
  employerId: string;
  expectedAmount: number;
  receivedAmount: number;
  description: string;
  hasProof: boolean;
  daysUnresolved: number;
  previousDisputeCount: number;
}

/**
 * Score a single dispute using OpenAI
 */
export async function scoreDispute(
  dispute: DisputeForScoring
): Promise<DisputeAiScore> {
  if (!client) {
    return fallbackScore(dispute);
  }

  const amountDisputed = dispute.expectedAmount - dispute.receivedAmount;

  const prompt = `You are a labour dispute analyst. Score this salary dispute:

Amount disputed: RM ${amountDisputed.toFixed(2)} (expected RM ${dispute.expectedAmount.toFixed(2)}, received RM ${dispute.receivedAmount.toFixed(2)})
Description: ${dispute.description}
Evidence attached: ${dispute.hasProof ? "yes" : "no"}
Days unresolved: ${dispute.daysUnresolved}
Previous disputes by this worker: ${dispute.previousDisputeCount}

Severity rules:
- CRITICAL: wage theft >3 months, physical abuse mentioned, legal threat, amount >RM 5000
- HIGH: >1 month unpaid, repeated disputes (2+ previous), amount >RM 2000
- MEDIUM: partial payment issues, first-time dispute, amount RM 500-2000
- LOW: minor deductions, process/admin complaints, amount <RM 500

Return ONLY valid JSON in this exact format:
{
  "severity": "critical|high|medium|low",
  "score": 0-100,
  "reason": "one sentence explanation of why this severity was assigned",
  "escalation_risk": "likely|possible|unlikely"
}`;

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    return parseAiResponse(content, dispute);
  } catch (err) {
    console.error("[disputeAi] OpenAI error:", err);
    return fallbackScore(dispute);
  }
}

/**
 * Score multiple disputes in ONE batched OpenAI call
 */
export async function scoreDisputesBatch(
  disputes: DisputeForScoring[]
): Promise<Map<number, DisputeAiScore>> {
  const results = new Map<number, DisputeAiScore>();

  if (!client || disputes.length === 0) {
    // Fallback for all
    for (const d of disputes) {
      results.set(d.id, fallbackScore(d));
    }
    return results;
  }

  // Build batch prompt
  const disputesText = disputes
    .map(
      (d, i) => `[DISPUTE ${i + 1}]
ID: ${d.id}
Amount disputed: RM ${(d.expectedAmount - d.receivedAmount).toFixed(2)}
Description: ${d.description}
Evidence: ${d.hasProof ? "yes" : "no"}
Days unresolved: ${d.daysUnresolved}
Previous disputes: ${d.previousDisputeCount}`
    )
    .join("\n\n");

  const prompt = `You are a labour dispute analyst. Score ${disputes.length} disputes.

${disputesText}

Severity rules:
- CRITICAL: wage theft >3 months, physical abuse mentioned, legal threat, amount >RM 5000
- HIGH: >1 month unpaid, repeated disputes (2+ previous), amount >RM 2000  
- MEDIUM: partial payment issues, first-time dispute, amount RM 500-2000
- LOW: minor deductions, process/admin complaints, amount <RM 500

Return ONLY a JSON array with one object per dispute in order:
[
  {
    "severity": "critical|high|medium|low",
    "score": 0-100,
    "reason": "one sentence explanation",
    "escalation_risk": "likely|possible|unlikely"
  },
  ...
]`;

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";

    // Extract JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length === disputes.length) {
        for (let i = 0; i < disputes.length; i++) {
          const item = parsed[i];
          results.set(disputes[i].id, {
            severity: validateSeverity(item.severity),
            score: Math.max(0, Math.min(100, Math.round(item.score || 50))),
            reason: (item.reason || "No reason provided").substring(0, 500),
            escalation_risk: validateEscalationRisk(item.escalation_risk),
          });
        }
        return results;
      }
    }

    throw new Error("Invalid batch response format");
  } catch (err) {
    console.error("[disputeAi] Batch scoring failed:", err);
    // Fallback for all
    for (const d of disputes) {
      results.set(d.id, fallbackScore(d));
    }
    return results;
  }
}

function parseAiResponse(content: string, dispute: DisputeForScoring): DisputeAiScore {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      severity: validateSeverity(parsed.severity),
      score: Math.max(0, Math.min(100, Math.round(parsed.score || 50))),
      reason: (parsed.reason || "No reason provided").substring(0, 500),
      escalation_risk: validateEscalationRisk(parsed.escalation_risk),
    };
  } catch (err) {
    console.error("[disputeAi] Parse error:", err);
    return fallbackScore(dispute);
  }
}

function validateSeverity(s: string): DisputeSeverity {
  const valid: DisputeSeverity[] = ["critical", "high", "medium", "low"];
  return valid.includes(s as DisputeSeverity) ? (s as DisputeSeverity) : "medium";
}

function validateEscalationRisk(s: string): EscalationRisk {
  const valid: EscalationRisk[] = ["likely", "possible", "unlikely"];
  return valid.includes(s as EscalationRisk) ? (s as EscalationRisk) : "possible";
}

function fallbackScore(dispute: DisputeForScoring): DisputeAiScore {
  const amount = dispute.expectedAmount - dispute.receivedAmount;
  const days = dispute.daysUnresolved;
  const previous = dispute.previousDisputeCount;

  // Simple rule-based fallback
  if (amount > 5000 || days > 90 || previous >= 3) {
    return {
      severity: "critical",
      score: 90,
      reason: "High amount or extended non-payment detected",
      escalation_risk: "likely",
    };
  }
  if (amount > 2000 || days > 30 || previous >= 1) {
    return {
      severity: "high",
      score: 75,
      reason: "Significant unpaid wages or repeat dispute",
      escalation_risk: "possible",
    };
  }
  if (amount > 500 || days > 14) {
    return {
      severity: "medium",
      score: 50,
      reason: "Moderate payment discrepancy",
      escalation_risk: "possible",
    };
  }
  return {
    severity: "low",
    score: 25,
    reason: "Minor administrative issue",
    escalation_risk: "unlikely",
  };
}
