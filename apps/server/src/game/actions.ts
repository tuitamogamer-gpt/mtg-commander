import { nanoid } from "nanoid";
import type {
  GameAction,
  GameCard,
  GameState,
  PlayerState,
  Zone,
} from "@mtgc/shared";
import {
  PHASE_ORDER,
  PHASE_LABELS,
  COMMANDER_DAMAGE_LETHAL,
  COMMANDER_TAX_PER_CAST,
  POISON_LETHAL,
} from "@mtgc/shared";
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
        if (prev > 0 && action.life <= 0) {
          logs.push(`${target.username} is at 0 life — eliminated.`);
        }
      }
      break;
    }

    case "set_commander_damage": {
      const target = findPlayer(state, action.playerId);
      if (target) {
        const prev = target.commanderDamage[action.fromPlayerId] ?? 0;
        const amount = Math.max(0, action.amount);
        target.commanderDamage[action.fromPlayerId] = amount;
        const from = findPlayer(state, action.fromPlayerId)?.username ?? "a commander";
        if (prev < COMMANDER_DAMAGE_LETHAL && amount >= COMMANDER_DAMAGE_LETHAL) {
          logs.push(
            `${target.username} has taken ${amount} commander damage from ${from} — eliminated (21+).`
          );
        }
      }
      break;
    }

    case "set_poison": {
      const target = findPlayer(state, action.playerId);
      if (target) {
        const prev = target.poison;
        target.poison = Math.max(0, action.amount);
        if (prev < POISON_LETHAL && target.poison >= POISON_LETHAL) {
          logs.push(`${target.username} has ${target.poison} poison — eliminated.`);
        }
      }
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

    case "set_skipped": {
      const target = findPlayer(state, action.playerId);
      if (target) {
        target.skipped = action.skipped;
        logs.push(
          `${target.username} is ${action.skipped ? "now skipped (turns pass over them)" : "back in the turn order"}.`
        );
      }
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

    case "arrange_library_top": {
      // Scry / surveil reorder. `top` and `bottom` are instanceIds currently in
      // the library; pull them out, then put `top` (in order) on top and
      // `bottom` (in order) on the bottom, leaving the rest where they were.
      const lib = actor.zones.library;
      const ids = new Set([...action.top, ...action.bottom]);
      const pulled = new Map<string, GameCard>();
      for (let i = lib.length - 1; i >= 0; i--) {
        if (ids.has(lib[i].instanceId)) {
          pulled.set(lib[i].instanceId, lib[i]);
          lib.splice(i, 1);
        }
      }
      const topCards = action.top.map((id) => pulled.get(id)).filter((c): c is GameCard => !!c);
      const bottomCards = action.bottom
        .map((id) => pulled.get(id))
        .filter((c): c is GameCard => !!c);
      actor.zones.library = [...topCards, ...lib, ...bottomCards];
      logs.push(
        `${actor.username} arranged the top of their library` +
          (bottomCards.length ? ` (${bottomCards.length} to bottom)` : "") +
          "."
      );
      break;
    }

    case "reveal_top": {
      const n = Math.min(action.count, actor.zones.library.length);
      const names = actor.zones.library.slice(0, n).map((c) => c.name);
      logs.push(`${actor.username} reveals from top: ${names.join(", ") || "(none)"}.`);
      break;
    }

    case "mulligan": {
      // London mulligan: shuffle hand into library, draw a fresh 7. The number of
      // mulligans taken is how many cards must be bottomed when the hand is kept.
      actor.zones.library.push(...actor.zones.hand);
      actor.zones.hand = [];
      shuffle(actor.zones.library);
      const n = Math.min(7, actor.zones.library.length);
      actor.zones.hand.push(...actor.zones.library.splice(0, n));
      actor.mulligans += 1;
      actor.keptHand = false;
      logs.push(`${actor.username} took mulligan #${actor.mulligans}.`);
      break;
    }

    case "keep_hand": {
      // Put the chosen cards on the bottom of the library (London bottoming),
      // then lock in the hand.
      for (const instanceId of action.bottom) {
        const idx = actor.zones.hand.findIndex((c) => c.instanceId === instanceId);
        if (idx >= 0) {
          const [card] = actor.zones.hand.splice(idx, 1);
          card.faceDown = false;
          actor.zones.library.push(card); // bottom
        }
      }
      actor.keptHand = true;
      const n = action.bottom.length;
      logs.push(
        `${actor.username} kept a hand of ${actor.zones.hand.length}` +
          (n > 0 ? ` (bottomed ${n}).` : ".")
      );
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

    case "add_to_stack": {
      // Cast/activate: take the card from the actor's zones onto the shared stack.
      const found = removeCardFromZones(actor, action.instanceId);
      if (!found) break;
      const { card, from } = found;
      card.controllerId = actor.id;
      card.stackNote = action.note;
      card.tapped = false;
      card.row = undefined;
      // Commander tax: casting a commander from the command zone costs +2 generic
      // per previous cast. We track casts and surface the tax in the log.
      if (card.isCommander && from === "command") {
        const prior = card.timesCast ?? 0;
        const tax = prior * COMMANDER_TAX_PER_CAST;
        card.timesCast = prior + 1;
        logs.push(
          `${actor.username} cast their commander ${card.name}` +
            (tax > 0 ? ` (commander tax +${tax} generic, cast #${prior + 1}).` : ".")
        );
      } else {
        logs.push(`${actor.username} put ${cardLabel(card)} on the stack.`);
      }
      state.stack.push(card);
      state.priorityPlayerId = actor.id; // caster gets priority first
      break;
    }

    case "resolve_stack_item": {
      // Remove from the shared stack and place into the card OWNER's zone. Honor
      // system: any player may resolve (to battlefield/graveyard) or counter
      // (to graveyard/exile) — the destination says which.
      const idx = state.stack.findIndex((c) => c.instanceId === action.instanceId);
      if (idx < 0) break;
      const [card] = state.stack.splice(idx, 1);
      card.controllerId = undefined;
      card.stackNote = undefined;
      const owner = findPlayer(state, card.ownerId) ?? actor;
      if (action.to === "battlefield") card.row = action.toRow ?? "other";
      owner.zones[action.to].push(card);
      logs.push(`${cardLabel(card)} resolved to ${owner.username}'s ${action.to}.`);
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

    case "set_phase": {
      state.phase = action.phase;
      state.priorityPlayerId = state.players[state.activePlayerIndex]?.id ?? null;
      logs.push(`Phase: ${PHASE_LABELS[action.phase]}.`);
      break;
    }

    case "next_turn": {
      // Advance to the next non-skipped seat (guard against everyone skipped).
      let next = state.activePlayerIndex;
      for (let i = 0; i < state.players.length; i++) {
        next = (next + 1) % state.players.length;
        if (!state.players[next].skipped) break;
      }
      state.activePlayerIndex = next;
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
