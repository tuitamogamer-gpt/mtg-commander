/**
 * Seed the PreconDeck table from MTGJSON.
 *
 * Pulls the master DeckList, keeps every "Commander Deck", downloads each deck
 * file, and upserts it with its commander(s), color identity, and full card list
 * (with Scryfall ids). Idempotent: re-running refreshes existing rows by
 * (setCode, name).
 *
 *   pnpm --filter @mtgc/server seed:precons
 */
import { prisma } from "../src/db.js";
import { getJsonViaCurl } from "../src/services/http.js";
import type { DeckCardEntry } from "@mtgc/shared";

const MTGJSON = "https://mtgjson.com/api/v5";
const HEADERS = { "User-Agent": "MTGCommanderClient/0.1", Accept: "application/json" };
const CONCURRENCY = 6;
const WUBRG = ["W", "U", "B", "R", "G"];

interface DeckListEntry {
  code: string;
  fileName: string;
  name: string;
  releaseDate: string;
  type: string;
}

interface MtgjsonCard {
  count: number;
  name: string;
  colorIdentity?: string[];
  identifiers?: { scryfallId?: string };
}

interface MtgjsonDeck {
  code: string;
  name: string;
  releaseDate?: string;
  commander?: MtgjsonCard[];
  mainBoard?: MtgjsonCard[];
}

function toEntries(cards: MtgjsonCard[] | undefined, isCommander: boolean): DeckCardEntry[] {
  if (!cards) return [];
  const out: DeckCardEntry[] = [];
  for (const c of cards) {
    const scryfallId = c.identifiers?.scryfallId;
    if (!scryfallId) continue;
    out.push({ scryfallId, name: c.name, quantity: c.count ?? 1, isCommander });
  }
  return out;
}

function colorIdentity(deck: MtgjsonDeck): string[] {
  const set = new Set<string>();
  const source = deck.commander?.length ? deck.commander : (deck.mainBoard ?? []);
  for (const c of source) for (const col of c.colorIdentity ?? []) set.add(col);
  return WUBRG.filter((c) => set.has(c));
}

async function seedOne(entry: DeckListEntry): Promise<"ok" | "skip" | "fail"> {
  const file = await getJsonViaCurl<{ data: MtgjsonDeck }>(
    `${MTGJSON}/decks/${entry.fileName}.json`,
    HEADERS
  );
  if (!file?.data) return "fail";
  const deck = file.data;

  const commanders = toEntries(deck.commander, true);
  const main = toEntries(deck.mainBoard, false);
  const cards = [...commanders, ...main];
  if (cards.length === 0) return "skip";

  const commanderNames = commanders.map((c) => c.name).join(", ");
  const release = deck.releaseDate ?? entry.releaseDate;

  await prisma.preconDeck.upsert({
    where: { setCode_name: { setCode: deck.code, name: deck.name } },
    create: {
      name: deck.name,
      setCode: deck.code,
      commanders: commanderNames,
      colorIdentity: JSON.stringify(colorIdentity(deck)),
      cards: JSON.stringify(cards),
      releaseDate: release ? new Date(release) : null,
    },
    update: {
      commanders: commanderNames,
      colorIdentity: JSON.stringify(colorIdentity(deck)),
      cards: JSON.stringify(cards),
      releaseDate: release ? new Date(release) : null,
    },
  });
  return "ok";
}

async function main() {
  console.log("Fetching MTGJSON DeckList…");
  const list = await getJsonViaCurl<{ data: DeckListEntry[] }>(`${MTGJSON}/DeckList.json`, HEADERS);
  if (!list?.data) throw new Error("Failed to fetch DeckList.json");

  const commanderDecks = list.data.filter((d) => d.type === "Commander Deck");
  console.log(`Found ${commanderDecks.length} Commander precons. Seeding…`);

  let ok = 0;
  let skip = 0;
  let fail = 0;
  let index = 0;

  async function worker() {
    while (index < commanderDecks.length) {
      const entry = commanderDecks[index++];
      try {
        const result = await seedOne(entry);
        if (result === "ok") ok++;
        else if (result === "skip") skip++;
        else fail++;
      } catch (err) {
        fail++;
        console.warn(`  ! ${entry.name} (${entry.code}): ${(err as Error).message}`);
      }
      const done = ok + skip + fail;
      if (done % 10 === 0 || done === commanderDecks.length) {
        console.log(`  ${done}/${commanderDecks.length} (ok=${ok} skip=${skip} fail=${fail})`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const total = await prisma.preconDeck.count();
  console.log(`Done. ok=${ok} skip=${skip} fail=${fail}. PreconDeck table now has ${total} rows.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
