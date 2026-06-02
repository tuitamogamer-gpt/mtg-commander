import { describe, expect, it } from "vitest";
import { PRESETS } from "@/components/game/TokenCreator";

describe("token presets", () => {
  it("includes the common Commander tokens with P/T or type", () => {
    const names = PRESETS.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Soldier 1/1 W",
        "Goblin 1/1 R",
        "Spirit 1/1 W Flying",
        "Saproling 1/1 G",
        "Zombie 2/2 B",
        "Beast 3/3 G",
        "Treasure",
        "Clue",
        "Food",
        "Map",
      ])
    );
  });

  it("creature tokens carry a P/T and go to the creatures row", () => {
    const soldier = PRESETS.find((p) => p.name.startsWith("Soldier"))!;
    expect(soldier.row).toBe("creatures");
    expect(soldier.name).toMatch(/\d+\/\d+/);
    const treasure = PRESETS.find((p) => p.name === "Treasure")!;
    expect(treasure.row).toBe("other");
  });
});
