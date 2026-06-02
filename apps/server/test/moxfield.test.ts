import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the HTTP layer so no real network/curl call happens. vi.hoisted lets the
// hoisted vi.mock factory safely reference the spy.
const { getJsonViaCurl } = vi.hoisted(() => ({ getJsonViaCurl: vi.fn() }));
vi.mock("../src/services/http.js", () => ({ getJsonViaCurl }));

import { importMoxfieldDeck, parseMoxfieldId } from "../src/services/moxfield.js";

const v3Deck = {
  name: "Test Moxfield Deck",
  publicId: "abc123",
  boards: {
    commanders: { cards: { x: { quantity: 1, card: { scryfall_id: "cmd-id", name: "Commander" } } } },
    mainboard: {
      cards: {
        a: { quantity: 1, card: { scryfall_id: "id-a", name: "Card A" } },
        b: { quantity: 9, card: { scryfall_id: "id-b", name: "Forest" } },
      },
    },
  },
};

describe("moxfield import", () => {
  beforeEach(() => getJsonViaCurl.mockReset());

  it("parses an id from a raw id or a URL", () => {
    expect(parseMoxfieldId("abc123")).toBe("abc123");
    expect(parseMoxfieldId("https://www.moxfield.com/decks/XYZ_789?utm=1")).toBe("XYZ_789");
  });

  it("imports a v3 deck, separating commanders from the mainboard", async () => {
    getJsonViaCurl.mockResolvedValueOnce(v3Deck);
    const result = await importMoxfieldDeck("abc123");
    expect(result.name).toBe("Test Moxfield Deck");
    expect(result.publicId).toBe("abc123");
    const commander = result.cards.find((c) => c.isCommander);
    expect(commander?.name).toBe("Commander");
    expect(result.cards.filter((c) => !c.isCommander)).toHaveLength(2);
    expect(result.cards.find((c) => c.name === "Forest")?.quantity).toBe(9);
  });

  it("throws a friendly error when the deck cannot be fetched", async () => {
    getJsonViaCurl.mockResolvedValue(null); // both v3 and v2 fail
    await expect(importMoxfieldDeck("missing")).rejects.toThrow(/public/i);
  });
});
