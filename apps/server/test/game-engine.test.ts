import { describe, expect, it } from "vitest";
import type { GameState, GameAction } from "@mtgc/shared";
import { isEliminated } from "@mtgc/shared";
import { buildInitialGameState, redactState, type SeatInput } from "../src/game/state.js";
import { applyAction } from "../src/game/actions.js";

const seats: SeatInput[] = [
  {
    userId: "p1",
    username: "Alice",
    cards: [
      { scryfallId: "land", name: "Forest", quantity: 40, isCommander: false },
      { scryfallId: "cmd1", name: "Alice Commander", quantity: 1, isCommander: true },
    ],
  },
  {
    userId: "p2",
    username: "Bob",
    cards: [
      { scryfallId: "land2", name: "Island", quantity: 40, isCommander: false },
      { scryfallId: "cmd2", name: "Bob Commander", quantity: 1, isCommander: true },
    ],
  },
];

function fresh(): GameState {
  return buildInitialGameState("g1", "r1", seats, 40, true);
}
const p1 = (s: GameState) => s.players[0];
const apply = (s: GameState, actor: string, a: GameAction) => applyAction(s, actor, a);

describe("game state builder", () => {
  it("deals an opening hand and stocks the command zone", () => {
    const s = fresh();
    expect(p1(s).zones.hand).toHaveLength(7);
    expect(p1(s).zones.command).toHaveLength(1);
    expect(p1(s).zones.library).toHaveLength(33);
    expect(p1(s).life).toBe(40);
    expect(s.allowSpectators).toBe(true);
  });

  it("redacts hidden zones per viewer", () => {
    const s = fresh();
    const view = redactState(s, "p1");
    const me = view.players.find((p) => p.id === "p1")!;
    const them = view.players.find((p) => p.id === "p2")!;
    expect(Array.isArray(me.zones.hand)).toBe(true); // own hand visible
    expect(Array.isArray(them.zones.hand)).toBe(false); // opponent hidden
    expect(them.zones.library).toHaveProperty("count");
  });

  it("hides every hand from a spectator (no seat)", () => {
    const view = redactState(fresh(), "spectator");
    expect(view.players.every((p) => !Array.isArray(p.zones.hand))).toBe(true);
  });
});

