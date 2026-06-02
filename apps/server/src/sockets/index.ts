import type { Server as SocketServer } from "socket.io";
import { registerLobbyNamespace } from "./lobby.js";
import { registerGameNamespace } from "./game.js";

/** Register all Socket.IO namespaces. */
export function registerSockets(io: SocketServer): void {
  registerLobbyNamespace(io);
  registerGameNamespace(io);
}
