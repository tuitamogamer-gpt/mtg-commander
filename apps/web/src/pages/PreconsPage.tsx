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
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const COLORS = ["W", "U", "B", "R", "G"] as const;

export function PreconsPage() {
  const navigate = useNavigate();
  const [precons, setPrecons] = useState<PreconListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set());
  const [importingId, setImportingId] = useState<string | null>(null);

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
            {precons.map((p) => (
              <Card key={p.id}>
                <CardContent className="space-y-2">
                  <div className="font-semibold text-white">{p.name}</div>
                  <div className="text-sm text-muted">⌘ {p.commanders}</div>
                  <div className="flex items-center justify-between pt-1">
                    <ColorPips identity={p.colorIdentity} />
                    <span className="text-xs text-muted uppercase">{p.setCode}</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    disabled={importingId === p.id}
                    onClick={() => onImport(p.id)}
                  >
                    {importingId === p.id ? "Importing…" : "Import to my decks"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
