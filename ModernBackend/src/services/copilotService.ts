import OpenAI from "openai";
import { prisma } from "../db";
import type { JwtClaims } from "../middleware/auth";
import { buildWorkerScopeWhere } from "./queryGuard";

/**
 * MWMSYS AI Admin Copilot Service
 * Uses OpenAI function calling (tools) to answer natural language queries
 * about workforce data, compliance, risk scores, and disputes.
 */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CopilotResponse = {
  reply: string;
  toolsUsed: string[];
  data?: any;
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
    console.error("[copilot] failed to create OpenAI client", err);
    return null;
  }
}

const SYSTEM_PROMPT = `You are the AI Copilot for MWMSYS, an AI-powered migrant worker management platform. You help admins and agency managers query workforce data, compliance status, risk scores, and disputes using natural language.

You have access to tools that query real platform data. Always use tools to get current data before answering. Never make up numbers.

When presenting data:
- Be concise and actionable
- Highlight critical issues first
- Suggest next steps when relevant
- Use plain language, not technical jargon

Platform context:
- Workers: migrant workers with documents, permits, insurance
- Employers: companies that employ workers
- Agencies: recruitment agencies managing workers
- Compliance: document expiry and permit status
- Risk Score: 0-75 scale (higher = more risk)
- Disputes: salary disputes between workers and employers`;

