import type { Request, Response, NextFunction } from "express";

const noop = (_req: Request, _res: Response, next: NextFunction) => next();

export const authRateLimiter = noop;
export const aiRateLimiter = noop;
export const generalRateLimiter = noop;
