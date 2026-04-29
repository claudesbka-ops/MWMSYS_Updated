import type http from "http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";

import { resolveWorkerScopes } from "./workerScopes";

/**
 * Module-scoped Socket.IO singleton. Initialized exactly once via
 * `initSocket(httpServer)` during server bootstrap and then obtained
 * from any router via `getIO()`.
 */
let ioInstance: Server | null = null;

/**
 * Initialize the Socket.IO server against the given HTTP server and
 * install the JWT-authenticated room-join handshake. Safe to call
 * multiple times — subsequent calls return the already-initialized
 * instance.
 */
export function initSocket(httpServer: http.Server): Server {
  if (ioInstance) return ioInstance;

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:8081",
    },
  });

  io.on("connection", (socket: Socket) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return;
      const raw = typeof token === "string" ? token : "";
      const bearer = raw.toLowerCase().startsWith("bearer ") ? raw.slice("bearer ".length).trim() : raw;
      const secret = process.env.JWT_SECRET;
      if (!secret || !bearer) return;

      const decoded = jwt.verify(bearer, secret) as any;
      const roleId = decoded?.roleId != null ? Number(decoded.roleId) : null;
      const userKey = (decoded?.userKey ?? "").toString().trim();
      const countryCode = decoded?.countryCode != null ? Number(decoded.countryCode) : NaN;

      socket.join("broadcast_all");

      if (roleId === 1) {
        socket.join("admin");
        console.log("ALERTS: User joined admin room");
      }

      if (roleId === 3 && userKey) {
        socket.join("employers");
        socket.join(`employer:${userKey}`);
      }
      if (roleId === 4 && userKey) {
        socket.join("agencies");
        socket.join(`agency:${userKey}`);
      }

      if (roleId === 2 && userKey) {
        socket.join("workers");
        socket.join(`worker:${userKey}`);
        resolveWorkerScopes(userKey)
          .then((s) => {
            if (s.employerId) socket.join(`employer:${s.employerId}`);
            for (const id of s.agencyIds) socket.join(`agency:${id}`);
            if (s.nationality != null) socket.join(`nationality:${s.nationality}`);
          })
          .catch(() => undefined);
      }

      if (roleId === 7) {
        socket.join("labour");
        if (Number.isFinite(countryCode)) socket.join(`nationality:${countryCode}`);
      }

      const isPanicViewer = roleId === 1 || roleId === 3 || roleId === 4 || roleId === 5 || roleId === 6 || roleId === 7;
      if (isPanicViewer) {
        socket.join("panic_viewers");
      }

      const isAuthority = roleId === 1 || roleId === 4 || roleId === 5 || roleId === 6 || roleId === 7;
      if (isAuthority) {
        socket.join("authorities");
      }

      if (roleId === 5) {
        socket.join("embassy_source");
        if (Number.isFinite(countryCode)) socket.join(`nationality:${countryCode}`);
      }
      if (roleId === 6) {
        socket.join("embassy_destination");
        if (Number.isFinite(countryCode)) socket.join(`nationality:${countryCode}`);
      }
    } catch (e: any) {
      // Don't crash the connection — surface a structured error to the client
      // so it can prompt the user to log in again instead of silently failing.
      const isExpired = e?.name === "TokenExpiredError";
      if (isExpired) {
        socket.emit("auth_error", { error: "token_expired" });
      } else {
        socket.emit("auth_error", { error: "invalid_token" });
        console.warn("socket auth rejected", e?.message ?? e);
      }
    }
  });

  ioInstance = io;
  return io;
}

/**
 * Returns the initialized Socket.IO server. Throws if called before
 * `initSocket()` — router files that emit events should import and
 * call this lazily (inside handlers, not at module top-level) so the
 * server has already been initialized.
 */
export function getIO(): Server {
  if (!ioInstance) {
    throw new Error("Socket.IO not initialized. Call initSocket(httpServer) during bootstrap first.");
  }
  return ioInstance;
}