// ============== TOOL DEFINITIONS ==============

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_worker_stats",
      description: "Get worker counts and summary stats",
      parameters: {
        type: "object",
        properties: {
          employerId: { type: "string", description: "Filter by specific employer" },
          nationality: { type: "string", description: "Filter by nationality" },
          riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Filter by risk level" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_compliance_overview",
      description: "Get compliance scores and alerts",
      parameters: {
        type: "object",
        properties: {
          employerId: { type: "string", description: "Filter by employer" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"], description: "Filter by severity" },
          limit: { type: "number", default: 10, description: "Max results to return" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_risk_scores",
      description: "Get worker risk assessments",
      parameters: {
        type: "object",
        properties: {
          level: { type: "string", enum: ["critical", "high", "medium", "low"], description: "Risk level filter" },
          employerId: { type: "string", description: "Filter by employer" },
          limit: { type: "number", default: 10, description: "Max results" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dispute_stats",
      description: "Get salary dispute information",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["Pending", "Accepted", "Rejected"], description: "Dispute status" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"], description: "Severity level" },
          days: { type: "number", description: "Disputes from last N days" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_document_expiry",
      description: "Get documents expiring soon",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", default: 30, description: "Expiring within N days" },
          documentType: { type: "string", enum: ["passport", "permit", "insurance"], description: "Type of document" },
          employerId: { type: "string", description: "Filter by employer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_employer_summary",
      description: "Get employer list with key metrics",
      parameters: {
        type: "object",
        properties: {
          minWorkers: { type: "number", description: "Minimum worker count" },
          maxComplianceScore: { type: "number", description: "Maximum compliance score (lower = worse)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_risks",
      description: "Get the most urgent issues requiring immediate attention",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", default: 5, description: "Number of top issues" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_platform_summary",
      description: "Get overall platform statistics for dashboard overview",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ============== TOOL EXECUTORS ==============

async function executeGetWorkerStats(params: any, user: JwtClaims): Promise<any> {
  const scopeWhere = await buildWorkerScopeWhere(user);
  const where: any = { ...scopeWhere };

  if (params.employerId) where.Employer_Id = params.employerId;
  if (params.nationality) where.Nationality = params.nationality;

  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where,
    select: {
      Worker_Id: true,
      Name: true,
      Nationality: true,
      Employer_Id: true,
    },
    take: 1000,
  });

  // Get risk scores separately
  const workerIds = workers.map((w: { Worker_Id: string }) => w.Worker_Id);
  const riskScores = workerIds.length > 0 ? await prisma.tbl_Worker_Risk_Scores.findMany({
    where: { Worker_Id: { in: workerIds } },
    select: { Worker_Id: true, Risk_Score: true, Risk_Level: true },
  }) : [];
  const riskMap = new Map(riskScores.map((r: { Worker_Id: string; Risk_Score: number; Risk_Level: string }) => [r.Worker_Id, r]));

  // Apply risk level filter in memory if specified
  let filtered = workers;
  if (params.riskLevel) {
    filtered = workers.filter((w: { Worker_Id: string }) => {
      const risk = riskMap.get(w.Worker_Id);
      return risk?.Risk_Level?.toLowerCase() === params.riskLevel.toLowerCase();
    });
  }

  const byNationality: Record<string, number> = {};
  const byEmployer: Record<string, number> = {};
  let atRisk = 0;

  for (const w of filtered) {
    byNationality[w.Nationality || "Unknown"] = (byNationality[w.Nationality || "Unknown"] || 0) + 1;
    byEmployer[w.Employer_Id || "Unknown"] = (byEmployer[w.Employer_Id || "Unknown"] || 0) + 1;
    const risk = riskMap.get(w.Worker_Id);
    if (risk?.Risk_Level === "High" || risk?.Risk_Level === "Critical") atRisk++;
  }

  return {
    total: filtered.length,
    byNationality,
    byEmployer,
    atRisk,
    recentlyAdded: filtered.filter((w) => {
      // Workers added in last 30 days
      return true; // Simplified - would check Created_At if available
    }).length,
  };
}

async function executeGetComplianceOverview(params: any, user: JwtClaims): Promise<any> {
  const scopeWhere = await buildWorkerScopeWhere(user);

  // Get compliance scores
  const scores = await prisma.tbl_Compliance_Scores.findMany({
    where: scopeWhere.Worker_Id ? { Worker_Id: { in: scopeWhere.Worker_Id.in } } : {},
    orderBy: { Calculated_At: "desc" },
    take: params.limit || 10,
  });

  const criticalCount = scores.filter((s: { Score: number | null }) => s.Score != null && s.Score < 50).length;
  const highCount = scores.filter((s: { Score: number | null }) => s.Score != null && s.Score >= 50 && s.Score < 70).length;
  const avgScore = scores.length > 0 ? scores.reduce((a: number, s: { Score: number | null }) => a + (s.Score || 0), 0) / scores.length : 0;

  return {
    avgScore: Math.round(avgScore),
    criticalCount,
    highCount,
    worstEmployers: scores.slice(0, 5).map((s: { Worker_Id: string; Score: number | null; Expired_Docs: number }) => ({
      workerId: s.Worker_Id,
      score: s.Score,
      expiredDocs: s.Expired_Docs,
    })),
    recentAlerts: scores.filter((s: { Score: number | null }) => s.Score != null && s.Score < 70).slice(0, 5),
  };
}

async function executeGetRiskScores(params: any, user: JwtClaims): Promise<any> {
  const scopeWhere = await buildWorkerScopeWhere(user);
  const where: any = { ...scopeWhere };

  if (params.level) {
    where.Risk_Level = params.level.charAt(0).toUpperCase() + params.level.slice(1).toLowerCase();
  }

  const riskScores = await prisma.tbl_Worker_Risk_Scores.findMany({
    where,
    orderBy: { Calculated_At: "desc" },
    take: params.limit || 10,
    include: {
      Worker: {
        select: { Name: true, Nationality: true },
      },
    },
  });

  const criticalCount = riskScores.filter((r: { Risk_Level: string }) => r.Risk_Level === "Critical").length;
  const highCount = riskScores.filter((r: { Risk_Level: string }) => r.Risk_Level === "High").length;
  const avgScore = riskScores.length > 0
    ? riskScores.reduce((a: number, r: { Risk_Score: number }) => a + (r.Risk_Score || 0), 0) / riskScores.length
    : 0;

  return {
    workers: riskScores.map((r) => ({
      workerId: r.Worker_Id,
      name: r.Worker?.Name,
      riskScore: r.Risk_Score,
      riskLevel: r.Risk_Level,
      topFactor: r.Top_Risk_Factor,
    })),
    avgScore: Math.round(avgScore),
    criticalCount,
    highCount,
  };
}

async function executeGetDisputeStats(params: any, user: JwtClaims): Promise<any> {
  const scopeWhere = await buildWorkerScopeWhere(user);
  const where: any = {};

  if (scopeWhere.Worker_Id) {
    where.Worker_Id = scopeWhere.Worker_Id;
  }

  if (params.status) where.Status = params.status;

  if (params.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - params.days);
    where.Created_At = { gte: cutoff };
  }

  const disputes = await prisma.tbl_SalaryDispute.findMany({ where });

  const pending = disputes.filter((d: { Status: string }) => d.Status === "Pending").length;
  const critical = disputes.filter((d: { Expected_Amount: number | null; Received_Amount: number | null }) => (d.Expected_Amount || 0) - (d.Received_Amount || 0) > 5000).length;
  const high = disputes.filter((d: { Expected_Amount: number | null; Received_Amount: number | null }) => {
    const diff = (d.Expected_Amount || 0) - (d.Received_Amount || 0);
    return diff > 1000 && diff <= 5000;
  }).length;

  const totalAmount = disputes.reduce((sum: number, d: { Expected_Amount: number | null; Received_Amount: number | null }) => sum + ((d.Expected_Amount || 0) - (d.Received_Amount || 0)), 0);

  return {
    total: disputes.length,
    pending,
    bySeverity: { critical, high, medium: disputes.length - critical - high },
    avgAmount: disputes.length > 0 ? Math.round(totalAmount / disputes.length) : 0,
    recentDisputes: disputes.slice(0, 5).map((d) => ({
      id: d.Id,
      workerId: d.Worker_Id,
      employerId: d.Employer_Id,
      amount: (d.Expected_Amount || 0) - (d.Received_Amount || 0),
      status: d.Status,
    })),
  };
}

async function executeGetDocumentExpiry(params: any, user: JwtClaims): Promise<any> {
  const scopeWhere = await buildWorkerScopeWhere(user);
  const days = params.days || 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const now = new Date();

  // Get workers with expiring documents
  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: scopeWhere,
    select: {
      Worker_Id: true,
      Name: true,
      Passport_Expire_Date: true,
    },
    take: 500,
  });

  const expiring: any[] = [];
  const expired: any[] = [];

  for (const w of workers) {
    if (w.Passport_Expire_Date) {
      const expDate = new Date(w.Passport_Expire_Date);
      if (expDate < now) {
        expired.push({ workerId: w.Worker_Id, name: w.Name, type: "Passport", expiryDate: w.Passport_Expire_Date });
      } else if (expDate <= cutoff) {
        expiring.push({ workerId: w.Worker_Id, name: w.Name, type: "Passport", expiryDate: w.Passport_Expire_Date, daysRemaining: Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) });
      }
    }
  }

  return {
    expiring: expiring.slice(0, 20),
    expired: expired.slice(0, 20),
    totalExpiring: expiring.length,
    totalExpired: expired.length,
  };
}

async function executeGetEmployerSummary(params: any, user: JwtClaims): Promise<any> {
  const scopeWhere = await buildWorkerScopeWhere(user);

  // Get employers based on worker scope
  const workers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: scopeWhere,
    select: { Employer_Id: true },
    take: 1000,
  });

  const employerIds = Array.from(new Set(workers.map((w) => w.Employer_Id).filter(Boolean)));

  const employers = await prisma.tbl_Employer.findMany({
    where: { User_Id: { in: employerIds.filter((id: string | null): id is string => id != null) } },
    select: {
      User_Id: true,
      Employer_Name: true,
      Employer_ContactPerson_Email: true,
    },
  });

  const result = await Promise.all(
    employers.map(async (e) => {
      const workerCount = await prisma.tbl_Worker_PersonalInfo.count({
        where: { Employer_Id: e.User_Id },
      });

      // Skip if minWorkers filter applies
      if (params.minWorkers && workerCount < params.minWorkers) return null;

      // Get compliance score
      const compliance = await prisma.tbl_Compliance_Scores.findFirst({
        where: { Employer_Id: e.User_Id },
        orderBy: { Calculated_At: "desc" },
      });

      if (params.maxComplianceScore && (compliance?.Score || 100) > params.maxComplianceScore) return null;

      // Get active disputes
      const activeDisputes = await prisma.tbl_SalaryDispute.count({
        where: { Employer_Id: e.User_Id, Status: "Pending" },
      });

      return {
        name: e.Employer_Name,
        workerCount,
        complianceScore: compliance?.Score || null,
        activeDisputes,
      };
    })
  );

  return {
    employers: result.filter(Boolean),
    total: result.filter(Boolean).length,
  };
}

async function executeGetTopRisks(params: any, user: JwtClaims): Promise<any> {
  const limit = params.limit || 5;

  const [criticalWorkers, expiredDocs, pendingDisputes, lowCompliance] = await Promise.all([
    // Critical risk workers
    executeGetRiskScores({ level: "critical", limit }, user),
    // Expired docs
    executeGetDocumentExpiry({ days: 0 }, user),
    // Pending disputes
    executeGetDisputeStats({ status: "Pending" }, user),
    // Low compliance
    executeGetComplianceOverview({ severity: "critical", limit }, user),
  ]);

  return {
    criticalWorkers: criticalWorkers.workers.slice(0, limit),
    expiredDocs: expiredDocs.expired.slice(0, limit),
    pendingDisputes: pendingDisputes.recentDisputes.slice(0, limit),
    lowCompliance: lowCompliance.worstEmployers.slice(0, limit),
  };
}

async function executeGetPlatformSummary(params: any, user: JwtClaims): Promise<any> {
  const scopeWhere = await buildWorkerScopeWhere(user);

  const [totalWorkers, totalEmployers, totalAgencies, activeDisputes, complianceAlerts, expiringDocs, avgRisk] = await Promise.all([
    prisma.tbl_Worker_PersonalInfo.count({ where: scopeWhere }),
    prisma.tbl_Employer.count(),
    prisma.tbl_Agent.count(),
    prisma.tbl_SalaryDispute.count({ where: { Status: "Pending" } }),
    prisma.tbl_Compliance_Scores.count({ where: { Score: { lt: 70 } } }),
    executeGetDocumentExpiry({ days: 30 }, user),
    prisma.tbl_Worker_Risk_Scores.aggregate({ _avg: { Risk_Score: true } }),
  ]);

  return {
    totalWorkers,
    totalEmployers,
    totalAgencies,
    activeDisputes,
    complianceAlerts,
    documentsExpiringSoon: expiringDocs.totalExpiring,
    avgRiskScore: Math.round(avgRisk._avg.Risk_Score || 0),
  };
}

// ============== TOOL DISPATCH MAP ==============

const toolMap: Record<string, (params: any, user: JwtClaims) => Promise<any>> = {
  get_worker_stats: executeGetWorkerStats,
  get_compliance_overview: executeGetComplianceOverview,
  get_risk_scores: executeGetRiskScores,
  get_dispute_stats: executeGetDisputeStats,
  get_document_expiry: executeGetDocumentExpiry,
  get_employer_summary: executeGetEmployerSummary,
  get_top_risks: executeGetTopRisks,
  get_platform_summary: executeGetPlatformSummary,
};

// ============== MAIN COPILOT FUNCTION ==============

export async function runCopilotQuery(
  message: string,
  history: ChatMessage[],
  user: JwtClaims
): Promise<CopilotResponse> {
  const client = getOpenAIClient();

  if (!client) {
    return {
      reply: "AI Copilot is currently unavailable. Please ensure OPENAI_API_KEY is configured.",
      toolsUsed: [],
    };
  }

  // Limit history to 6 messages to control token usage
  const limitedHistory = history.slice(-6);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...limitedHistory.map((h) => ({ role: h.role, content: h.content }) as OpenAI.Chat.ChatCompletionMessageParam),
    { role: "user", content: message },
  ];

  try {
    // First call: Let OpenAI decide which tools to use
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 600,
    });

    const response = completion.choices[0];
    const toolsUsed: string[] = [];
    const toolResults: any[] = [];

    // Check if any tool calls were made
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      for (const toolCall of response.message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolParams = JSON.parse(toolCall.function.arguments);

        toolsUsed.push(toolName);

        // Execute the tool
        const executor = toolMap[toolName];
        if (executor) {
          const result = await executor(toolParams, user);
          toolResults.push({ tool: toolName, result });

          // Add tool call and result to messages for second OpenAI call
          messages.push({
            role: "assistant",
            tool_calls: [{
              id: toolCall.id,
              type: "function",
              function: { name: toolName, arguments: JSON.stringify(toolParams) },
            }],
            content: "",
          });
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      }

      // Second call: Get final response with tool results
      const finalCompletion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages,
        temperature: 0.3,
        max_tokens: 600,
      });

      const finalResponse = finalCompletion.choices[0]?.message?.content || "I couldn't process that request.";

      return {
        reply: finalResponse,
        toolsUsed,
        data: toolResults,
      };
    }

    // No tool calls - direct response
    return {
      reply: response.message.content || "I understand. How can I help you today?",
      toolsUsed: [],
    };
  } catch (error) {
    console.error("[copilot] OpenAI error:", error);
    return {
      reply: "I'm having trouble connecting to the AI service. Please try again in a moment.",
      toolsUsed: [],
    };
  }
}

// ============== SUGGESTION GENERATOR ==============

export function generateSuggestions(): string[] {
  return [
    "Show me all critical risk workers",
    "Which employer has the worst compliance?",
    "How many documents expire this month?",
    "Show pending disputes over RM 1000",
    "Workers with expired passports",
    "Summary of this week's activity",
  ];
}
