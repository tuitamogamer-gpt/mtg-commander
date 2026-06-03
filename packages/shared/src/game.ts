// Server-authoritative game state model + action contract.
//
// Rules philosophy: honor system (like Cockatrice / Untap.in). The server stores
// and broadcasts state; it does NOT enforce MTG rules. Players are free to move
// cards between their own zones however they like. The server's job is sync,
// authority over hidden information (other players' hands/libraries), and turn
// bookkeeping.

export type Zone =
  | "library"
  | "hand"
  | "battlefield"
  | "graveyard"
  | "exile"
  | "command";

/** Sub-rows used to lay out the battlefield. Cosmetic grouping only. */
export type BattlefieldRow = "lands" | "creatures" | "other";

export type Phase =
  | "untap"
  | "upkeep"
  | "draw"
  | "main1"
  | "combat_begin"
  | "combat_attackers"
  | "combat_blockers"
  | "combat_damage"
  | "combat_end"
  | "main2"
  | "end"
  | "cleanup";

export const PHASE_ORDER: Phase[] = [
  "untap",
  "upkeep",
  "draw",
  "main1",
  "combat_begin",
  "combat_attackers",
  "combat_blockers",
  "combat_damage",
  "combat_end",
  "main2",
  "end",
  "cleanup",
];

export const PHASE_LABELS: Record<Phase, string> = {
  untap: "Untap",
  upkeep: "Upkeep",
  draw: "Draw",
  main1: "Main 1",
  combat_begin: "Begin Combat",
  combat_attackers: "Declare Attackers",
  combat_blockers: "Declare Blockers",
  combat_damage: "Combat Damage",
  combat_end: "End Combat",
  main2: "Main 2",
  end: "End Step",
  cleanup: "Cleanup",
};

export interface Counter {
  /** e.g. "+1/+1", "-1/-1", "loyalty", "charge", or any custom label. */
  kind: string;
  count: number;
}

/** A physical card instance in a game. `instanceId` is unique per game; the same
 * `scryfallId` may appear on many instances (and copies/tokens). */
export interface GameCard {
  instanceId: string;
  scryfallId: string;
  name: string;
  ownerId: string;
  /** true when face-down (morph, manifest, or hidden on battlefield). */
  faceDown: boolean;
  tapped: boolean;
  /** Degrees of rotation override; null = derive from tapped. */
  flipped: boolean;
  counters: Counter[];
  /** Free-form per-card note shown to all (e.g. "attacking", "blocking P2"). */
  annotation?: string;
  /** Which battlefield row to render in, when on the battlefield. */
  row?: BattlefieldRow;
  /** Token / copy that should be removed when it leaves the battlefield. */
  isToken?: boolean;
  /** Player controlling the card while it is on the stack (caster). */
  controllerId?: string;
  /** Optional description shown for a spell/ability on the stack. */
  stackNote?: string;
  /** True for designated commanders — drives command-zone tax + return rules. */
  isCommander?: boolean;
  /** How many times this commander has been cast from the command zone.
   * Commander tax = max(0, timesCast) * 2 generic on the next cast. */
  timesCast?: number;
}

export interface PlayerZones {
  library: GameCard[];
  hand: GameCard[];
  battlefield: GameCard[];
  graveyard: GameCard[];
  exile: GameCard[];
  command: GameCard[];
}

export interface PlayerState {
  id: string;
  username: string;
  /** Connection state — a disconnected player's seat is held for reconnect. */
  connected: boolean;
  life: number;
  /** commanderDamage[fromPlayerId] = total commander damage taken from them. */
  commanderDamage: Record<string, number>;
  poison: number;
  manaPool: ManaPool;
  isMonarch: boolean;
  hasInitiative: boolean;
  /** Arbitrary named counters tracked at the player level (energy, experience…). */
  counters: Counter[];
  /** How many mulligans this player has taken (London: bottom this many on keep). */
  mulligans: number;
  /** True once the player has kept their opening hand (mulligan phase done). */
  keptHand: boolean;
  /** Epoch ms when this player dropped, or null if connected. Drives the
   * reconnect countdown shown to the table. */
  disconnectedAt: number | null;
  /** When true, turn advancement skips this seat (e.g. abandoned game). */
  skipped: boolean;
  zones: PlayerZones;
}

export interface ManaPool {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
}

