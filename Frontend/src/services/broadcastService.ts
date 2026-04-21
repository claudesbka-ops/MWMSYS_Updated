import { apiClient, getAccessToken } from "./apiClient";
import { io, type Socket } from "socket.io-client";

export type BroadcastMessage = {
  id: number | null;
  senderRoleId: number;
  senderKey: string | null;
  senderName: string | null;
  message: string;
  target: string;
  createdOn: string;
  attachments?: Array<{ id: number; url: string; mime: string | null; originalName: string | null; sizeBytes: number | null }>;
};

export async function getBroadcastFeed(limit?: number): Promise<{ rows: BroadcastMessage[] }> {
  const res = await apiClient.get<{ rows: BroadcastMessage[] }>("/Api/Broadcast/Feed", { params: limit ? { limit } : undefined });
  return res.data as { rows: BroadcastMessage[] };
}

export async function sendBroadcast(message: string): Promise<{ ok: true; payload: BroadcastMessage }> {
  const res = await apiClient.post<{ ok: true; payload: BroadcastMessage }>("/Api/Broadcast/Send", { message });
  return res.data as { ok: true; payload: BroadcastMessage };
}

export async function sendBroadcastMultipart(params: { message: string; files: File[] }): Promise<{ ok: true; payload: BroadcastMessage }> {
  const fd = new FormData();
  fd.append("message", params.message);
  for (const f of params.files) fd.append("files", f);

  const res = await apiClient.post<{ ok: true; payload: BroadcastMessage }>("/Api/Broadcast/SendMultipart", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as { ok: true; payload: BroadcastMessage };
}

export function createBroadcastSocket(socketUrl: string): Socket {
  const token = getAccessToken();
  const s = io(socketUrl, {
    transports: ["websocket"],
    auth: token ? { token } : undefined,
    reconnection: true,
  });
  return s;
}
