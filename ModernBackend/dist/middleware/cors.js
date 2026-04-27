"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = void 0;
const cors_1 = __importDefault(require("cors"));
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
exports.corsMiddleware = (0, cors_1.default)({
    origin: (origin, cb) => {
        // Allow same-origin/no-origin requests (curl, mobile apps, server-to-server).
        if (!origin)
            return cb(null, true);
        const normalized = origin.replace(/\/+$/, "");
        if (allowList.includes(normalized))
            return cb(null, true);
        return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
});