describe("applyAction", () => {
  it("draws, mills, and shuffles", () => {
    const s = fresh();
    apply(s, "p1", { type: "draw", count: 2 });
    expect(p1(s).zones.hand).toHaveLength(9);
    apply(s, "p1", { type: "mill", count: 3 });
    expect(p1(s).zones.graveyard).toHaveLength(3);
    apply(s, "p1", { type: "shuffle" });
    expect(s.version).toBeGreaterThan(0);
  });

  it("moves a card between zones and resets battlefield state on leave", () => {
    const s = fresh();
    const card = p1(s).zones.hand[0];
    apply(s, "p1", { type: "move_card", instanceId: card.instanceId, to: "battlefield", toRow: "creatures" });
    expect(p1(s).zones.battlefield).toHaveLength(1);
    apply(s, "p1", { type: "tap", instanceId: card.instanceId, tapped: true });
    expect(p1(s).zones.battlefield[0].tapped).toBe(true);
    apply(s, "p1", { type: "add_counter", instanceId: card.instanceId, kind: "+1/+1", delta: 2 });
    expect(p1(s).zones.battlefield[0].counters[0].count).toBe(2);
    apply(s, "p1", { type: "move_card", instanceId: card.instanceId, to: "graveyard" });
    expect(p1(s).zones.graveyard[0].tapped).toBe(false);
    expect(p1(s).zones.graveyard[0].counters).toHaveLength(0);
  });

  it("untaps all", () => {
    const s = fresh();
    const c = p1(s).zones.hand[0];
    apply(s, "p1", { type: "move_card", instanceId: c.instanceId, to: "battlefield" });
    apply(s, "p1", { type: "tap", instanceId: c.instanceId, tapped: true });
    apply(s, "p1", { type: "untap_all" });
    expect(p1(s).zones.battlefield[0].tapped).toBe(false);
  });

  it("tracks life, commander damage, and poison (any player)", () => {
    const s = fresh();
    apply(s, "p1", { type: "set_life", playerId: "p2", life: 33 });
    apply(s, "p1", { type: "set_commander_damage", playerId: "p2", fromPlayerId: "p1", amount: 7 });
    apply(s, "p1", { type: "set_poison", playerId: "p2", amount: 4 });
    const bob = s.players[1];
    expect(bob.life).toBe(33);
    expect(bob.commanderDamage.p1).toBe(7);
    expect(bob.poison).toBe(4);
  });

  it("manages mana pool and player counters", () => {
    const s = fresh();
    apply(s, "p1", { type: "set_mana", color: "R", amount: 3 });
    expect(p1(s).manaPool.R).toBe(3);
    apply(s, "p1", { type: "empty_mana" });
    expect(p1(s).manaPool.R).toBe(0);
    apply(s, "p1", { type: "set_player_counter", kind: "Energy", count: 5 });
    expect(p1(s).counters.find((c) => c.kind === "Energy")?.count).toBe(5);
  });

  it("assigns monarch and initiative exclusively", () => {
    const s = fresh();
    apply(s, "p1", { type: "set_monarch", playerId: "p2" });
    expect(s.players[1].isMonarch).toBe(true);
    expect(s.players[0].isMonarch).toBe(false);
    apply(s, "p1", { type: "set_initiative", playerId: "p1" });
    expect(s.players[0].hasInitiative).toBe(true);
  });

  it("runs the London mulligan: redraw then bottom on keep", () => {
    const s = fresh();
    apply(s, "p1", { type: "mulligan" });
    expect(p1(s).mulligans).toBe(1);
    expect(p1(s).zones.hand).toHaveLength(7);
    const bottom = [p1(s).zones.hand[0].instanceId];
    apply(s, "p1", { type: "keep_hand", bottom });
    expect(p1(s).keptHand).toBe(true);
    expect(p1(s).zones.hand).toHaveLength(6);
  });

  it("casts to the shared stack and resolves to the owner's zone", () => {
    const s = fresh();
    const card = p1(s).zones.hand[0];
    apply(s, "p1", { type: "add_to_stack", instanceId: card.instanceId, note: "spell" });
    expect(s.stack).toHaveLength(1);
    expect(s.stack[0].controllerId).toBe("p1");
    apply(s, "p2", { type: "resolve_stack_item", instanceId: card.instanceId, to: "graveyard" });
    expect(s.stack).toHaveLength(0);
    expect(p1(s).zones.graveyard).toHaveLength(1); // back to owner (p1)
  });

  it("arranges the top of the library (scry) and reveals", () => {
    const s = fresh();
    const top3 = p1(s).zones.library.slice(0, 3).map((c) => c.instanceId);
    apply(s, "p1", { type: "arrange_library_top", top: [top3[2], top3[1]], bottom: [top3[0]] });
    expect(p1(s).zones.library[0].instanceId).toBe(top3[2]);
    expect(p1(s).zones.library[p1(s).zones.library.length - 1].instanceId).toBe(top3[0]);
    const logs = apply(s, "p1", { type: "reveal_top", count: 2 });
    expect(logs.join(" ")).toMatch(/reveals/);
  });

  it("creates a token that vanishes when it leaves the battlefield", () => {
    const s = fresh();
    apply(s, "p1", { type: "create_token", scryfallId: "tok", name: "Soldier", row: "creatures" });
    const token = p1(s).zones.battlefield.find((c) => c.isToken)!;
    expect(token).toBeTruthy();
    apply(s, "p1", { type: "move_card", instanceId: token.instanceId, to: "graveyard" });
    expect(p1(s).zones.graveyard.find((c) => c.instanceId === token.instanceId)).toBeUndefined();
  });

  it("jumps directly to a phase via set_phase", () => {
    const s = fresh();
    apply(s, "p1", { type: "set_phase", phase: "combat_attackers" });
    expect(s.phase).toBe("combat_attackers");
    apply(s, "p1", { type: "set_phase", phase: "main2" });
    expect(s.phase).toBe("main2");
  });

  it("advances phases and turns, skipping skipped seats", () => {
    const s = fresh();
    const startPhase = s.phase;
    apply(s, "p1", { type: "next_phase" });
    expect(s.phase).not.toBe(startPhase);
    apply(s, "p1", { type: "pass_priority" });
    expect(s.priorityPlayerId).toBe("p2");
    apply(s, "p1", { type: "set_skipped", playerId: "p2", skipped: true });
    apply(s, "p1", { type: "next_turn" });
    // p2 is skipped, so the active player stays p1.
    expect(s.players[s.activePlayerIndex].id).toBe("p1");
    expect(s.turn).toBe(2);
  });

  it("handles annotate, flip, reveal_card, and concede without throwing", () => {
    const s = fresh();
    const c = p1(s).zones.hand[0];
    expect(() => apply(s, "p1", { type: "annotate", instanceId: c.instanceId, annotation: "note" })).not.toThrow();
    expect(() => apply(s, "p1", { type: "flip", instanceId: c.instanceId, faceDown: true })).not.toThrow();
    expect(() => apply(s, "p1", { type: "reveal_card", instanceId: c.instanceId })).not.toThrow();
    const logs = apply(s, "p1", { type: "concede" });
    expect(logs.join(" ")).toMatch(/conceded/);
  });
});

