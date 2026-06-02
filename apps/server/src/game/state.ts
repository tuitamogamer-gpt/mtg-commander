import { nanoid } from "nanoid";
import type {
  DeckCardEntry,
  GameCard,
  GameState,
  GameStateView,
  PlayerState,
  PlayerStateView,
  ManaPool,
} from "@mtgc/shared";

const EMPTY_MANA: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

export interface SeatInput {
  userId: string;
  username: string;
  cards: DeckCardEntry[];
}

/** Fisher–Yates shuffle (in place). */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeCard(entry: DeckCardEntry, ownerId: string): GameCard {
  return {
    instanceId: nanoid(10),
    scryfallId: entry.scryfallId,
    name: entry.name,
    ownerId,
    faceDown: false,
    tapped: false,
    flipped: false,
    counters: [],
  };
}

function buildPlayer(seat: SeatInput, startingLife: number): PlayerState {
  const command: GameCard[] = [];
  const library: GameCard[] = [];

  for (const entry of seat.cards) {
    for (let i = 0; i < entry.quantity; i++) {
      const card = makeCard(entry, seat.userId);
      if (entry.isCommander) command.push(card);
      else library.push(card);
    }
  }
  shuffle(library);

  // Deal an opening hand of 7 (London mulligan starts from here).
  const hand = library.splice(0, Math.min(7, library.length));

  return {
    id: seat.userId,
    username: seat.username,
    connected: true,
    life: startingLife,
    commanderDamage: {},
    poison: 0,
    manaPool: { ...EMPTY_MANA },
    isMonarch: false,
    hasInitiative: false,
    counters: [],
    mulligans: 0,
    keptHand: false,
    disconnectedAt: null,
    skipped: false,
    zones: { library, hand, battlefield: [], graveyard: [], exile: [], command },
  };
}

export function buildInitialGameState(
  gameId: string,
  roomId: string,
  seats: SeatInput[],
  startingLife: number
): GameState {
  const players = seats.map((s) => buildPlayer(s, startingLife));
  return {
    id: gameId,
    roomId,
    status: "active",
    turn: 1,
    activePlayerIndex: 0,
    phase: "untap",
    priorityPlayerId: players[0]?.id ?? null,
    stack: [],
    players,
    startingLife,
    version: 0,
    log: [
      { ts: Date.now(), playerId: "system", message: "Game started." },
    ],
  };
}

/**
 * Produce a per-viewer redacted view: every library is hidden (count only), and
 * only the viewer's own hand is visible (others show a count). All other zones
 * are public, matching tabletop visibility.
 */
export function redactState(state: GameState, viewerId: string): GameStateView {
  const players: PlayerStateView[] = state.players.map((p) => {
    const isViewer = p.id === viewerId;
    return {
      id: p.id,
      username: p.username,
      connected: p.connected,
      life: p.life,
      commanderDamage: p.commanderDamage,
      poison: p.poison,
      manaPool: p.manaPool,
      isMonarch: p.isMonarch,
      hasInitiative: p.hasInitiative,
      counters: p.counters,
      mulligans: p.mulligans,
      keptHand: p.keptHand,
      disconnectedAt: p.disconnectedAt,
      skipped: p.skipped,
      zones: {
        library: { count: p.zones.library.length },
        hand: isViewer ? p.zones.hand : { count: p.zones.hand.length },
        battlefield: p.zones.battlefield,
        graveyard: p.zones.graveyard,
        exile: p.zones.exile,
        command: p.zones.command,
      },
    };
  });

  return {
    id: state.id,
    roomId: state.roomId,
    status: state.status,
    turn: state.turn,
    activePlayerIndex: state.activePlayerIndex,
    phase: state.phase,
    priorityPlayerId: state.priorityPlayerId,
    stack: state.stack,
    startingLife: state.startingLife,
    version: state.version,
    log: state.log,
    viewerId,
    players,
  };
}
