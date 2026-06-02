import { nanoid } from "nanoid";
import type { GameState, GameStateView } from "@mtgc/shared";
import type { Room } from "@mtgc/shared";
import { prisma } from "../db.js";
import { parseCards } from "../services/deck.js";
import { buildInitialGameState, redactState, type SeatInput } from "./state.js";

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
    const state = buildInitialGameState(gameId, room.id, seats, room.settings.startingLife);
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
