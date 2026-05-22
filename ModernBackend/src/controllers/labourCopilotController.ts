import { Request, Response } from "express";
import { processLabourQuery } from "../services/labourCopilotService";
import type { JwtClaims } from "../middleware/auth";

export async function queryLabourCopilot(req: Request, res: Response) {
  try {
    const user = (req as any).user as JwtClaims;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        error: "Message is required and must be a string",
      });
    }

    if (!Array.isArray(history)) {
      return res.status(400).json({
        success: false,
        error: "History must be an array",
      });
    }

    // Validate history format
    const validHistory = history.every((h: any) => 
      h && 
      typeof h === "object" && 
      ["user", "assistant"].includes(h.role) && 
      typeof h.content === "string"
    );

    if (!validHistory) {
      return res.status(400).json({
        success: false,
        error: "Invalid history format. Each item must have role (user/assistant) and content (string)",
      });
    }

    const result = await processLabourQuery(message, history, user);

    // Add rate limit info if available
    const rateLimit = (req as any).rateLimit;
    
    res.json({
      success: true,
      reply: result.reply,
      toolsUsed: result.toolsUsed,
      data: result.data,
      ...(rateLimit && {
        rateLimit: {
          remaining: rateLimit.remaining,
          reset: rateLimit.reset,
        },
      }),
    });
  } catch (error) {
    console.error("[labour-copilot] Controller error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
