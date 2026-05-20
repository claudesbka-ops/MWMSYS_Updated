import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { queryCopilot, getSuggestions } from "../controllers/copilotController";

const router = Router();

// Pattern 1: Full explicit paths (mounted in index.ts)

// Main query endpoint - Admin and Agency only
router.post("/Api/Copilot/Query", requireAuth, queryCopilot);

// Get suggestion questions
router.get("/Api/Copilot/Suggestions", requireAuth, getSuggestions);

export { router as copilotRouter };
