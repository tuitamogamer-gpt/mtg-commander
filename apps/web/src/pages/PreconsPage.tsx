import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PreconListItem } from "@mtgc/shared";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";
import { ColorPips } from "@/components/ColorPips";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { preconsApi } from "@/lib/precons";
import { decksApi } from "@/lib/decks";
import { cardsApi } from "@/lib/cards";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const COLORS = ["W", "U", "B", "R", "G"] as const;

const firstCommander = (commanders: string) => commanders.split(",")[0]?.trim() ?? "";

export function PreconsPage() {
  const navigate = useNavigate();
  const [precons, setPrecons] = useState<PreconListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set());
  const [importingId, setImportingId] = useState<string | null>(null);
  // Commander name (lowercased) → art-crop image, for the deck-tile banners.
  const [art, setArt] = useState<Record<string, string>>({});

  const colorsParam = useMemo(
    () => COLORS.filter((c) => activeColors.has(c)).join(""),
    [activeColors]
  );

  // Debounced fetch on filter changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const items = await preconsApi.list({
          search: search.trim() || undefined,
          colors: colorsParam || undefined,
        });
        if (!cancelled) setPrecons(items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, colorsParam]);

  // Fetch commander art for the shown precons (batched, names we don't have yet).
  useEffect(() => {
    const names = [...new Set(precons.map((p) => firstCommander(p.commanders)).filter(Boolean))];
    const missing = names.filter((n) => !(n.toLowerCase() in art));
    if (missing.length === 0) return;
    let cancelled = false;
    void cardsApi.byNames(missing).then(({ cards }) => {
      if (cancelled) return;
      setArt((prev) => {
        const next = { ...prev };
        for (const c of cards) {
          const url = c.imageUris?.art_crop ?? c.cardFaces?.[0]?.imageUris?.art_crop;
          if (url) next[c.name.toLowerCase()] = url;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [precons, art]);

  function toggleColor(c: string) {
    setActiveColors((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async function onImport(id: string) {
    setImportingId(id);
    try {
      const deck = await decksApi.importPrecon(id);
      toast.success(`Added "${deck.name}" to your decks`);
      navigate("/decks", { state: { importedDeckId: deck.id } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Import failed");
    } finally {
      setImportingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Precon Library</h1>

      <Card>
        <CardContent className="space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by deck or commander name…"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Color identity:</span>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => toggleColor(c)}
                className={cn(
                  "h-7 w-7 rounded-full text-xs font-bold border-2 transition",
                  activeColors.has(c)
                    ? "border-accent scale-110"
                    : "border-transparent opacity-60 hover:opacity-100",
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
            {activeColors.size > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setActiveColors(new Set())}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : precons.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No precons match"
          description="Try clearing the search or color filters."
        />
      ) : (
        <>
          <p className="text-sm text-muted">{precons.length} decks</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {precons.map((p) => {
              const cropUrl = art[firstCommander(p.commanders).toLowerCase()];
              return (
                <Card key={p.id} className="overflow-hidden flex flex-col">
                  {/* Commander art banner (click to add). */}
                  <button
                    className="group relative block h-28 w-full overflow-hidden bg-surface-2 text-left"
                    onClick={() => onImport(p.id)}
                    disabled={importingId === p.id}
                    title={`Add ${p.name}`}
                  >
                    {cropUrl ? (
                      <img
                        src={cropUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted text-xs">
                        {firstCommander(p.commanders) || p.name}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="absolute bottom-1.5 left-2 right-2">
                      <div className="font-semibold text-white text-sm leading-tight truncate drop-shadow">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-zinc-200 truncate drop-shadow">⌘ {p.commanders}</div>
                    </div>
                    <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-accent/20 font-semibold text-white">
                      {importingId === p.id ? "Adding…" : "+ Add to my decks"}
                    </span>
                  </button>
                  <CardContent className="flex items-center justify-between py-2">
                    <ColorPips identity={p.colorIdentity} />
                    <span className="text-xs text-muted uppercase">{p.setCode}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
