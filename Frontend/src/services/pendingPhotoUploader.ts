import { apiClient } from "./apiClient";

/**
 * Bridge between the worker signup wizard (which captures a profile photo
 * BEFORE the account exists) and the post-login flow (which is the first
 * time we have a JWT to authenticate the upload). Photos are stashed in
 * sessionStorage keyed by `userId` and drained the first time the matching
 * user authenticates successfully.
 */

const PENDING_KEY_PREFIX = "pending_worker_photo:";

type StashedPhoto = {
  userId: string;
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

export function stashPendingWorkerPhoto(payload: StashedPhoto): void {
  try {
    sessionStorage.setItem(
      `${PENDING_KEY_PREFIX}${payload.userId}`,
      JSON.stringify(payload),
    );
  } catch {
    // ignore quota / disabled storage
  }
}

export function readPendingWorkerPhoto(userId: string): StashedPhoto | null {
  try {
    const raw = sessionStorage.getItem(`${PENDING_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StashedPhoto;
    if (!parsed?.dataUrl || !parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingWorkerPhoto(userId: string): void {
  try {
    sessionStorage.removeItem(`${PENDING_KEY_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}

function dataUrlToBlob(dataUrl: string, fallbackMime: string): Blob | null {
  try {
    const match = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
    if (!match) return null;
    const mime = (match[1] || fallbackMime || "image/jpeg").trim();
    const b64 = match[2];
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Upload the pending photo for the given user (if any). Safe to call on
 * every successful auth refresh — it clears the entry on success and
 * silently swallows transient errors so AuthContext loading never blocks
 * on this side-effect.
 */
export async function flushPendingWorkerPhoto(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const pending = readPendingWorkerPhoto(userId);
  if (!pending) return false;

  const blob = dataUrlToBlob(pending.dataUrl, pending.mimeType);
  if (!blob) {
    clearPendingWorkerPhoto(userId);
    return false;
  }

  const form = new FormData();
  form.append("photo", blob, pending.fileName || "profile.jpg");

  try {
    await apiClient.post("/Api/Account/UploadPhoto", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    clearPendingWorkerPhoto(userId);
    return true;
  } catch {
    // Leave the entry in place so the next refresh can retry.
    return false;
  }
}
