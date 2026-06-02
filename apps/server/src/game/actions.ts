import { nanoid } from "nanoid";
import type {
  GameAction,
  GameCard,
  GameState,
  PlayerState,
  Zone,
} from "@mtgc/shared";
import { PHASE_ORDER, PHASE_LABELS } from "@mtgc/shared";
import { shuffle } from "./state.js";

/**
 * Apply a client action to the authoritative state. Honor-system: we do not
 * enforce MTG rules (no priority gating on most actions, no legality checks).
 * We only guard ownership — you can move your own cards and adjust shared trackers
 * (life, commander damage, monarch). Returns human-readable log lines.
 *
 * Mutates `state` in place and bumps `version`.
 */
export function applyAction(
  state: GameState,
  actorId: string,
  action: GameAction
): string[] {
  const actor = findPlayer(state, actorId);
  if (!actor) return [];
  const logs: string[] = [];

  switch (action.type) {
    case "move_card": {
      const found = removeCardFromZones(actor, action.instanceId);
      if (!found) break;
      const { card, from } = found;
      // Leaving the battlefield resets physical state.
      if (from === "battlefield" && action.to !== "battlefield") {
        card.tapped = false;
        card.flipped = false;
        card.counters = [];
        card.annotation = undefined;
        card.row = undefined;
      }
      if (action.to === "battlefield") card.row = action.toRow ?? card.row ?? "other";
      if (action.to === "hand" || action.to === "library") card.faceDown = false;

      const target = actor.zones[action.to];
      const idx = action.toIndex;
      if (typeof idx === "number" && idx >= 0 && idx <= target.length) target.splice(idx, 0, card);
      else target.push(card);

      // Tokens cease to exist when they leave the battlefield.
      if (card.isToken && action.to !== "battlefield") {
        const arr = actor.zones[action.to];
        const i = arr.indexOf(card);
        if (i >= 0) arr.splice(i, 1);
        logs.push(`${actor.username}'s ${card.name} token ceased to exist.`);
        break;
      }
      logs.push(`${actor.username} moved ${cardLabel(card)} to ${action.to}.`);
      break;
    }

    case "tap": {
      const card = findCardInBattlefield(actor, action.instanceId);
      if (card) card.tapped = action.tapped;
      break;
    }

    case "flip": {
      const card = findCardAnywhere(actor, action.instanceId);
      if (card) card.faceDown = action.faceDown;
      break;
    }

    case "set_life": {
      const target = findPlayer(state, action.playerId);
      if (target) {
        const prev = target.life;
        target.life = action.life;
        logs.push(`${target.username} life ${prev} → ${action.life}.`);
      }
      break;
    }

    case "set_commander_damage": {
      const target = findPlayer(state, action.playerId);
      if (target) target.commanderDamage[action.fromPlayerId] = Math.max(0, action.amount);
      break;
    }

    case "set_poison": {
      const target = findPlayer(state, action.playerId);
      if (target) target.poison = Math.max(0, action.amount);
      break;
    }

    case "add_counter": {
      const card = findCardAnywhere(actor, action.instanceId);
      if (card) adjustCounter(card, action.kind, action.delta);
      break;
    }

    case "set_player_counter": {
      const existing = actor.counters.find((c) => c.kind === action.kind);
      if (existing) existing.count = action.count;
      else actor.counters.push({ kind: action.kind, count: action.count });
      actor.counters = actor.counters.filter((c) => c.count !== 0);
      break;
    }

    case "set_mana": {
      actor.manaPool[action.color] = Math.max(0, action.amount);
      break;
    }

    case "empty_mana": {
      actor.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
      break;
    }

    case "set_monarch": {
      for (const p of state.players) p.isMonarch = p.id === action.playerId;
      logs.push(`${findPlayer(state, action.playerId)?.username ?? "?"} is the monarch.`);
      break;
    }

    case "set_initiative": {
      for (const p of state.players) p.hasInitiative = p.id === action.playerId;
      logs.push(`${findPlayer(state, action.playerId)?.username ?? "?"} has the initiative.`);
      break;
    }

    case "annotate": {
      const card = findCardAnywhere(actor, action.instanceId);
      if (card) card.annotation = action.annotation || undefined;
      break;
    }

    case "draw": {
      const n = Math.min(action.count, actor.zones.library.length);
      const drawn = actor.zones.library.splice(0, n);
      actor.zones.hand.push(...drawn);
      logs.push(`${actor.username} drew ${n} card${n === 1 ? "" : "s"}.`);
      break;
    }

    case "mill": {
      const n = Math.min(action.count, actor.zones.library.length);
      const milled = actor.zones.library.splice(0, n);
      actor.zones.graveyard.push(...milled);
      logs.push(`${actor.username} milled ${n} card${n === 1 ? "" : "s"}.`);
      break;
    }

    case "shuffle": {
      shuffle(actor.zones.library);
      logs.push(`${actor.username} shuffled their library.`);
      break;
    }

    case "scry": {
      // Visual-only: the client reveals the top N to the actor; nothing to mutate.
      break;
    }

    case "mulligan": {
      // London mulligan: shuffle hand into library, draw 7, then the client will
      // bottom (7 - keep) cards via move_card actions.
      actor.zones.library.push(...actor.zones.hand);
      actor.zones.hand = [];
      shuffle(actor.zones.library);
      const n = Math.min(7, actor.zones.library.length);
      actor.zones.hand.push(...actor.zones.library.splice(0, n));
      logs.push(`${actor.username} took a mulligan (keep ${action.keep}).`);
      break;
    }

    case "create_token": {
      const token: GameCard = {
        instanceId: nanoid(10),
        scryfallId: action.scryfallId,
        name: action.name,
        ownerId: actor.id,
        faceDown: false,
        tapped: false,
        flipped: false,
        counters: [],
        row: action.row ?? "creatures",
        isToken: true,
      };
      actor.zones.battlefield.push(token);
      logs.push(`${actor.username} created a ${action.name} token.`);
      break;
    }

    case "push_stack": {
      state.stack.push({
        instanceId: action.instanceId,
        controllerId: actor.id,
        description: action.description,
      });
      logs.push(`${actor.username} put ${action.description} on the stack.`);
      break;
    }

    case "resolve_stack": {
      const item = state.stack.pop();
      if (item) logs.push(`Resolved: ${item.description}.`);
      break;
    }

    case "pass_priority": {
      const idx = state.players.findIndex((p) => p.id === state.priorityPlayerId);
      const next = state.players[(idx + 1) % state.players.length];
      state.priorityPlayerId = next?.id ?? null;
      break;
    }

    case "next_phase": {
      const i = PHASE_ORDER.indexOf(state.phase);
      const next = PHASE_ORDER[(i + 1) % PHASE_ORDER.length];
      state.phase = next;
      state.priorityPlayerId = state.players[state.activePlayerIndex]?.id ?? null;
      logs.push(`Phase: ${PHASE_LABELS[next]}.`);
      break;
    }

    case "next_turn": {
      state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
      state.turn += 1;
      state.phase = "untap";
      const active = state.players[state.activePlayerIndex];
      state.priorityPlayerId = active?.id ?? null;
      // Convenience: untap the new active player's permanents and empty mana.
      if (active) {
        for (const c of active.zones.battlefield) c.tapped = false;
        active.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
      }
      logs.push(`Turn ${state.turn}: ${active?.username ?? "?"}.`);
      break;
    }

    case "untap_all": {
      for (const c of actor.zones.battlefield) c.tapped = false;
      logs.push(`${actor.username} untapped all permanents.`);
      break;
    }

    case "reveal_card": {
      const card = findCardAnywhere(actor, action.instanceId);
      if (card) logs.push(`${actor.username} revealed ${card.name}.`);
      break;
    }

    case "concede": {
      logs.push(`${actor.username} conceded.`);
      break;
    }
  }

  state.version += 1;
  return logs;
}

