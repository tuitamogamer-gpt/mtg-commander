import { nanoid } from "nanoid";
import type { GameAction, GameState, GameStateView, Room } from "@mtgc/shared";
import { prisma } from "../db.js";
import { parseCards } from "../services/deck.js";
import { buildInitialGameState, redactState, type SeatInput } from "./state.js";
import { applyAction } from "./actions.js";

/**
 * Stateless game store for the serverless/polling architecture. Every operation
 * loads the authoritative GameState from the DB, mutates, and saves it back with
 * an optimistic-concurrency guard on `version` (retried once on conflict).
 * Presence is a lastSeenAt heartbeat refreshed by each player's state poll;
 * `connected`/`disconnectedAt` are derived at read time.
 */

/** A player counts as connected if they polled within this window. */
const PRESENCE_WINDOW_MS = 12_000;
/** Throttle heartbeat writes so polling doesn't write on every request. */
const PRESENCE_WRITE_MS = 5_000;
/** How many pre-action snapshots to keep for undo. */
const HISTORY_LIMIT = 10;

interface GameRow {
  state: GameState;
  version: number;
  history: string[];
}

function derivePresence(state: GameState): GameState {
  const now = Date.now();
  for (const p of state.players) {
    const last = p.lastSeenAt ?? 0;
    p.connected = now - last < PRESENCE_WINDOW_MS;
    p.disconnectedAt = p.connected ? null : last || null;
  }
  return state;
}

async function load(gameId: string): Promise<GameRow | null> {
  const row = await prisma.game.findUnique({ where: { id: gameId } });
  if (!row) return null;
  return {
    state: JSON.parse(row.state) as GameState,
    version: row.version,
    history: JSON.parse(row.history) as string[],
  };
}

/** Save with optimistic concurrency; returns false when someone else won. */
async function save(gameId: string, prevVersion: number, state: GameState, history: string[]): Promise<boolean> {
  const res = await prisma.game.updateMany({
    where: { id: gameId, version: prevVersion },
    data: {
      state: JSON.stringify(state),
      history: JSON.stringify(history),
      version: prevVersion + 1,
      status: state.status,
    },
  });
  return res.count === 1;
}

export const gameService = {
  /** Build a fresh game from a ready lobby room and persist it. */
  async createGame(room: Room): Promise<GameState> {
    const deckIds = room.players.map((p) => p.deckId).filter((id): id is string => Boolean(id));
    const decks = await prisma.deck.findMany({ where: { id: { in: deckIds } } });
    const deckById = new Map(decks.map((d) => [d.id, d]));

    const seats: SeatInput[] = room.players.map((p) => {
      const deck = p.deckId ? deckById.get(p.deckId) : undefined;
      return { userId: p.id, username: p.username, cards: deck ? parseCards(deck.cards) : [] };
    });

    const state = buildInitialGameState(
      nanoid(10),
      room.id,
      seats,
      room.settings.startingLife,
      room.settings.allowSpectators
    );
    const now = Date.now();
    for (const p of state.players) p.lastSeenAt = now;

    await prisma.game.create({
      data: { id: state.id, roomId: room.id, state: JSON.stringify(state), version: 0 },
    });
    return state;
  },

  /**
   * Per-viewer redacted view. Seated viewers also get their presence heartbeat
   * refreshed (throttled). Returns null when the game doesn't exist; "forbidden"
   * when the viewer has no seat and spectating is off.
   */
  async view(gameId: string, viewerId: string): Promise<GameStateView | null | "forbidden"> {
    const row = await load(gameId);
    if (!row) return null;
    const seat = row.state.players.find((p) => p.id === viewerId);
    if (!seat && !row.state.allowSpectators) return "forbidden";

    if (seat && Date.now() - (seat.lastSeenAt ?? 0) > PRESENCE_WRITE_MS) {
      seat.lastSeenAt = Date.now();
      // Heartbeat write; harmless if it loses an optimistic race.
      await save(gameId, row.version, row.state, row.history);
      row.version += 1;
    }
    const view = redactState(derivePresence(row.state), viewerId);
    view.version = row.version; // expose the ROW version for cheap change polling
    return view;
  },

  /** Current row version, for `?since=` change detection without a full payload. */
  async version(gameId: string): Promise<number | null> {
    const row = await prisma.game.findUnique({ where: { id: gameId }, select: { version: true } });
    return row?.version ?? null;
  },

  /** Apply an action (with undo snapshot). Returns log lines, or null if missing. */
  async apply(gameId: string, actorId: string, action: GameAction): Promise<string[] | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const row = await load(gameId);
      if (!row) return null;
      if (!row.state.players.some((p) => p.id === actorId)) return null; // spectators can't act

      const history = [...row.history, JSON.stringify(row.state)].slice(-HISTORY_LIMIT);
      const logs = applyAction(row.state, actorId, action);
      for (const message of logs) {
        row.state.log.push({ ts: Date.now(), playerId: actorId, message });
      }
      if (row.state.log.length > 200) row.state.log = row.state.log.slice(-200);

      if (await save(gameId, row.version, row.state, history)) return logs;
      // Optimistic conflict — someone acted simultaneously; reload and retry once.
    }
    throw new Error("The table is busy — try again");
  },

  /** Restore the most recent pre-action snapshot. */
  async undo(gameId: string): Promise<boolean> {
    const row = await load(gameId);
    if (!row || row.history.length === 0) return false;
    const history = [...row.history];
    const restored = JSON.parse(history.pop()!) as GameState;
    restored.log.push({ ts: Date.now(), playerId: "system", message: "An action was undone." });
    return save(gameId, row.version, restored, history);
  },

  /** Privately read the top `count` cards of a seated player's own library. */
  async peekLibrary(gameId: string, playerId: string, count: number) {
    const row = await load(gameId);
    const player = row?.state.players.find((p) => p.id === playerId);
    if (!player) return null;
    return player.zones.library.slice(0, Math.max(0, count));
  },

  async endGame(gameId: string, enderId: string, winnerId: string | null): Promise<GameState | null> {
    const row = await load(gameId);
    if (!row) return null;
    if (!row.state.players.some((p) => p.id === enderId)) return null;
    const winner = row.state.players.find((p) => p.id === winnerId) ?? null;

    await prisma.match.create({
      data: {
        gameId,
        playerIds: JSON.stringify(row.state.players.map((p) => p.id)),
        participants: JSON.stringify(row.state.players.map((p) => ({ id: p.id, username: p.username }))),
        winnerId: winner?.id ?? null,
        winnerName: winner?.username ?? null,
        turns: row.state.turn,
      },
    });
    row.state.status = "finished";
    row.state.log.push({
      ts: Date.now(),
      playerId: enderId,
      message: winner ? `Game over — ${winner.username} wins!` : "Game ended.",
    });
    await save(gameId, row.version, row.state, row.history);
    return row.state;
  },
};
