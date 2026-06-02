import type { GameAction, GameStateView, Phase } from "@mtgc/shared";
import { PHASE_LABELS, PHASE_ORDER } from "@mtgc/shared";
import { Button } from "@/components/ui/Button";
import { useSettings } from "@/store/settings";
import { cn } from "@/lib/utils";

// Phases the game stops at when "auto-pass empty phases" is on.
const STOPS = new Set<Phase>(["main1", "combat_attackers", "main2", "end"]);

export function PhaseBar({
  state,
  act,
  readOnly = false,
}: {
  state: GameStateView;
  act: (a: GameAction) => void;
  readOnly?: boolean;
}) {
  const active = state.players[state.activePlayerIndex];
  const priorityName = state.players.find((p) => p.id === state.priorityPlayerId)?.username;
  const autoPass = useSettings((s) => s.autoPass);

  function nextPhase() {
    if (!autoPass) {
      act({ type: "next_phase" });
      return;
    }
    // Advance until the next "stop" phase (at least one step), deterministically.
    let i = PHASE_ORDER.indexOf(state.phase);
    let steps = 0;
    do {
      i = (i + 1) % PHASE_ORDER.length;
      steps++;
    } while (!STOPS.has(PHASE_ORDER[i]) && steps < PHASE_ORDER.length);
    for (let s = 0; s < steps; s++) act({ type: "next_phase" });
  }

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
        {!readOnly && (
          <>
            <Button size="sm" variant="secondary" onClick={() => act({ type: "pass_priority" })}>
              Pass priority
            </Button>
            <Button size="sm" variant="secondary" onClick={nextPhase}>
              {autoPass ? "Next stop" : "Next phase"}
            </Button>
            <Button size="sm" onClick={() => act({ type: "next_turn" })}>
              Next turn
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
