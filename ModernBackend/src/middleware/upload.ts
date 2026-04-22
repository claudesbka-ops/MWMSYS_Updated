import fs from "fs";
import path from "path";
import multer from "multer";
import type { Request } from "express";

/**
 * On-disk upload root. Created at module load so routers can rely on it
 * existing before any request handler runs.
 */
export const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const sharedStorage = multer.diskStorage({
  destination: (_req: Request, _file: any, cb: (error: Error | null, destination: string) => void) =>
    cb(null, uploadsDir),
  filename: (_req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    const safeOriginal = (file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = path.extname(safeOriginal);
    const base = path.basename(safeOriginal, ext);
    cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}_${base}${ext}`);
  },
});

/**
 * Default single-file upload (15 MB cap). Used by worker documents, panic,
 * incidents, attendance photo, etc.
 */
export const upload = multer({
  storage: sharedStorage,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

/**
 * Broadcast message upload (up to 5 files, 50 MB each). Used only by the
 * broadcast endpoints.
 */
export const broadcastUpload = multer({
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
export function safeUnlinkUpload(uploadPath: string | null | undefined) {
  try {
    const p = (uploadPath ?? "").toString();
    if (!p.startsWith("/uploads/")) return;
    const filename = path.basename(p);
    if (!filename) return;
    const full = path.join(uploadsDir, filename);
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
    }
  } catch {
    // ignore
  }
}
