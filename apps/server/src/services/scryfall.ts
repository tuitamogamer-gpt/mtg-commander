import type { Card as PrismaCard, Prisma } from "@prisma/client";
import type { Card } from "@mtgc/shared";
import { prisma } from "../db.js";
import { config } from "../config.js";

// Scryfall asks API consumers to send a descriptive User-Agent and Accept header,
// and to keep request rate modest (~10/s). See https://scryfall.com/docs/api.
const SCRYFALL_BASE = "https://api.scryfall.com";
const HEADERS = {
  "User-Agent": "MTGCommanderClient/0.1 (self-hosted hobby project)",
  Accept: "application/json",
};

/** Minimal shape of a Scryfall card object (only fields we persist). */
interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  layout?: string;
  set?: string;
  collector_number?: string;
  rarity?: string;
  image_uris?: Record<string, string>;
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    power?: string;
    toughness?: string;
    loyalty?: string;
    image_uris?: Record<string, string>;
  }>;
  scryfall_uri?: string;
}

function jsonOrNull(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function parse<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/** Map a Scryfall object into the Prisma upsert payload. */
function toDbData(sf: ScryfallCard): Prisma.CardUncheckedCreateInput {
  return {
    scryfallId: sf.id,
    oracleId: sf.oracle_id ?? null,
    name: sf.name,
    manaCost: sf.mana_cost ?? null,
    cmc: sf.cmc ?? null,
    typeLine: sf.type_line ?? null,
    oracleText: sf.oracle_text ?? null,
    colors: jsonOrNull(sf.colors),
    colorIdentity: jsonOrNull(sf.color_identity),
    power: sf.power ?? null,
    toughness: sf.toughness ?? null,
    loyalty: sf.loyalty ?? null,
    layout: sf.layout ?? null,
    setCode: sf.set ?? null,
    collectorNumber: sf.collector_number ?? null,
    rarity: sf.rarity ?? null,
    imageUris: jsonOrNull(sf.image_uris),
    cardFaces: jsonOrNull(
      sf.card_faces?.map((f) => ({
        name: f.name,
        manaCost: f.mana_cost,
        typeLine: f.type_line,
        oracleText: f.oracle_text,
        power: f.power,
        toughness: f.toughness,
        loyalty: f.loyalty,
        imageUris: f.image_uris,
      }))
    ),
    scryfallUri: sf.scryfall_uri ?? null,
    fetchedAt: new Date(),
  };
}

/** Map a cached DB row into the shared Card model returned to clients. */
export function toCardModel(row: PrismaCard): Card {
  return {
    scryfallId: row.scryfallId,
    oracleId: row.oracleId ?? undefined,
    name: row.name,
    manaCost: row.manaCost ?? undefined,
    cmc: row.cmc ?? undefined,
    typeLine: row.typeLine ?? undefined,
    oracleText: row.oracleText ?? undefined,
    colors: parse<string[]>(row.colors),
    colorIdentity: parse<string[]>(row.colorIdentity),
    power: row.power ?? undefined,
    toughness: row.toughness ?? undefined,
    loyalty: row.loyalty ?? undefined,
    layout: row.layout ?? undefined,
    setCode: row.setCode ?? undefined,
    collectorNumber: row.collectorNumber ?? undefined,
    rarity: row.rarity ?? undefined,
    imageUris: parse(row.imageUris),
    cardFaces: parse(row.cardFaces),
    scryfallUri: row.scryfallUri ?? undefined,
  };
}

function isFresh(row: PrismaCard): boolean {
  return Date.now() - row.fetchedAt.getTime() < config.cardCacheTtlMs;
}

async function upsert(sf: ScryfallCard): Promise<PrismaCard> {
  const data = toDbData(sf);
  return prisma.card.upsert({
    where: { scryfallId: sf.id },
    create: data,
    update: data,
  });
}

/**
 * Get a single card by Scryfall id. Returns the cached copy when fresh, else
 * fetches from Scryfall and refreshes the cache. Returns null when not found.
 */
export async function getCard(scryfallId: string): Promise<Card | null> {
  const cached = await prisma.card.findUnique({ where: { scryfallId } });
  if (cached && isFresh(cached)) return toCardModel(cached);

  const res = await fetch(`${SCRYFALL_BASE}/cards/${encodeURIComponent(scryfallId)}`, {
    headers: HEADERS,
  });
  if (res.status === 404) return cached ? toCardModel(cached) : null;
  if (!res.ok) {
    // On upstream failure, serve a stale cache copy if we have one.
    if (cached) return toCardModel(cached);
    throw new Error(`Scryfall error ${res.status}`);
  }
  const sf = (await res.json()) as ScryfallCard;
  return toCardModel(await upsert(sf));
}

/**
 * Resolve many cards by id. Uses fresh cache entries directly and batches the
 * remainder through Scryfall's /cards/collection endpoint (max 75 per call).
 */
export async function getCards(ids: string[]): Promise<{ cards: Card[]; notFound: string[] }> {
  const unique = [...new Set(ids)];
  const cachedRows = await prisma.card.findMany({ where: { scryfallId: { in: unique } } });
  const cacheById = new Map(cachedRows.map((r) => [r.scryfallId, r]));

  const result = new Map<string, Card>();
  const toFetch: string[] = [];
  for (const id of unique) {
    const row = cacheById.get(id);
    if (row && isFresh(row)) result.set(id, toCardModel(row));
    else toFetch.push(id);
  }

  const notFound: string[] = [];
  for (let i = 0; i < toFetch.length; i += 75) {
    const chunk = toFetch.slice(i, i + 75);
    const res = await fetch(`${SCRYFALL_BASE}/cards/collection`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: chunk.map((id) => ({ id })) }),
    });
    if (!res.ok) {
      // Fall back to any stale cache for this chunk.
      for (const id of chunk) {
        const row = cacheById.get(id);
        if (row) result.set(id, toCardModel(row));
        else notFound.push(id);
      }
      continue;
    }
    const data = (await res.json()) as { data: ScryfallCard[]; not_found?: Array<{ id?: string }> };
    for (const sf of data.data) {
      result.set(sf.id, toCardModel(await upsert(sf)));
    }
    for (const nf of data.not_found ?? []) {
      const id = nf.id;
      if (!id) continue;
      const row = cacheById.get(id);
      if (row) result.set(id, toCardModel(row));
      else notFound.push(id);
    }
  }

  // Preserve the caller's order where possible.
  const cards = unique.map((id) => result.get(id)).filter((c): c is Card => Boolean(c));
  return { cards, notFound };
}

