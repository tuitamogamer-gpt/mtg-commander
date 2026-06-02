import type { Deck, DeckCardEntry } from "@mtgc/shared";

export interface ParsedLine {
  quantity: number;
  name: string;
}

/**
 * Parse a pasted decklist. Accepts common formats:
 *   "1 Sol Ring", "1x Sol Ring", "Sol Ring", "// comments", blank lines.
 * Section headers like "Commander:" / "Deck" are ignored.
 */
export function parseDecklist(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;
    if (/^(commander|deck|sideboard|maybeboard|companion)s?\s*:?\s*$/i.test(line)) continue;
    const m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/) ?? line.match(/^(.+)$/);
    if (!m) continue;
    if (m.length === 3) {
      out.push({ quantity: Math.max(1, parseInt(m[1], 10) || 1), name: m[2].trim() });
    } else {
      out.push({ quantity: 1, name: m[1].trim() });
    }
  }
  return out;
}

/** Export a deck as plain text ("1 Card Name"), commanders first. Compatible with
 * Moxfield / Archidekt paste import. */
export function deckToText(deck: { name: string; cards: DeckCardEntry[] } | Deck): string {
  const commanders = deck.cards.filter((c) => c.isCommander);
  const rest = deck.cards.filter((c) => !c.isCommander);
  const fmt = (c: DeckCardEntry) => `${c.quantity} ${c.name}`;
  const lines: string[] = [];
  if (commanders.length) {
    lines.push("Commander:");
    lines.push(...commanders.map(fmt));
    lines.push("");
    lines.push("Deck:");
  }
  lines.push(...rest.map(fmt));
  return lines.join("\n");
}
