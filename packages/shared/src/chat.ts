// Chat contracts (lobby room chat + in-game chat), shared by REST polling.

export interface ChatMessage {
  id: string;
  scope: "lobby" | "game";
  /** Room id (lobby scope) or game id (game scope). */
  roomId: string;
  userId: string;
  username: string;
  text: string;
  ts: number;
  /** True when sent by a spectator rather than a seated player. */
  isSpectator?: boolean;
}
