import OpenAI from "openai";

/**
 * AI Compliance Copilot - Batched Alert Message Generation
 * Generates natural language summaries for compliance alerts in ONE API call.
 */

export type AlertForAi = {
  workerId: string;
  workerName: string;
  documentType: string;
  daysUntilExpiry: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  employerName?: string;
};

export type AiAlertSummary = {
  workerId: string;
  summary: string;
};

let cachedClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const key = (process.env.OPENAI_API_KEY ?? "").toString().trim();
  if (!key) return null;
  if (cachedClient) return cachedClient;
  try {
    cachedClient = new OpenAI({ apiKey: key });
    return cachedClient;
  } catch (err) {
    console.error("[complianceAi] failed to create OpenAI client", err);
    return null;
  }
}

/**
 * Generate AI summaries for ALL alerts in a SINGLE batched call
 * Cost-efficient: one API call for all alerts instead of per-alert calls
 */
export async function generateBatchAlertSummaries(
  alerts: AlertForAi[]
): Promise<Map<string, string>> {
  const client = getOpenAIClient();
  const summaries = new Map<string, string>();

  if (!client || alerts.length === 0) {
    // Fallback: generate basic summaries without AI
    for (const alert of alerts) {
      const fallback = generateFallbackSummary(alert);
      summaries.set(alert.workerId, fallback);
    }
    return summaries;
  }

  // Build batched prompt with all alerts
  const alertsJson = JSON.stringify(
    alerts.map((a, idx) => ({
      index: idx,
      workerId: a.workerId,
      workerName: a.workerName,
      documentType: a.documentType,
      daysUntilExpiry: a.daysUntilExpiry,
      severity: a.severity,
      employerName: a.employerName || "Unknown",
    })),
    null,
    2
  );

  const prompt = `You are a compliance officer for a workforce management system.
Generate brief, professional alert messages (max 2 sentences each) for the following document expiry alerts.

Alerts to process:
${alertsJson}

Rules:
- Each message must be specific and actionable
- Mention the worker name, document type, and urgency
- CRITICAL (expired): Use urgent tone, immediate action required
- HIGH (≤7 days): Use warning tone, action needed soon  
- MEDIUM (≤30 days): Use advisory tone, plan ahead
- LOW (≤60 days): Use informational tone

Return ONLY a JSON object where keys are the workerId and values are the summary messages:
{
  "WORKER_ID_1": "Summary message for worker 1",
  "WORKER_ID_2": "Summary message for worker 2"
}`;

  try {
    const response = await client.chat.completions.create({
      model: (process.env.OPENAI_MODEL ?? "gpt-4o").toString().trim() || "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: Math.min(100 + alerts.length * 50, 2000), // Dynamic based on alert count
      temperature: 0.3,
    });

    const text = response.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      for (const alert of alerts) {
        const summary = parsed[alert.workerId] || generateFallbackSummary(alert);
        summaries.set(alert.workerId, summary);
      }
    } catch (parseErr) {
      console.error("[complianceAi] Failed to parse AI response:", parseErr);
      // Fallback for all
      for (const alert of alerts) {
        summaries.set(alert.workerId, generateFallbackSummary(alert));
      }
    }
  } catch (err: any) {
    console.error("[complianceAi] Batch generation failed:", err?.message ?? err);
    // Fallback for all
    for (const alert of alerts) {
      summaries.set(alert.workerId, generateFallbackSummary(alert));
    }
  }

  return summaries;
}

/**
 * Generate fallback summary when AI is unavailable
 */
function generateFallbackSummary(alert: AlertForAi): string {
  const { workerName, documentType, daysUntilExpiry, severity } = alert;

  if (severity === "CRITICAL") {
    return `${workerName}'s ${documentType} has expired (${Math.abs(daysUntilExpiry)} days ago). Immediate renewal required to maintain compliance.`;
  }
  if (severity === "HIGH") {
    return `${workerName}'s ${documentType} expires in ${daysUntilExpiry} days. Urgent action needed to avoid compliance issues.`;
  }
  if (severity === "MEDIUM") {
    return `${workerName}'s ${documentType} expires in ${daysUntilExpiry} days. Schedule renewal soon to ensure continuous compliance.`;
  }
  return `${workerName}'s ${documentType} expires in ${daysUntilExpiry} days. Plan for renewal in the coming weeks.`;
}

/**
 * Generate dashboard insight summary (single AI call)
 */
export async function generateDashboardInsight(
  criticalCount: number,
  highCount: number,
  mediumCount: number,
  lowCount: number,
  avgScore: number
): Promise<string> {
  const client = getOpenAIClient();
  if (!client) {
    return `Compliance status: ${criticalCount} critical, ${highCount} high priority alerts. Average employer score: ${avgScore}/100.`;
  }

  const prompt = `As a compliance officer, generate a brief executive summary (2-3 sentences) for this workforce compliance status:

- Critical alerts (expired): ${criticalCount}
- High priority (≤7 days): ${highCount}
- Medium priority (≤30 days): ${mediumCount}
- Low priority (≤60 days): ${lowCount}
- Average compliance score: ${avgScore}/100

Provide actionable advice. Keep it professional and concise.`;

  try {
    const response = await client.chat.completions.create({
      model: (process.env.OPENAI_MODEL ?? "gpt-4o-mini").toString().trim() || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.3,
    });

    return response.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    return `Compliance status: ${criticalCount} critical, ${highCount} high priority alerts. Average employer score: ${avgScore}/100.`;
  }
}
