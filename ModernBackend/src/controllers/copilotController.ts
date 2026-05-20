import { Request, Response } from "express";
import { runCopilotQuery, generateSuggestions, ChatMessage } from "../services/copilotService";
import type { JwtClaims } from "../middleware/auth";

// Rate limiting: 20 requests per hour per user (in-memory)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record || now > record.resetTime) {
    // New window
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

/**
 * POST /Api/Copilot/Query
 * Process a natural language query and return AI response
 */
export async function queryCopilot(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user as JwtClaims;
    const userId = user?.userId;
    const userRole = user?.roleId;

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // Admin (1) and Agency (4) only
    if (userRole !== 1 && userRole !== 4) {
      res.status(403).json({ success: false, error: "Forbidden - Admin and Agency only" });
      return;
    }

    // Rate limiting
    const rateCheck = checkRateLimit(String(userId));
    if (!rateCheck.allowed) {
      res.status(429).json({
        success: false,
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: "1 hour",
      });
      return;
    }

    const { message, history } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ success: false, error: "Message is required" });
      return;
    }

    // Max message length: 500 chars
    if (message.length > 500) {
      res.status(400).json({ success: false, error: "Message exceeds 500 character limit" });
      return;
    }

    // Validate history format
    const validHistory: ChatMessage[] = Array.isArray(history)
      ? history.slice(-6).filter((h: any) =>
          h && typeof h === "object" &&
          (h.role === "user" || h.role === "assistant") &&
          typeof h.content === "string"
        )
      : [];

    const result = await runCopilotQuery(message, validHistory, user);

    res.json({
      success: true,
      reply: result.reply,
      toolsUsed: result.toolsUsed,
      data: result.data,
      rateLimit: {
        remaining: rateCheck.remaining,
        limit: RATE_LIMIT,
      },
    });
  } catch (error) {
    console.error("[copilotController] queryCopilot error:", error);
    res.status(500).json({
      success: false,
      error: "AI Copilot is currently unavailable. Please try again.",
    });
  }
}

/**
 * GET /Api/Copilot/Suggestions
 * Return starter questions based on current data state
 */
export async function getSuggestions(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user as JwtClaims;
    const userId = user?.userId;
    const userRole = user?.roleId;

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // Admin (1) and Agency (4) only
    if (userRole !== 1 && userRole !== 4) {
      res.status(403).json({ success: false, error: "Forbidden - Admin and Agency only" });
      return;
    }

    const suggestions = generateSuggestions();

    res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error("[copilotController] getSuggestions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate suggestions",
    });
  }
}
