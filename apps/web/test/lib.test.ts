import { describe, expect, it } from "vitest";
import { buildScryfallQuery } from "@/lib/cards";
import { colorPips, deckCardCount } from "@/lib/decks";
import { cn } from "@/lib/utils";
import type { Deck } from "@mtgc/shared";

describe("buildScryfallQuery", () => {
  it("returns empty for empty filters", () => {
    expect(buildScryfallQuery({ text: "", type: "", colors: [], cmcOp: "", cmc: "", oracle: "" })).toBe("");
  });
  it("combines name, type, colors, cmc and oracle", () => {
    const q = buildScryfallQuery({
      text: "bolt",
      type: "instant",
      colors: ["R", "U"],
      cmcOp: "<=",
      cmc: "3",
      oracle: "draw a card",
    });
    expect(q).toContain("bolt");
    expect(q).toContain("t:instant");
    expect(q).toContain("id<=ru");
    expect(q).toContain("cmc<=3");
    expect(q).toContain('o:"draw a card"');
  });
});

describe("deck helpers", () => {
  it("colorPips maps identity letters, colorless fallback", () => {
    expect(colorPips(["R"])[0].label).toBe("R");
    expect(colorPips([])[0].label).toBe("C");
  });
  it("deckCardCount sums quantities", () => {
    const deck = { cards: [{ quantity: 2 }, { quantity: 5 }] } as Deck;
    expect(deckCardCount(deck)).toBe(7);
  });
});

describe("cn", () => {
  it("merges and dedupes tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-white", false && "hidden", "font-bold")).toBe("text-white font-bold");
  });
});
