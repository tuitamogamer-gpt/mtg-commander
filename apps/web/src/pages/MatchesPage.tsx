import { useEffect, useState } from "react";
import type { MatchSummary } from "@mtgc/shared";
import { Card, CardContent } from "@/components/ui/Card";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";

export function MatchesPage() {
  const user = useAuth((s) => s.user);
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);

  useEffect(() => {
    void api.get<MatchSummary[]>("/api/matches").then(setMatches);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Match history</h1>
      {matches === null ? (
        <CardGridSkeleton count={3} />
      ) : matches.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="No games yet"
          description="Finished games show up here once you end them from the table."
        />
      ) : (
        <div className="space-y-2">
          {matches.map((m) => {
            const won = m.winnerId === user?.id;
            return (
              <Card key={m.id}>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">
                      {m.participants.map((p) => p.username).join(", ")}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(m.finishedAt).toLocaleString()} · {m.turns} turns
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={won ? "text-success font-semibold" : "text-muted"}>
                      {m.winnerName ? `🏆 ${m.winnerName}` : "Draw"}
                    </div>
                    {won && <div className="text-xs text-success">You won</div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
