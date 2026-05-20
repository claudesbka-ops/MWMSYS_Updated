import rateLimit from "express-rate-limit";

const TEST_BYPASS_KEY = process.env.TEST_BYPASS_KEY;
const skipFn = (req: any) =>
  !!(TEST_BYPASS_KEY && req.headers["x-test-bypass"] === TEST_BYPASS_KEY);

// Tier 1: Auth endpoints (strictest)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipFn,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many attempts. Try again in 15 minutes.",
    });
  },
  skipSuccessfulRequests: false,
});

// Tier 2: AI endpoints (cost protection)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipFn,
  keyGenerator: (req) => {
    // Rate limit per user, not per IP
    return String((req as any).user?.userId ?? req.ip);
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "AI request limit reached. Try again in 1 hour.",
    });
  },
});

// Tier 3: General API (abuse prevention)
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipFn,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests. Slow down.",
    });
  },
});
