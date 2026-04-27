import cors from "cors";

/**
 * Global CORS middleware.
 *
 * Allow-list is taken from the CORS_ORIGINS env var (comma-separated). If unset,
 * CORS is permissive (any origin) to keep local dev / mobile clients working.
 */
const envOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const defaultOrigins = [
  "https://mwmsys-master.vercel.app",
];

const allowList = envOrigins.length ? envOrigins : defaultOrigins;

export const corsMiddleware = cors({
  origin: (origin, cb) => {
    // Allow same-origin/no-origin requests (curl, mobile apps, server-to-server).
    if (!origin) return cb(null, true);
    const normalized = origin.replace(/\/+$/, "");
    if (allowList.includes(normalized)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
});
