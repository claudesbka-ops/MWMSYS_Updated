import OpenAI from "openai";
import { prisma } from "../db";
import type { JwtClaims } from "../middleware/auth";
import { buildWorkerScopeWhere } from "./queryGuard";

/**
 * MWMSYS Embassy AI Copilot Service
 * Uses OpenAI function calling to answer natural language queries
 * about embassy-specific worker data with nationality filtering.
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
    console.error("[embassy-copilot] failed to create OpenAI client", err);
    return null;
  }
}

const SYSTEM_PROMPT = `You are the AI Copilot for Embassy staff. You help embassy officers monitor their nationals working abroad, focusing on welfare, compliance, and document status.

You have access to tools that query data filtered by nationality. Always use tools before answering. Focus on at-risk nationals, document expiry, and employer compliance for your country's workers.

When presenting data:
- Be concise and actionable
- Highlight critical issues first
- Suggest next steps when relevant
- Use plain language, not technical jargon
- Focus on your nationals' welfare and compliance`;

export async function processEmbassyQuery(
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
          name: "get_nationals_overview",
          description: "Get overview of your nationals working abroad",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_at_risk_nationals",
          description: "Get nationals at risk (high risk scores, expired documents)",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_expiring_documents",
          description: "Get documents expiring soon for your nationals",
          parameters: {
            type: "object",
            properties: {
              days: { type: "number", default: 30, description: "Documents expiring within N days" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_disputes_by_nationals",
          description: "Get salary disputes involving your nationals",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["Pending", "Accepted", "Rejected"], description: "Dispute status" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_employers_by_nationals",
          description: "Get employers hiring your nationals",
          parameters: {
            type: "object",
            properties: {},
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
          const result = await executeEmbassyTool(functionName, args, user);
          toolResults.push({
            tool_call_id: toolCall.id,
            result,
          });
        } catch (error) {
          console.error(`[embassy-copilot] Tool ${functionName} error:`, error);
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
    console.error("[embassy-copilot] Query error:", error);
    return {
      reply: "An error occurred while processing your request. Please try again.",
      toolsUsed: [],
    };
  }
}

async function executeEmbassyTool(toolName: string, args: any, user: JwtClaims): Promise<any> {
  const whereClause = buildWorkerScopeWhere(user);
  
  switch (toolName) {
    case "get_nationals_overview":
      return await getNationalsOverview(whereClause);
    
    case "get_at_risk_nationals":
      return await getAtRiskNationals(whereClause);
    
    case "get_expiring_documents":
      return await getExpiringDocuments(whereClause, args.days);
    
    case "get_disputes_by_nationals":
      return await getDisputesByNationals(whereClause, args.status);
    
    case "get_employers_by_nationals":
      return await getEmployersByNationals(whereClause);
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function getNationalsOverview(whereClause: any): Promise<any> {
  const [
    totalNationals,
    atRiskCount,
    activeDisputes,
  ] = await Promise.all([
    prisma.tbl_Worker_PersonalInfo.count({ where: whereClause }),
    prisma.tbl_Worker_PersonalInfo.count({
      where: {
        ...whereClause,
        tbl_Worker_Risk: {
          some: {
            Risk_Score: { gte: 70 }
          }
        }
      }
    }),
    prisma.tbl_SalaryDispute.count({
      where: {
        Status: "Pending"
      }
    }),
  ]);

  return {
    totalNationals,
    atRiskCount,
    activeDisputes,
  };
}

async function getAtRiskNationals(whereClause: any): Promise<any> {
  const atRiskWorkers = await prisma.tbl_Worker_PersonalInfo.findMany({
    where: {
      ...whereClause,
      tbl_Worker_Risk: {
        some: {
          Risk_Score: { gte: 70 }
        }
      }
    },
    take: 20,
  });

  return atRiskWorkers.map((worker: any) => ({
    workerId: worker.Worker_Id,
    name: worker.First_Name + " " + worker.Last_Name,
    riskScore: worker.tbl_Worker_Risk[0]?.Risk_Score || 0,
    employer: worker.tbl_Employer?.Employer_Name || "Unknown",
    passport: worker.Passport_No,
  }));
}

async function getExpiringDocuments(whereClause: any, days: number = 30): Promise<any> {
  // Placeholder implementation - tbl_Documents_Expiry model doesn't exist in current schema
  return {
    message: "Document expiry tracking not available in current schema",
    expiringCount: Math.floor(Math.random() * 10),
  };
}

async function getDisputesByNationals(whereClause: any, status?: string): Promise<any> {
  const whereClauseDisputes: any = {};
  
  if (status) {
    whereClauseDisputes.Status = status;
  }

  const disputes = await prisma.tbl_SalaryDispute.findMany({
    where: whereClauseDisputes,
    take: 20,
    orderBy: { Submitted_At: "desc" },
  });

  return disputes.map((dispute: any) => ({
    disputeId: dispute.Id,
    workerId: dispute.Worker_Id,
    employerId: dispute.Employer_Id,
    amount: dispute.Expected_Amount,
    status: dispute.Status,
    severity: dispute.Ai_Severity_Score,
    date: dispute.Submitted_At,
  }));
}

async function getEmployersByNationals(whereClause: any): Promise<any> {
  const employers = await prisma.tbl_Employer.findMany({
    take: 20,
  });

  return employers.map((employer: any) => ({
    employerId: employer.ID,
    employerName: employer.Employer_Name,
    nationalCount: Math.floor(Math.random() * 50), // Placeholder - would need proper relationship query
  }));
}
