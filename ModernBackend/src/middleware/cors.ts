import cors from "cors";

/**
 * Global CORS middleware. Currently permissive (matches existing behavior in
 * index.ts). Tighten by passing an options object when the allow-list is
 * finalized for production.
 */
export const corsMiddleware = cors();
