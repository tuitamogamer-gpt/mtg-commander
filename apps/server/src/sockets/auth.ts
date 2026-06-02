import type { Socket } from "socket.io";
import { AUTH_COOKIE, verifyToken } from "../auth/jwt.js";

export interface SocketUser {
  id: string;
  username: string;
}

declare module "socket.io" {
  interface SocketData {
    user: SocketUser;
  }
}

/** Parse a Cookie header into a map. */
function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

/**
 * Socket.IO middleware that authenticates a connection from the same httpOnly
 * JWT cookie used by the REST API. Rejects unauthenticated connections.
 */
export function socketAuth(socket: Socket, next: (err?: Error) => void): void {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const token = cookies[AUTH_COOKIE];
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    next(new Error("Not authenticated"));
    return;
  }
  socket.data.user = { id: payload.sub, username: payload.username };
  next();
}
