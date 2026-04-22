"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastUpload = exports.upload = exports.uploadsDir = void 0;
exports.safeUnlinkUpload = safeUnlinkUpload;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
/**
 * On-disk upload root. Created at module load so routers can rely on it
 * existing before any request handler runs.
 */
exports.uploadsDir = path_1.default.join(process.cwd(), "uploads");
fs_1.default.mkdirSync(exports.uploadsDir, { recursive: true });
const sharedStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, exports.uploadsDir),
    filename: (_req, file, cb) => {
        const safeOriginal = (file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
        const ext = path_1.default.extname(safeOriginal);
        const base = path_1.default.basename(safeOriginal, ext);
        cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}_${base}${ext}`);
    },
});
/**
 * Default single-file upload (15 MB cap). Used by worker documents, panic,
 * incidents, attendance photo, etc.
 */
exports.upload = (0, multer_1.default)({
    storage: sharedStorage,
    limits: {
        fileSize: 15 * 1024 * 1024,
    },
});
/**
 * Broadcast message upload (up to 5 files, 50 MB each). Used only by the
 * broadcast endpoints.
 */
exports.broadcastUpload = (0, multer_1.default)({
    storage: sharedStorage,
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 5,
    },
});
/**
 * Best-effort delete of a previously uploaded file that lives inside
 * `/uploads/`. No-ops on any error or when the path is not under the
 * uploads directory (defense against path traversal).
 */
function safeUnlinkUpload(uploadPath) {
    try {
        const p = (uploadPath ?? "").toString();
        if (!p.startsWith("/uploads/"))
            return;
        const filename = path_1.default.basename(p);
        if (!filename)
            return;
        const full = path_1.default.join(exports.uploadsDir, filename);
        if (fs_1.default.existsSync(full)) {
            fs_1.default.unlinkSync(full);
        }
    }
    catch {
        // ignore
    }
}
