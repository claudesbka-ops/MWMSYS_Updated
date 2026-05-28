import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from "express";

const skipFn = (req: Request) => !!(
  process.env.TEST_BYPASS_KEY &&
  req.headers['x-test-bypass'] === process.env.TEST_BYPASS_KEY
);

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many attempts. Try again in 15 minutes.",
    });
  },
  skipSuccessfulRequests: false,
  skip: skipFn,
});

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user, not per IP
    return String((req as any).user?.userId ?? req.ip);
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "AI request limit reached. Try again in 1 hour.",
    });
  },
  skip: skipFn,
});

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests. Slow down.",
    });
  },
  skip: skipFn,
});
