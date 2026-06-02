import type { Server as SocketServer } from "socket.io";

/**
 * Register all Socket.IO namespaces. Lobby and game handlers are wired up in
 * later phases; for now this is the single attach point.
 */
export function registerSockets(_io: SocketServer): void {
  // Phase 8: registerLobbyNamespace(io)
  // Phase 9: registerGameNamespace(io)
}