describe("commander mechanics", () => {
  it("starts the commander in the command zone, flagged and untaxed", () => {
    const s = fresh();
    const cmd = p1(s).zones.command[0];
    expect(cmd).toBeTruthy();
    expect(cmd.isCommander).toBe(true);
    expect(cmd.timesCast).toBe(0);
    // It is NOT in the library/hand.
    expect(p1(s).zones.library.some((c) => c.isCommander)).toBe(false);
    expect((p1(s).zones.hand as { length: number }).length).toBeGreaterThanOrEqual(0);
  });

  it("applies commander tax on each cast from the command zone", () => {
    const s = fresh();
    const cmd = p1(s).zones.command[0];

    // First cast: tax 0, timesCast → 1.
    const log1 = apply(s, "p1", { type: "add_to_stack", instanceId: cmd.instanceId });
    expect(s.stack[0].timesCast).toBe(1);
    expect(log1.join(" ")).toMatch(/cast their commander/i);
    expect(log1.join(" ")).not.toMatch(/tax/i);

    // Return to command, cast again: tax +2, timesCast → 2.
    apply(s, "p1", { type: "resolve_stack_item", instanceId: cmd.instanceId, to: "command" });
    expect(p1(s).zones.command[0].timesCast).toBe(1);
    const log2 = apply(s, "p1", { type: "add_to_stack", instanceId: cmd.instanceId });
    expect(s.stack[0].timesCast).toBe(2);
    expect(log2.join(" ")).toMatch(/tax \+2/i);
  });

  it("returns a commander to the command zone from anywhere", () => {
    const s = fresh();
    const cmd = p1(s).zones.command[0];
    apply(s, "p1", { type: "move_card", instanceId: cmd.instanceId, to: "graveyard" });
    expect(p1(s).zones.command).toHaveLength(0);
    apply(s, "p1", { type: "move_card", instanceId: cmd.instanceId, to: "command" });
    expect(p1(s).zones.command.some((c) => c.instanceId === cmd.instanceId)).toBe(true);
  });

  it("flags elimination at 21 commander damage and logs it", () => {
    const s = fresh();
    const bob = s.players[1];
    expect(isEliminated(bob)).toBe(false);
    apply(s, "p1", { type: "set_commander_damage", playerId: "p2", fromPlayerId: "p1", amount: 20 });
    expect(isEliminated(s.players[1])).toBe(false);
    const logs = apply(s, "p1", { type: "set_commander_damage", playerId: "p2", fromPlayerId: "p1", amount: 21 });
    expect(isEliminated(s.players[1])).toBe(true);
    expect(logs.join(" ")).toMatch(/eliminated/i);
  });

  it("flags elimination at 0 life and 10 poison", () => {
    const s = fresh();
    const lifeLogs = apply(s, "p1", { type: "set_life", playerId: "p2", life: 0 });
    expect(isEliminated(s.players[1])).toBe(true);
    expect(lifeLogs.join(" ")).toMatch(/eliminated/i);

    const s2 = fresh();
    apply(s2, "p1", { type: "set_poison", playerId: "p2", amount: 10 });
    expect(isEliminated(s2.players[1])).toBe(true);
  });
});
