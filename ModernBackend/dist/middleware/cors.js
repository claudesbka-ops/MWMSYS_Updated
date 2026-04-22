"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = void 0;
const cors_1 = __importDefault(require("cors"));
/**
 * Global CORS middleware. Currently permissive (matches existing behavior in
 * index.ts). Tighten by passing an options object when the allow-list is
 * finalized for production.
 */
exports.corsMiddleware = (0, cors_1.default)();
