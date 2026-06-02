import type { DeckCardEntry } from "@mtgc/shared";
import { getJsonViaCurl } from "./http.js";

// Moxfield's public deck API. v3 is current; we keep a v2 fallback in case v3
// shape changes. No auth is needed for public decks. Moxfield sits behind a CDN
// that can be picky about clients, so we send a browser-like User-Agent.
const V3 = (id: string) => `https://api2.moxfield.com/v3/decks/all/${id}`;
const V2 = (id: string) => `https://api2.moxfield.com/v2/decks/all/${id}`;

// Moxfield's API sits behind Cloudflare, which serves a 403 challenge to clients
// that don't look like the website's own XHR calls. Sending the site Origin /
// Referer and a browser User-Agent gets past it and reaches the JSON API.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.moxfield.com/",
  Origin: "https://www.moxfield.com",
};

export interface MoxfieldImportResult {
  name: string;
  publicId: string;
  cards: DeckCardEntry[];
}

interface MoxfieldCardValue {
  quantity: number;
  card?: {
    scryfall_id?: string;
    scryfallId?: string;
    name?: string;
  };
}

interface MoxfieldBoard {
  count?: number;
  cards?: Record<string, MoxfieldCardValue>;
}

interface MoxfieldV3Deck {
  name?: string;
  publicId?: string;
  boards?: Record<string, MoxfieldBoard>;
}

// v2 has mainboard/commanders as top-level maps of name -> { quantity, card }.
interface MoxfieldV2Deck {
  name?: string;
  publicId?: string;
  mainboard?: Record<string, MoxfieldCardValue>;
  commanders?: Record<string, MoxfieldCardValue>;
  companions?: Record<string, MoxfieldCardValue>;
}

/** Extract the Moxfield public id from a raw id or a full deck URL. */
export function parseMoxfieldId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/moxfield\.com\/decks\/([^/?#]+)/i);
  if (urlMatch) return urlMatch[1];
  return trimmed;
}

function collect(
  board: Record<string, MoxfieldCardValue> | undefined,
  isCommander: boolean,
  out: DeckCardEntry[]
): void {
  if (!board) return;
  for (const value of Object.values(board)) {
    const scryfallId = value.card?.scryfall_id ?? value.card?.scryfallId;
    const name = value.card?.name;
    if (!scryfallId || !name) continue;
    out.push({ scryfallId, name, quantity: value.quantity ?? 1, isCommander });
  }
}

export async function importMoxfieldDeck(idOrUrl: string): Promise<MoxfieldImportResult> {
  const publicId = parseMoxfieldId(idOrUrl);
  if (!publicId) throw new Error("Could not parse a Moxfield deck id.");

  // Try v3 first.
  const v3 = await getJsonViaCurl<MoxfieldV3Deck>(V3(publicId), HEADERS);
  if (v3?.boards) {
    const cards: DeckCardEntry[] = [];
    const boards = v3.boards;
    collect(boards.commanders?.cards, true, cards);
    collect(boards.mainboard?.cards, false, cards);
    // Companions live alongside the deck; include them as commander-zone cards.
    collect(boards.companions?.cards, true, cards);
    if (cards.length > 0) {
      return { name: v3.name ?? "Imported deck", publicId, cards };
    }
  }

  // Fallback to v2.
  const v2 = await getJsonViaCurl<MoxfieldV2Deck>(V2(publicId), HEADERS);
  if (v2?.mainboard) {
    const cards: DeckCardEntry[] = [];
    collect(v2.commanders, true, cards);
    collect(v2.mainboard, false, cards);
    collect(v2.companions, true, cards);
    if (cards.length > 0) {
      return { name: v2.name ?? "Imported deck", publicId, cards };
    }
  }

  throw new Error(
    "Could not import this Moxfield deck. Make sure it is public and the id/URL is correct."
  );
}