/** The shared stack is an ordered list of real cards (last = top). */
export type StackItem = GameCard;

export interface GameState {
  id: string;
  roomId: string;
  status: "active" | "finished";
  turn: number;
  /** index into `players` whose turn it is. */
  activePlayerIndex: number;
  phase: Phase;
  /** player id that currently holds priority. */
  priorityPlayerId: string | null;
  stack: StackItem[];
  players: PlayerState[];
  startingLife: number;
  /** Whether non-seated users may spectate this game. */
  allowSpectators: boolean;
  /** Monotonic version, bumped on every applied action for ordering/debug. */
  version: number;
  log: GameLogEntry[];
}

export interface GameLogEntry {
  ts: number;
  playerId: string;
  message: string;
}

/** Lethal commander damage from a single source. */
export const COMMANDER_DAMAGE_LETHAL = 21;
/** Lethal poison counters. */
export const POISON_LETHAL = 10;
/** Commander tax: +2 generic per previous cast from the command zone. */
export const COMMANDER_TAX_PER_CAST = 2;

/** Whether a player meets a loss condition (life ≤ 0, 21+ commander damage from
 * one source, or 10+ poison). Advisory in the honor-system model. */
export function isEliminated(p: {
  life: number;
  poison: number;
  commanderDamage: Record<string, number>;
}): boolean {
  if (p.life <= 0) return true;
  if (p.poison >= POISON_LETHAL) return true;
  return Object.values(p.commanderDamage).some((d) => d >= COMMANDER_DAMAGE_LETHAL);
}

/**
 * Redacted view of a game sent to a specific player. Hidden zones (other players'
 * hands and everyone's libraries) are replaced by counts via `hiddenCounts`.
 */
export interface GameStateView extends Omit<GameState, "players"> {
  viewerId: string;
  players: PlayerStateView[];
}

export interface PlayerStateView extends Omit<PlayerState, "zones"> {
  zones: {
    library: { count: number };
    /** Full cards if it's the viewer's own hand, else just a count. */
    hand: GameCard[] | { count: number };
    battlefield: GameCard[];
    graveyard: GameCard[];
    exile: GameCard[];
    command: GameCard[];
  };
}

// ---------------------------------------------------------------------------
// Actions — a discriminated union sent from client to server via `game:action`.
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: "move_card"; instanceId: string; to: Zone; toRow?: BattlefieldRow; toIndex?: number; reveal?: boolean }
  | { type: "tap"; instanceId: string; tapped: boolean }
  | { type: "flip"; instanceId: string; faceDown: boolean }
  | { type: "set_life"; playerId: string; life: number }
  | { type: "set_commander_damage"; playerId: string; fromPlayerId: string; amount: number }
  | { type: "set_poison"; playerId: string; amount: number }
  | { type: "add_counter"; instanceId: string; kind: string; delta: number }
  | { type: "set_player_counter"; kind: string; count: number }
  | { type: "set_mana"; color: keyof ManaPool; amount: number }
  | { type: "empty_mana" }
  | { type: "set_monarch"; playerId: string }
  | { type: "set_initiative"; playerId: string }
  | { type: "set_skipped"; playerId: string; skipped: boolean }
  | { type: "annotate"; instanceId: string; annotation: string }
  | { type: "draw"; count: number }
  | { type: "mill"; count: number }
  | { type: "shuffle" }
  | { type: "arrange_library_top"; top: string[]; bottom: string[] } // scry/surveil reorder
  | { type: "reveal_top"; count: number } // reveal top N from library to everyone (log)
  | { type: "mulligan" } // London: shuffle hand back, draw 7, increment mulligan count
  | { type: "keep_hand"; bottom: string[] } // keep opening hand; put these instanceIds on bottom
  | { type: "create_token"; scryfallId: string; name: string; row?: BattlefieldRow }
  | { type: "add_to_stack"; instanceId: string; note?: string } // cast: hand → shared stack
  | { type: "resolve_stack_item"; instanceId: string; to: Zone; toRow?: BattlefieldRow } // resolve/counter
  | { type: "pass_priority" }
  | { type: "next_phase" }
  | { type: "set_phase"; phase: Phase } // jump directly to a phase
  | { type: "next_turn" }
  | { type: "untap_all" }
  | { type: "reveal_card"; instanceId: string }
  | { type: "concede" };

export interface GameActionMessage {
  gameId: string;
  action: GameAction;
}
