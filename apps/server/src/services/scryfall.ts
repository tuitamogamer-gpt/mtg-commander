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

/** Look up a single card by exact name (used by deck import to resolve names). */
export async function getCardByName(name: string): Promise<Card | null> {
  const res = await fetch(`${SCRYFALL_BASE}/cards/named?exact=${encodeURIComponent(name)}`, {
    headers: HEADERS,
  });
  if (!res.ok) return null;
  const sf = (await res.json()) as ScryfallCard;
  return toCardModel(await upsert(sf));
}
