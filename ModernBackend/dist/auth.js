"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.requireAuth = requireAuth;
exports.checkRole = checkRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function signToken(claims) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not set");
    }
    return jsonwebtoken_1.default.sign(claims, secret, { expiresIn: "1d" });
}
function requireAuth(req, res, next) {
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
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = decoded;
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}
function checkRole(allowedRoleIds) {
    const allowed = new Set(allowedRoleIds.map((x) => Number(x)).filter((x) => Number.isFinite(x)));
    return function checkRoleMiddleware(req, res, next) {
        const roleId = Number(req.user?.roleId ?? 0);
        if (allowed.has(roleId))
            return next();
        return res.status(403).json({ error: "Forbidden" });
    };
}
