// Lobby / room contracts.

export type RoomStatus = "waiting" | "in_game";

export type MulliganRule = "free7-then-london" | "london" | "none";

export interface RoomSettings {
  startingLife: number;
  mulligan: MulliganRule;
}

export interface RoomPlayer {
  id: string;
  username: string;
  /** Selected deck id (user deck), or null until chosen. */
  deckId: string | null;
  deckName: string | null;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  players: RoomPlayer[];
  maxPlayers: number;
  settings: RoomSettings;
  status: RoomStatus;
  /** Set once the game starts. */
  gameId: string | null;
}

export interface RoomSummary {
  id: string;
  name: string;
  hostUsername: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  startingLife: 40,
  mulligan: "free7-then-london",
};
