import type { GameAction, PlayerStateView } from "@mtgc/shared";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface Props {
  players: PlayerStateView[];
  viewerId: string;
  act: (action: GameAction) => void;
}

/** Life totals plus the Commander damage matrix (rows = defender, cols = source). */
export function LifeTracker({ players, viewerId, act }: Props) {
  return (
    <div className="space-y-3">
      {players.map((p) => (
        <div key={p.id} className="rounded-md border border-border bg-surface-2 p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-white truncate">{p.username}</span>
              {p.id === viewerId && <span className="text-[10px] text-muted">(you)</span>}
              {p.isMonarch && <span title="Monarch" className="text-amber-400 text-xs">♛</span>}
              {p.hasInitiative && <span title="Initiative" className="text-sky-400 text-xs">⚔</span>}
              {!p.connected && <span className="text-[10px] text-danger">offline</span>}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-6 w-6"
                onClick={() => act({ type: "set_life", playerId: p.id, life: p.life - 1 })}>
                −
              </Button>
              <span className={cn("w-8 text-center font-bold tabular-nums",
                p.life <= 0 ? "text-danger" : "text-white")}>
                {p.life}
              </span>
              <Button size="icon" variant="ghost" className="h-6 w-6"
                onClick={() => act({ type: "set_life", playerId: p.id, life: p.life + 1 })}>
                +
              </Button>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            {p.poison > 0 && <span className="text-green-400">☠ {p.poison}</span>}
            {/* Commander damage taken, per source player */}
            {players
              .filter((src) => src.id !== p.id)
              .map((src) => {
                const dmg = p.commanderDamage[src.id] ?? 0;
                return (
                  <span key={src.id} className="inline-flex items-center gap-1">
                    <span>cmd from {src.username}:</span>
                    <button
                      className="px-1 rounded hover:bg-white/10"
                      onClick={() =>
                        act({
                          type: "set_commander_damage",
                          playerId: p.id,
                          fromPlayerId: src.id,
                          amount: Math.max(0, dmg - 1),
                        })
                      }
                    >
                      −
                    </button>
                    <span className={cn("tabular-nums", dmg >= 21 ? "text-danger font-bold" : "text-white")}>
                      {dmg}
                    </span>
                    <button
                      className="px-1 rounded hover:bg-white/10"
                      onClick={() =>
                        act({
                          type: "set_commander_damage",
                          playerId: p.id,
                          fromPlayerId: src.id,
                          amount: dmg + 1,
                        })
                      }
                    >
                      +
                    </button>
                  </span>
                );
              })}
          </div>

          {/* Player-level counters (energy, experience, treasure, …) — own row */}
          {p.id === viewerId && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              {p.counters.map((c) => (
                <span key={c.kind} className="inline-flex items-center gap-1 text-muted">
                  <span className="text-white">{c.kind}</span>
                  <button className="px-1 rounded hover:bg-white/10"
                    onClick={() => act({ type: "set_player_counter", kind: c.kind, count: c.count - 1 })}>−</button>
                  <span className="tabular-nums text-white">{c.count}</span>
                  <button className="px-1 rounded hover:bg-white/10"
                    onClick={() => act({ type: "set_player_counter", kind: c.kind, count: c.count + 1 })}>+</button>
                </span>
              ))}
              <button
                className="rounded border border-border px-1.5 text-muted hover:text-white"
                onClick={() => {
                  const kind = window.prompt("Counter name (energy, experience, treasure, …):");
                  if (kind) act({ type: "set_player_counter", kind, count: 1 });
                }}
              >
                + counter
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
