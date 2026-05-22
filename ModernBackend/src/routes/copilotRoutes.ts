import { Router } from "express";
import { requireAuth, checkRole } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimitMiddleware";
import { queryCopilot, getSuggestions } from "../controllers/copilotController";
import { queryEmbassyCopilot } from "../controllers/embassyCopilotController";
import { queryLabourCopilot } from "../controllers/labourCopilotController";

const router = Router();

// Pattern 1: Full explicit paths (mounted in index.ts)

// Main query endpoint - Admin and Agency only (AI rate limited)
router.post("/Api/Copilot/Query", requireAuth, aiRateLimiter, queryCopilot);

// Get suggestion questions
router.get("/Api/Copilot/Suggestions", requireAuth, getSuggestions);

// Embassy AI Copilot - Embassy roles only (AI rate limited)
router.post("/Api/Copilot/EmbassyQuery", requireAuth, checkRole([5, 6]), aiRateLimiter, queryEmbassyCopilot);

// Labour Dept AI Copilot - Labour role only (AI rate limited)  
router.post("/Api/Copilot/LabourQuery", requireAuth, checkRole([7]), aiRateLimiter, queryLabourCopilot);

export { router as copilotRouter };
