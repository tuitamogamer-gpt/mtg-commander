import type { Deck as PrismaDeck, PreconDeck as PrismaPrecon } from "@prisma/client";
import type { Deck, DeckCardEntry, DeckValidation, PreconDeck } from "@mtgc/shared";
import { getCards } from "./scryfall.js";

const BASIC_LANDS = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
  "Snow-Covered Plains",
  "Snow-Covered Island",
  "Snow-Covered Swamp",
  "Snow-Covered Mountain",
  "Snow-Covered Forest",
]);

const WUBRG = ["W", "U", "B", "R", "G"] as const;

export function parseCards(json: string): DeckCardEntry[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? (arr as DeckCardEntry[]) : [];
  } catch {
    return [];
  }
}

export function parseColors(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

export function toDeckModel(row: PrismaDeck): Deck {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    commander: row.commander,
    cards: parseCards(row.cards),
    source: row.source as Deck["source"],
    sourceId: row.sourceId,
    colorIdentity: parseColors(row.colorIdentity),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPreconModel(row: PrismaPrecon): PreconDeck {
  return {
    id: row.id,
    name: row.name,
    setCode: row.setCode,
    commanders: row.commanders,
    colorIdentity: parseColors(row.colorIdentity),
    cards: parseCards(row.cards),
    releaseDate: row.releaseDate ? row.releaseDate.toISOString() : null,
  };
}

/** Total card count, counting quantities. */
export function totalCards(cards: DeckCardEntry[]): number {
  return cards.reduce((sum, c) => sum + c.quantity, 0);
}

/**
 * Compute a deck's color identity from its commander(s) when possible, else from
 * the union of all cards. Requires card data, which is fetched (and cached).
 */
export async function computeColorIdentity(cards: DeckCardEntry[]): Promise<string[]> {
  const commanderIds = cards.filter((c) => c.isCommander).map((c) => c.scryfallId);
  const sourceIds = commanderIds.length > 0 ? commanderIds : cards.map((c) => c.scryfallId);
  const { cards: resolved } = await getCards(sourceIds);
  const identity = new Set<string>();
  for (const card of resolved) {
    for (const color of card.colorIdentity ?? []) identity.add(color);
  }
  return WUBRG.filter((c) => identity.has(c));
}

/**
 * Advisory Commander-legality check. The game itself is honor-system, so this is
 * never enforced — it surfaces warnings/errors in the deck UI.
 */
/** Cards that may appear in any quantity (singleton exemption beyond basics). */
const ANY_NUMBER_RE = /a deck can have any number of cards named/i;

export async function validateCommanderDeck(cards: DeckCardEntry[]): Promise<DeckValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const count = totalCards(cards);

  const commanders = cards.filter((c) => c.isCommander);
  if (commanders.length === 0) {
    errors.push("No commander designated.");
  } else if (commanders.length > 2) {
    warnings.push("More than two commanders designated.");
  }

  if (count !== 100) {
    errors.push(`Deck has ${count} cards; a Commander deck must have exactly 100.`);
  }

  // Fetch all card data once for singleton-exception, color-identity and
  // commander-legality checks.
  const { cards: resolved } = await getCards(cards.map((c) => c.scryfallId));
  const byId = new Map(resolved.map((c) => [c.scryfallId, c]));

  // Singleton rule — basic lands and "any number" cards are exempt.
  for (const c of cards) {
    if (c.isCommander || c.quantity <= 1) continue;
    if (BASIC_LANDS.has(c.name)) continue;
    if (ANY_NUMBER_RE.test(byId.get(c.scryfallId)?.oracleText ?? "")) continue;
    warnings.push(`${c.name} appears ${c.quantity} times (singleton rule).`);
  }

  // Commander color identity — every card must be within it.
  const commanderIdentity = new Set<string>();
  for (const c of commanders) {
    for (const col of byId.get(c.scryfallId)?.colorIdentity ?? []) commanderIdentity.add(col);
  }
  if (commanders.length > 0) {
    for (const c of cards) {
      if (c.isCommander) continue;
      const id = byId.get(c.scryfallId)?.colorIdentity ?? [];
      const outside = id.filter((col) => !commanderIdentity.has(col));
      if (outside.length > 0) {
        errors.push(`${c.name} is outside the commander's color identity (${outside.join("")}).`);
      }
    }
  }

  // Commander legality (must be a legendary creature or "can be your commander").
  for (const c of commanders) {
    const cmd = byId.get(c.scryfallId);
    if (!cmd) continue;
    const type = cmd.typeLine ?? "";
    const isLegendaryCreature = /Legendary/.test(type) && /Creature/.test(type);
    const canBeCommander = /can be your commander/i.test(cmd.oracleText ?? "");
    if (!isLegendaryCreature && !canBeCommander) {
      warnings.push(`${cmd.name} may not be a legal commander.`);
    }
  }

  return { valid: errors.length === 0, cardCount: count, errors, warnings };
}
