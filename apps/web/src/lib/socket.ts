import { io, type Socket } from "socket.io-client";
import type {
  LobbyClientToServer,
  LobbyServerToClient,
  GameClientToServer,
  GameServerToClient,
} from "@mtgc/shared";

export type LobbySocket = Socket<LobbyServerToClient, LobbyClientToServer>;
export type GameSocket = Socket<GameServerToClient, GameClientToServer>;

// Same-origin in dev (Vite proxies /socket.io). In a split-origin deploy, point
// at the API origin via VITE_API_URL. One socket per namespace, reused across
// routes; withCredentials sends the auth cookie (cross-site needs SameSite=None).
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

let lobbySocket: LobbySocket | null = null;
let gameSocket: GameSocket | null = null;

export function getLobbySocket(): LobbySocket {
  if (!lobbySocket) {
    lobbySocket = io(`${API_BASE}/lobby`, { withCredentials: true, transports: ["websocket", "polling"] });
  }
  return lobbySocket;
}

export function getGameSocket(): GameSocket {
  if (!gameSocket) {
    gameSocket = io(`${API_BASE}/game`, { withCredentials: true, transports: ["websocket", "polling"] });
  }
  return gameSocket;
}

/**
 * Tear down both sockets so the next use re-handshakes with the current auth
 * cookie. Must be called on login/logout — otherwise a socket can stay
 * authenticated as a previous user (and e.g. reject "your" decks).
 */
export function resetSockets(): void {
  if (lobbySocket) {
    lobbySocket.removeAllListeners();
    lobbySocket.disconnect();
    lobbySocket = null;
  }
  if (gameSocket) {
    gameSocket.removeAllListeners();
    gameSocket.disconnect();
    gameSocket = null;
  }
}

/** Promisify an emit-with-ack call returning the shared SocketResult shape. */
export function emitAck<T>(
  socket: Socket,
  event: string,
  payload?: unknown
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const cb = (res: { ok: true; data: T } | { ok: false; error: string }) => resolve(res);
    if (payload === undefined) socket.emit(event, cb);
    else socket.emit(event, payload, cb);
  });
}
