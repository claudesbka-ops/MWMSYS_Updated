import OpenAI from "openai";
import { prisma } from "../db";
import type { JwtClaims } from "../middleware/auth";

/**
 * MWMSYS Labour Department AI Copilot Service
 * Uses OpenAI function calling to answer natural language queries
 * about workforce compliance, violations, and systemic issues.
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
    console.error("[labour-copilot] failed to create OpenAI client", err);
    return null;
  }
}

const SYSTEM_PROMPT = `You are the AI Copilot for the Labour Department. You help labour officers monitor workforce compliance, identify violations, and detect unusual patterns across all employers and agencies in the system.

You have access to tools with full platform visibility. Always use tools before answering. Focus on compliance violations, dispute trends, and employer risk rankings. Highlight systemic issues and anomalies.

When presenting data:
- Be concise and actionable
- Highlight critical issues first
- Suggest next steps when relevant
- Use plain language, not technical jargon
- Focus on systemic patterns and violations`;

export async function processLabourQuery(
  message: string,
  history: ChatMessage[],
  user: JwtClaims
): Promise<CopilotResponse> {
  const client = getOpenAIClient();
  if (!client) {
    return {
      reply: "AI service is temporarily unavailable. Please try again later.",
      toolsUsed: [],
    };
  }

  try {
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "get_workforce_summary",
          description: "Get platform-wide workforce statistics",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_dispute_stats",
          description: "Get salary dispute information",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["Pending", "Accepted", "Rejected"], description: "Dispute status" },
              days: { type: "number", description: "Disputes from last N days" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_employer_summary",
          description: "Get employer list with key metrics",
          parameters: {
            type: "object",
            properties: {
              maxComplianceScore: { type: "number", description: "Maximum compliance score (lower = worse)" },
            },
          },
        },
      },
    ];

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: message },
    ];

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 600,
    });

    const assistantMessage = response.choices[0]?.message;
    if (!assistantMessage) {
      return {
        reply: "I couldn't process your request. Please try again.",
        toolsUsed: [],
      };
    }

    const toolsUsed: string[] = [];
    let toolResults: any[] = [];

    if (assistantMessage.tool_calls) {
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = (toolCall as any).function.name;
        const args = JSON.parse((toolCall as any).function.arguments || "{}");
        toolsUsed.push(functionName);

        try {
          const result = await executeLabourTool(functionName, args);
          toolResults.push({
            tool_call_id: toolCall.id,
            result,
          });
        } catch (error) {
          console.error(`[labour-copilot] Tool ${functionName} error:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            result: { error: "Failed to fetch data" },
          });
        }
      }

      // Get final response with tool results
      const finalMessages = [
        ...messages,
        assistantMessage,
        ...toolResults.map(tr => ({
          role: "tool",
          tool_call_id: tr.tool_call_id,
          content: JSON.stringify(tr.result),
        })),
      ];

      const finalResponse = await client.chat.completions.create({
        model: "gpt-4o",
        messages: finalMessages,
        temperature: 0.3,
        max_tokens: 600,
      });

      return {
        reply: finalResponse.choices[0]?.message?.content || "I couldn't process your request.",
        toolsUsed,
        data: toolResults.map(tr => tr.result),
      };
    }

    return {
      reply: assistantMessage.content || "I couldn't process your request.",
      toolsUsed,
    };
  } catch (error) {
    console.error("[labour-copilot] Query error:", error);
    return {
      reply: "An error occurred while processing your request. Please try again.",
      toolsUsed: [],
    };
  }
}

async function executeLabourTool(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case "get_workforce_summary":
      return await getWorkforceSummary();
    
    case "get_dispute_stats":
      return await getDisputeStats(args.status, args.days);
    
    case "get_employer_summary":
      return await getEmployerSummary(args.maxComplianceScore);
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function getWorkforceSummary(): Promise<any> {
  const [
    totalWorkers,
    totalEmployers,
    totalAgencies,
    activeDisputes,
  ] = await Promise.all([
    prisma.tbl_Worker_PersonalInfo.count(),
    prisma.tbl_Employer.count(),
    prisma.tbl_Agent.count(),
    prisma.tbl_SalaryDispute.count({ where: { Status: "Pending" } }),
  ]);

  return {
    totalWorkers,
    totalEmployers,
    totalAgencies,
    activeDisputes,
  };
}

async function getDisputeStats(status?: string, days?: number): Promise<any> {
  const whereClause: any = {};
  if (status) whereClause.Status = status;
  if (days) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    whereClause.CreatedOn = { gte: cutoffDate };
  }

  const disputes = await prisma.tbl_SalaryDispute.findMany({
    where: whereClause,
    take: 50,
    orderBy: { Submitted_At: "desc" },
  });

  return {
    total: disputes.length,
    disputes: disputes.map((d: any) => ({
      id: d.Id,
      workerId: d.Worker_Id,
      employerId: d.Employer_Id,
      amount: d.Expected_Amount,
      status: d.Status,
      severity: d.Ai_Severity_Score,
      date: d.CreatedOn,
    })),
  };
}

async function getEmployerSummary(maxComplianceScore?: number): Promise<any> {
  const employers = await prisma.tbl_Employer.findMany({
    take: 50,
  });

  const result = employers.map((employer: any) => ({
    id: employer.ID,
    name: employer.Employer_Name,
    workerCount: Math.floor(Math.random() * 100), // Placeholder - would need proper relationship query
    complianceScore: Math.floor(Math.random() * 100), // Placeholder
  }));

  if (maxComplianceScore) {
    return result.filter((e: any) => e.complianceScore <= maxComplianceScore);
  }

  return result;
}
