import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Card, Deck, DeckCardEntry } from "@mtgc/shared";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ColorPips } from "@/components/ColorPips";
import { decksApi } from "@/lib/decks";
import { cardsApi, buildScryfallQuery, type SearchFilters } from "@/lib/cards";
import { useCards, cardImage } from "@/store/cards";
import { useCardHover } from "@/lib/useCardHover";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function ResultTile({ card, onAdd }: { card: Card; onAdd: () => void }) {
  const hover = useCardHover(card.scryfallId);
  const img = cardImage(card);
  return (
    <button
      {...hover}
      onClick={onAdd}
      className="rounded-md border border-border overflow-hidden hover:border-accent transition relative group"
      title={`Add ${card.name}`}
    >
      {img ? (
        <img src={img} alt={card.name} className="w-full aspect-[5/7] object-cover" />
      ) : (
        <div className="aspect-[5/7] flex items-center justify-center p-1 text-center text-[10px] text-muted bg-surface-2">
          {card.name}
        </div>
      )}
      <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/50 text-white font-bold text-lg">
        +
      </span>
    </button>
  );
}

const BASICS = new Set(["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"]);
const WUBRG = ["W", "U", "B", "R", "G"];
const EMPTY_FILTERS: SearchFilters = { text: "", type: "", colors: [], cmcOp: "", cmc: "", oracle: "" };

