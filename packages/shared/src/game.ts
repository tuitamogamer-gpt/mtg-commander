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

export interface StackItem {
  instanceId: string;
  controllerId: string;
  description: string;
}

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
  /** Monotonic version, bumped on every applied action for ordering/debug. */
  version: number;
  log: GameLogEntry[];
}

export interface GameLogEntry {
  ts: number;
  playerId: string;
  message: string;
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
  | { type: "scry"; count: number } // reveals top N to self via a follow-up reveal
  | { type: "mulligan" } // London: shuffle hand back, draw 7, increment mulligan count
  | { type: "keep_hand"; bottom: string[] } // keep opening hand; put these instanceIds on bottom
  | { type: "create_token"; scryfallId: string; name: string; row?: BattlefieldRow }
  | { type: "push_stack"; instanceId: string; description: string }
  | { type: "resolve_stack" }
  | { type: "pass_priority" }
  | { type: "next_phase" }
  | { type: "next_turn" }
  | { type: "untap_all" }
  | { type: "reveal_card"; instanceId: string }
  | { type: "concede" };

export interface GameActionMessage {
  gameId: string;
  action: GameAction;
}