/**
 * Search Scryfall with its query syntax (e.g. `t:creature id<=wu cmc<=3`).
 * Returns the first page (capped) mapped to our Card model, caching each card.
 */
export async function searchCards(query: string, limit = 60): Promise<Card[]> {
  const url = `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name`;
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 404) return []; // Scryfall returns 404 for "no cards found"
  if (!res.ok) throw new Error(`Scryfall search error ${res.status}`);
  const data = (await res.json()) as { data: ScryfallCard[] };
  const page = data.data.slice(0, limit);
  const cards: Card[] = [];
  for (const sf of page) cards.push(toCardModel(await upsert(sf)));
  return cards;
}

let banlistCache: { names: string[]; fetchedAt: number } | null = null;
const BANLIST_TTL = 24 * 60 * 60 * 1000;

/** The Commander banned list (card names), cached for a day. */
export async function getCommanderBanlist(): Promise<string[]> {
  if (banlistCache && Date.now() - banlistCache.fetchedAt < BANLIST_TTL) {
    return banlistCache.names;
  }
  const names: string[] = [];
  let url: string | null = `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent("banned:commander")}&unique=cards`;
  // The banned list fits in one or two pages; follow next_page defensively.
  for (let guard = 0; url && guard < 5; guard++) {
    const res: Response = await fetch(url, { headers: HEADERS });
    if (!res.ok) break;
    const data = (await res.json()) as { data: ScryfallCard[]; has_more?: boolean; next_page?: string };
    for (const c of data.data) names.push(c.name);
    url = data.has_more && data.next_page ? data.next_page : null;
  }
  banlistCache = { names, fetchedAt: Date.now() };
  return names;
}

/** Look up a single card by exact name (used by deck import to resolve names). */
export async function getCardByName(name: string): Promise<Card | null> {
  const res = await fetch(`${SCRYFALL_BASE}/cards/named?exact=${encodeURIComponent(name)}`, {
    headers: HEADERS,
  });
  if (!res.ok) return null;
  const sf = (await res.json()) as ScryfallCard;
  return toCardModel(await upsert(sf));
}
