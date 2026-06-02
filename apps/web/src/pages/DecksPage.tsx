import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Deck } from "@mtgc/shared";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ColorPips } from "@/components/ColorPips";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { decksApi, deckCardCount } from "@/lib/decks";
import { ApiError } from "@/lib/api";

export function DecksPage() {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [moxId, setMoxId] = useState("");
  const [importing, setImporting] = useState(false);

  async function refresh() {
    setDecks(await decksApi.list());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onImport() {
    if (!moxId.trim()) return;
    setImporting(true);
    try {
      const deck = await decksApi.importMoxfield(moxId.trim());
      setMoxId("");
      await refresh();
      toast.success(`Imported "${deck.name}"`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function onDelete(id: string, name: string) {
    await decksApi.remove(id);
    setDecks((d) => d.filter((x) => x.id !== id));
    toast.success(`Deleted "${name}"`);
  }

  async function onNewDeck() {
    const deck = await decksApi.create("New deck");
    toast.success("Created a new deck");
    navigate(`/decks/${deck.id}/edit`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Decks</h1>
        <div className="flex gap-2">
          <Button onClick={onNewDeck}>New deck</Button>
          <Link to="/precons">
            <Button variant="outline">Browse Precons</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import from Moxfield</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Paste a public Moxfield deck URL or its id (e.g.
            <code className="mx-1 text-accent">moxfield.com/decks/abc123</code>).
          </p>
          <div className="flex gap-2">
            <Input
              value={moxId}
              onChange={(e) => setMoxId(e.target.value)}
              placeholder="https://www.moxfield.com/decks/…"
              onKeyDown={(e) => e.key === "Enter" && onImport()}
            />
            <Button onClick={onImport} disabled={importing || !moxId.trim()}>
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <CardGridSkeleton count={4} />
      ) : decks.length === 0 ? (
        <EmptyState
          icon="🃏"
          title="No decks yet"
          description="Import a deck from Moxfield above, build one from scratch, or clone an official Commander precon."
          action={
            <div className="flex gap-2">
              <Button onClick={onNewDeck}>New deck</Button>
              <Link to="/precons">
                <Button variant="outline">Browse precons</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {decks.map((deck) => (
            <Card key={deck.id}>
              <CardContent className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="font-semibold text-white truncate">{deck.name}</div>
                  {deck.commander && (
                    <div className="text-sm text-muted truncate">⌘ {deck.commander}</div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <ColorPips identity={deck.colorIdentity} />
                    <span className="text-xs text-muted">{deckCardCount(deck)} cards</span>
                    <span className="text-xs text-muted capitalize">· {deck.source}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Link to={`/decks/${deck.id}/edit`}>
                    <Button size="sm" variant="secondary" className="w-full">
                      Edit
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(deck.id, deck.name)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
