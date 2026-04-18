import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export type JwtClaims = {
  userId: number;
  userKey?: string;
  roleId?: number;
  appRole?: "admin" | "employer" | "worker" | "agency" | "embassy_source" | "embassy_destination" | "labour";
  countryCode?: number;
  emailId?: string;
  userName?: string;
};

export function signToken(claims: JwtClaims): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  return jwt.sign(claims, secret, { expiresIn: "1d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") || req.header("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = header.slice("bearer ".length).trim();
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtClaims;
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function checkRole(allowedRoleIds: number[]) {
  const allowed = new Set(allowedRoleIds.map((x) => Number(x)).filter((x) => Number.isFinite(x)));

  return function checkRoleMiddleware(req: Request, res: Response, next: NextFunction) {
    const roleId = Number((req as any).user?.roleId ?? 0);
    if (allowed.has(roleId)) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}
