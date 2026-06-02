import type { GameAction, GameStateView } from "@mtgc/shared";
import { PHASE_LABELS, PHASE_ORDER } from "@mtgc/shared";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function PhaseBar({
  state,
  act,
}: {
  state: GameStateView;
  act: (a: GameAction) => void;
}) {
  const active = state.players[state.activePlayerIndex];
  const priorityName = state.players.find((p) => p.id === state.priorityPlayerId)?.username;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="text-sm">
        <span className="text-muted">Turn</span>{" "}
        <span className="font-bold text-white">{state.turn}</span>{" "}
        <span className="text-muted">·</span>{" "}
        <span className="text-accent font-medium">{active?.username ?? "?"}</span>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        {PHASE_ORDER.map((ph) => (
          <span
            key={ph}
            className={cn(
              "text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap",
              ph === state.phase ? "bg-accent text-black font-semibold" : "text-muted"
            )}
          >
            {PHASE_LABELS[ph]}
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {priorityName && (
          <span className="text-xs text-muted">priority: {priorityName}</span>
        )}
        <Button size="sm" variant="secondary" onClick={() => act({ type: "pass_priority" })}>
          Pass priority
        </Button>
        <Button size="sm" variant="secondary" onClick={() => act({ type: "next_phase" })}>
          Next phase
        </Button>
        <Button size="sm" onClick={() => act({ type: "next_turn" })}>
          Next turn
        </Button>
      </div>
    </div>
  );
}
