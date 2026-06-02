import type { Server as SocketServer } from "socket.io";
import { registerLobbyNamespace } from "./lobby.js";

/** Register all Socket.IO namespaces. */
export function registerSockets(io: SocketServer): void {
  registerLobbyNamespace(io);
  // Faza 9: registerGameNamespace(io)
}
