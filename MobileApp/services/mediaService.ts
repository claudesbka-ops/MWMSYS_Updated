import * as ImagePicker from "expo-image-picker";
import { useSession } from "@/contexts/SessionContext";

export type CapturedPhoto = {
  uri: string;
  width: number;
  height: number;
  mimeType?: string;
  fileName?: string;
};

export type UploadResult = {
  url: string;
  path: string;
};

/**
 * Prompts the user to capture a selfie via the device camera.
 * Returns null if the user cancels or denies permission.
 */
export async function captureSelfie(): Promise<CapturedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.6,
    cameraType: ImagePicker.CameraType.front,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    width: a.width,
    height: a.height,
    mimeType: a.mimeType,
    fileName: a.fileName ?? undefined,
  };
}

/**
 * Hook that exposes media upload utilities bound to the current session.
 */
export function useMediaService() {
  const { apiBaseUrl, token } = useSession();

  async function uploadAttendancePhoto(photo: CapturedPhoto): Promise<UploadResult> {
    const url = apiBaseUrl.replace(/\/+$/, "") + "/Api/HRMS/Attendance/Photo";
    const form = new FormData();

    const name =
      photo.fileName ||
      `attendance_${Date.now()}.${inferExtension(photo.mimeType, photo.uri)}`;
    const type = photo.mimeType || inferMime(photo.uri) || "image/jpeg";

    // React Native FormData file descriptor (RN runtime accepts this shape; TS DOM types do not)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - RN FormData file shape
    form.append("file", { uri: photo.uri, name, type } as any);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // DO NOT set Content-Type manually; RN sets the multipart boundary.
      },
      body: form as any,
    });

    const text = await res.text();
    const data = text ? safeJson(text) : null;

    if (!res.ok) {
      const err: any = data && typeof data === "object" ? data : { error: String(data ?? res.statusText) };
      err.status = res.status;
      throw err;
    }

    return data as UploadResult;
  }

  return { captureSelfie, uploadAttendancePhoto };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function inferExtension(mime?: string, uri?: string): string {
  if (mime?.includes("png")) return "png";
  if (mime?.includes("heic")) return "heic";
  const m = uri?.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
  return (m?.[1] ?? "jpg").toLowerCase();
}

function inferMime(uri?: string): string | null {
  if (!uri) return null;
  const ext = uri.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)?.[1]?.toLowerCase();
  if (!ext) return null;
  if (ext === "png") return "image/png";
  if (ext === "heic") return "image/heic";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
