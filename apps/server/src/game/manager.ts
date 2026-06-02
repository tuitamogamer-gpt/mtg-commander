import { nanoid } from "nanoid";
import type { GameState, GameStateView } from "@mtgc/shared";
import type { Room } from "@mtgc/shared";
import { prisma } from "../db.js";
import { parseCards } from "../services/deck.js";
import { buildInitialGameState, redactState, type SeatInput } from "./state.js";
import { applyAction } from "./actions.js";
import type { GameAction } from "@mtgc/shared";

/**
 * Authoritative in-memory store of live games. State is held in a Map and
 * snapshotted to the Game table so a crash/restart (or a reconnecting player)
 * can recover. Rules are honor-system: see game/actions.ts (Faza 9) for how
 * client actions mutate state — the server applies and rebroadcasts, it does not
 * referee.
 */
class GameManager {
  private games = new Map<string, GameState>();

  /** Build a fresh game from a ready lobby room and persist a snapshot. */
  async createGame(room: Room): Promise<GameState> {
    const deckIds = room.players.map((p) => p.deckId).filter((id): id is string => Boolean(id));
    const decks = await prisma.deck.findMany({ where: { id: { in: deckIds } } });
    const deckById = new Map(decks.map((d) => [d.id, d]));

    const seats: SeatInput[] = room.players.map((p) => {
      const deck = p.deckId ? deckById.get(p.deckId) : undefined;
      return {
        userId: p.id,
        username: p.username,
        cards: deck ? parseCards(deck.cards) : [],
      };
    });

    const gameId = nanoid(10);
    const state = buildInitialGameState(
      gameId,
      room.id,
      seats,
      room.settings.startingLife,
      room.settings.allowSpectators
    );
    this.games.set(gameId, state);
    await this.persist(state);
    return state;
  }

  get(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  /** Load a game into memory from its DB snapshot (used after a restart). */
  async load(gameId: string): Promise<GameState | undefined> {
    const inMemory = this.games.get(gameId);
    if (inMemory) return inMemory;
    const row = await prisma.game.findUnique({ where: { id: gameId } });
    if (!row) return undefined;
    const state = JSON.parse(row.state) as GameState;
    this.games.set(gameId, state);
    return state;
  }

  view(gameId: string, viewerId: string): GameStateView | undefined {
    const state = this.games.get(gameId);
    return state ? redactState(state, viewerId) : undefined;
  }

  /** Privately read the top `count` cards of a player's own library (scry / look /
   * tutor). Returns null if the game/player isn't found. Does not mutate. */
  peekLibrary(gameId: string, playerId: string, count: number) {
    const state = this.games.get(gameId);
    const player = state?.players.find((p) => p.id === playerId);
    if (!player) return null;
    return player.zones.library.slice(0, Math.max(0, count));
  }

  /** Apply an action and schedule a snapshot. Returns log lines, or null if the
   * game doesn't exist. */
  apply(gameId: string, actorId: string, action: GameAction): string[] | null {
    const state = this.games.get(gameId);
    if (!state) return null;
    const logs = applyAction(state, actorId, action);
    for (const message of logs) {
      state.log.push({ ts: Date.now(), playerId: actorId, message });
    }
    // Keep the in-state log bounded.
    if (state.log.length > 200) state.log = state.log.slice(-200);
    this.scheduleSnapshot(state);
    return logs;
  }

  // After this long without reconnecting, a dropped player is auto-skipped so the
  // table can keep playing.
  static readonly RECONNECT_GRACE_MS = 5 * 60 * 1000;
  private skipTimers = new Map<string, NodeJS.Timeout>();

  setConnected(gameId: string, playerId: string, connected: boolean): GameState | undefined {
    const state = this.games.get(gameId);
    if (!state) return undefined;
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return state;

    player.connected = connected;
    const timerKey = `${gameId}:${playerId}`;

    if (connected) {
      player.disconnectedAt = null;
      // Returning cancels any pending auto-skip but does NOT auto-unskip — the
      // table may have chosen to skip them deliberately.
      const t = this.skipTimers.get(timerKey);
      if (t) {
        clearTimeout(t);
        this.skipTimers.delete(timerKey);
      }
    } else if (player.disconnectedAt === null) {
      player.disconnectedAt = Date.now();
      const timer = setTimeout(() => {
        this.skipTimers.delete(timerKey);
        const s = this.games.get(gameId);
        const p = s?.players.find((x) => x.id === playerId);
        if (p && !p.connected && !p.skipped) {
          p.skipped = true;
          s!.log.push({
            ts: Date.now(),
            playerId: "system",
            message: `${p.username} did not reconnect in time and is now skipped.`,
          });
          this.onAutoSkip?.(gameId);
        }
      }, GameManager.RECONNECT_GRACE_MS);
      this.skipTimers.set(timerKey, timer);
    }
    return state;
  }

  /** Hook the game namespace sets so it can rebroadcast after an auto-skip. */
  onAutoSkip?: (gameId: string) => void;

  // Debounced persistence so a flurry of actions writes at most ~once/sec.
  private snapshotTimers = new Map<string, NodeJS.Timeout>();
  private scheduleSnapshot(state: GameState): void {
    if (this.snapshotTimers.has(state.id)) return;
    const timer = setTimeout(() => {
      this.snapshotTimers.delete(state.id);
      void this.persist(state);
    }, 1000);
    this.snapshotTimers.set(state.id, timer);
  }

  async persist(state: GameState): Promise<void> {
    const data = { state: JSON.stringify(state), status: state.status };
    await prisma.game.upsert({
      where: { id: state.id },
      create: { id: state.id, roomId: state.roomId, ...data },
      update: data,
    });
  }
}

export const gameManager = new GameManager();
