// Socket.IO event contracts shared by client and server.

import type { Room, RoomSummary, RoomSettings } from "./lobby.js";
import type { GameStateView, GameActionMessage, GameCard } from "./game.js";

export interface ChatMessage {
  id: string;
  scope: "lobby" | "game";
  roomId: string;
  userId: string;
  username: string;
  text: string;
  ts: number;
  /** True when sent by a spectator rather than a seated player. */
  isSpectator?: boolean;
}

// --- Lobby namespace (/lobby) ----------------------------------------------

export interface LobbyClientToServer {
  "lobby:list_rooms": (ack: (rooms: RoomSummary[]) => void) => void;
  "lobby:create_room": (
    payload: { name: string; maxPlayers: number; settings?: Partial<RoomSettings> },
    ack: (res: SocketResult<Room>) => void
  ) => void;
  "lobby:join_room": (payload: { roomId: string }, ack: (res: SocketResult<Room>) => void) => void;
  "lobby:leave_room": (payload: { roomId: string }, ack: (res: SocketResult<null>) => void) => void;
  "lobby:set_deck": (payload: { roomId: string; deckId: string }, ack: (res: SocketResult<Room>) => void) => void;
  "lobby:ready": (payload: { roomId: string; ready: boolean }, ack: (res: SocketResult<Room>) => void) => void;
  "lobby:start_game": (payload: { roomId: string }, ack: (res: SocketResult<{ gameId: string }>) => void) => void;
  "lobby:chat": (payload: { roomId: string; text: string }) => void;
}

export interface LobbyServerToClient {
  "lobby:rooms": (rooms: RoomSummary[]) => void;
  "lobby:room_updated": (room: Room) => void;
  "lobby:game_started": (payload: { gameId: string }) => void;
  "lobby:chat": (msg: ChatMessage) => void;
  "lobby:error": (msg: string) => void;
}

// --- Game namespace (/game) ------------------------------------------------

export interface GameClientToServer {
  "game:join": (payload: { gameId: string }, ack: (res: SocketResult<GameStateView>) => void) => void;
  "game:action": (payload: GameActionMessage, ack?: (res: SocketResult<null>) => void) => void;
  "game:chat": (payload: { gameId: string; text: string }) => void;
  "game:request_state": (payload: { gameId: string }, ack: (res: SocketResult<GameStateView>) => void) => void;
  /** Privately peek at the top `count` cards of your own library (scry / look /
   * tutor). Pass a large count to view the whole library. Does not mutate state. */
  "game:peek": (
    payload: { gameId: string; count: number },
    ack: (res: SocketResult<GameCard[]>) => void
  ) => void;
  /** Undo the most recent applied action, restoring the prior snapshot. */
  "game:undo": (payload: { gameId: string }, ack?: (res: SocketResult<null>) => void) => void;
  /** End the game and record a match result (winnerId optional = draw/no winner). */
  "game:end": (
    payload: { gameId: string; winnerId: string | null },
    ack?: (res: SocketResult<null>) => void
  ) => void;
}

export interface GameServerToClient {
  "game:state": (state: GameStateView) => void;
  "game:log": (entry: { ts: number; playerId: string; message: string }) => void;
  "game:chat": (msg: ChatMessage) => void;
  "game:player_connection": (payload: { playerId: string; connected: boolean }) => void;
  "game:error": (msg: string) => void;
}

// --- Helpers ---------------------------------------------------------------

export type SocketResult<T> = { ok: true; data: T } | { ok: false; error: string };