// --- helpers ---------------------------------------------------------------

function findPlayer(state: GameState, id: string): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

const ALL_ZONES: Zone[] = ["library", "hand", "battlefield", "graveyard", "exile", "command"];

function removeCardFromZones(
  player: PlayerState,
  instanceId: string
): { card: GameCard; from: Zone } | null {
  for (const zone of ALL_ZONES) {
    const arr = player.zones[zone];
    const idx = arr.findIndex((c) => c.instanceId === instanceId);
    if (idx >= 0) {
      const [card] = arr.splice(idx, 1);
      return { card, from: zone };
    }
  }
  return null;
}

function findCardAnywhere(player: PlayerState, instanceId: string): GameCard | undefined {
  for (const zone of ALL_ZONES) {
    const card = player.zones[zone].find((c) => c.instanceId === instanceId);
    if (card) return card;
  }
  return undefined;
}

function findCardInBattlefield(player: PlayerState, instanceId: string): GameCard | undefined {
  return player.zones.battlefield.find((c) => c.instanceId === instanceId);
}

function adjustCounter(card: GameCard, kind: string, delta: number): void {
  const existing = card.counters.find((c) => c.kind === kind);
  if (existing) existing.count += delta;
  else card.counters.push({ kind, count: delta });
  card.counters = card.counters.filter((c) => c.count !== 0);
}

function cardLabel(card: GameCard): string {
  return card.faceDown ? "a face-down card" : card.name;
}