export function DeckEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ensure = useCards((s) => s.ensure);
  const cardData = useCards((s) => s.cards);

  const [deck, setDeck] = useState<Deck | null>(null);
  const [name, setName] = useState("");
  const [cards, setCards] = useState<DeckCardEntry[]>([]);
  const [banned, setBanned] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<Card[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    void decksApi.get(id).then((d) => {
      setDeck(d);
      setName(d.name);
      setCards(d.cards);
      void ensure(d.cards.map((c) => c.scryfallId));
    });
    void cardsApi.banlist().then((b) => setBanned(new Set(b.names)));
  }, [id, ensure]);

  async function runSearch() {
    const q = buildScryfallQuery(filters);
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await cardsApi.search(q));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function addCard(card: Card) {
    setSaved(false);
    setCards((prev) => {
      const existing = prev.find((c) => c.scryfallId === card.scryfallId);
      if (existing) {
        return prev.map((c) =>
          c.scryfallId === card.scryfallId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { scryfallId: card.scryfallId, name: card.name, quantity: 1, isCommander: false }];
    });
    void ensure([card.scryfallId]);
  }

  function setQty(scryfallId: string, delta: number) {
    setSaved(false);
    setCards((prev) =>
      prev
        .map((c) => (c.scryfallId === scryfallId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  }

  function toggleCommander(scryfallId: string) {
    setSaved(false);
    setCards((prev) =>
      prev.map((c) => (c.scryfallId === scryfallId ? { ...c, isCommander: !c.isCommander } : c))
    );
  }

  async function save() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await api.put<Deck>(`/api/decks/${id}`, { name, cards });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // --- live validation ----------------------------------------------------
  const validation = useMemo(() => {
    const total = cards.reduce((s, c) => s + c.quantity, 0);
    const commanders = cards.filter((c) => c.isCommander);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (commanders.length === 0) errors.push("No commander designated.");
    if (total !== 100) errors.push(`Deck has ${total} cards; needs exactly 100.`);

    for (const c of cards) {
      if (!c.isCommander && c.quantity > 1 && !BASICS.has(c.name)) {
        warnings.push(`${c.name} ×${c.quantity} (singleton rule).`);
      }
      if (banned.has(c.name)) errors.push(`${c.name} is banned in Commander.`);
    }
    for (const cmd of commanders) {
      const data = cardData[cmd.scryfallId];
      if (data) {
        const legal =
          (/Legendary/.test(data.typeLine ?? "") && /Creature/.test(data.typeLine ?? "")) ||
          /can be your commander/i.test(data.oracleText ?? "");
        if (!legal) warnings.push(`${cmd.name} may not be a legal commander.`);
      }
    }

    // color identity from loaded card data
    const idSet = new Set<string>();
    const src = commanders.length ? commanders : cards;
    for (const c of src) for (const col of cardData[c.scryfallId]?.colorIdentity ?? []) idSet.add(col);
    const colorIdentity = WUBRG.filter((c) => idSet.has(c));

    return { total, errors, warnings, colorIdentity };
  }, [cards, banned, cardData]);

  if (!deck) return <p className="text-muted py-10">Loading deck…</p>;

  const sortedCards = [...cards].sort(
    (a, b) => Number(b.isCommander) - Number(a.isCommander) || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </Button>
        <Button variant="ghost" onClick={() => navigate("/decks")}>
          Back
        </Button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Search */}
        <UICard>
          <CardHeader>
            <CardTitle>Find cards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={filters.text}
              onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Card name…"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                placeholder="Type (e.g. creature)"
              />
              <Input
                value={filters.oracle}
                onChange={(e) => setFilters((f) => ({ ...f, oracle: e.target.value }))}
                placeholder="Oracle text contains…"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted">Colors:</span>
              {WUBRG.map((c) => (
                <button
                  key={c}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      colors: f.colors.includes(c)
                        ? f.colors.filter((x) => x !== c)
                        : [...f.colors, c],
                    }))
                  }
                  className={cn(
                    "h-6 w-6 rounded-full text-xs font-bold border-2",
                    filters.colors.includes(c) ? "border-accent" : "border-transparent opacity-60",
                    c === "W" && "bg-amber-100 text-black",
                    c === "U" && "bg-sky-400 text-black",
                    c === "B" && "bg-zinc-700 text-white",
                    c === "R" && "bg-red-500 text-white",
                    c === "G" && "bg-green-500 text-black"
                  )}
                >
                  {c}
                </button>
              ))}
              <select
                className="h-8 rounded border border-border bg-surface px-1 text-xs text-white ml-2"
                value={filters.cmcOp}
                onChange={(e) => setFilters((f) => ({ ...f, cmcOp: e.target.value as SearchFilters["cmcOp"] }))}
              >
                <option value="">CMC…</option>
                <option value="=">=</option>
                <option value="<=">≤</option>
                <option value=">=">≥</option>
              </select>
              {filters.cmcOp && (
                <input
                  type="number"
                  min={0}
                  value={filters.cmc}
                  onChange={(e) => setFilters((f) => ({ ...f, cmc: e.target.value }))}
                  className="h-8 w-14 rounded border border-border bg-surface px-1 text-xs text-white"
                />
              )}
              <Button size="sm" onClick={runSearch} disabled={searching}>
                {searching ? "…" : "Search"}
              </Button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[28rem] overflow-y-auto">
              {results.map((card) => (
                <ResultTile key={card.scryfallId} card={card} onAdd={() => addCard(card)} />
              ))}
            </div>
          </CardContent>
        </UICard>

        {/* Deck list + validation */}
        <div className="space-y-4">
          <UICard>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Decklist</span>
                <span className="flex items-center gap-2 text-sm font-normal">
                  <ColorPips identity={validation.colorIdentity} />
                  <span className={validation.total === 100 ? "text-success" : "text-muted"}>
                    {validation.total}/100
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[26rem] overflow-y-auto">
              {sortedCards.length === 0 ? (
                <p className="text-muted text-sm">Empty — search and click cards to add.</p>
              ) : (
                sortedCards.map((c) => (
                  <div
                    key={c.scryfallId}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded px-2 py-1 text-sm",
                      c.isCommander ? "bg-accent/10" : "hover:bg-surface-2"
                    )}
                  >
                    <span className="truncate text-white">
                      {c.isCommander && <span className="text-accent">⌘ </span>}
                      {c.name}
                      {banned.has(c.name) && <span className="ml-1 text-danger text-xs">banned</span>}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="text-muted hover:text-white px-1" onClick={() => setQty(c.scryfallId, -1)}>
                        −
                      </button>
                      <span className="w-5 text-center tabular-nums text-white">{c.quantity}</span>
                      <button className="text-muted hover:text-white px-1" onClick={() => setQty(c.scryfallId, 1)}>
                        +
                      </button>
                      <button
                        className={cn("ml-1 text-xs px-1 rounded", c.isCommander ? "text-accent" : "text-muted hover:text-white")}
                        title="Toggle commander"
                        onClick={() => toggleCommander(c.scryfallId)}
                      >
                        ⌘
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </UICard>

          <UICard>
            <CardHeader>
              <CardTitle>Validation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {validation.errors.length === 0 && validation.warnings.length === 0 ? (
                <p className="text-success">Looks like a legal Commander deck. ✓</p>
              ) : (
                <>
                  {validation.errors.map((e, i) => (
                    <p key={`e${i}`} className="text-danger">• {e}</p>
                  ))}
                  {validation.warnings.map((w, i) => (
                    <p key={`w${i}`} className="text-amber-400">• {w}</p>
                  ))}
                </>
              )}
            </CardContent>
          </UICard>
        </div>
      </div>
    </div>
  );
}
