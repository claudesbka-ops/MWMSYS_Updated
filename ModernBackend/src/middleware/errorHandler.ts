import type { Request, Response, NextFunction } from "express";

/**
 * Terminal Express error handler. Prisma-aware: translates known
 * schema / connection error codes into friendlier HTTP responses.
 * Must be registered AFTER all routes with `app.use(errorHandler)`.
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const errStr = (err?.message ?? "").toString();
  if (err?.code === "P2021") {
    const message = "Database schema is missing required tables";
    console.error(message, err);
    return res.status(500).json({ error: message, code: "DB_SCHEMA_MISSING" });
  }

  if (/invalid object name/i.test(errStr)) {
    const message = "Database schema is missing required tables";
    console.error(message, err);
    return res.status(500).json({ error: message, code: "DB_SCHEMA_MISSING" });
  }

  if (
    /prisma|econnrefused|failed to connect|timeout|sql|database/i.test(errStr) ||
    err?.code === "P1001" ||
    err?.code === "P1002"
  ) {
    console.error("Database Connection Error", err);
    return res.status(503).json({ error: "Database Connection Error", code: "DB_CONNECTION_ERROR" });
  }

  const message =
    err?.message?.toString?.() ??
    err?.meta?.cause?.toString?.() ??
    err?.meta?.message?.toString?.() ??
    "Internal Server Error";

  const detail = err?.code != null ? `${message} (code=${String(err.code)})` : message;

  console.error("Unhandled error", err);
  return res.status(500).json({ error: detail });
}
