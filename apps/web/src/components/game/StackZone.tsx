import { useEffect } from "react";
import type { GameAction, GameStateView, StackItem } from "@mtgc/shared";
import { Droppable } from "./Droppable";
import { useCards, cardImage } from "@/store/cards";
import { useCardHover } from "@/lib/useCardHover";
import { cn } from "@/lib/utils";

interface Props {
  state: GameStateView;
  readOnly?: boolean;
  act: (a: GameAction) => void;
}

/**
 * The shared stack, on the left. Drag a card from hand onto it to cast; the top
 * is at the top of the list. Anyone may resolve a spell to the battlefield /
 * graveyard or counter it to the graveyard (honor system).
 */
export function StackZone({ state, readOnly = false, act }: Props) {
  const ensure = useCards((s) => s.ensure);
  const cards = useCards((s) => s.cards);
  const stack = state.stack as StackItem[];

  useEffect(() => {
    void ensure(stack.filter((c) => !c.faceDown).map((c) => c.scryfallId));
  }, [stack, ensure]);

  const controllerName = (id?: string) =>
    state.players.find((p) => p.id === id)?.username ?? "?";

  return (
    <Droppable
      id="stack"
      className={cn(
        "w-44 shrink-0 rounded-lg border p-2 space-y-2 overflow-y-auto",
        stack.length > 0 ? "border-accent/60 bg-accent/5" : "border-dashed border-border bg-bg/40"
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted">Stack ({stack.length})</div>
      {stack.length === 0 ? (
        <p className="text-[11px] text-muted italic">Drag a spell here to cast.</p>
      ) : (
        // Render top of stack first (resolves first).
        [...stack].reverse().map((card, i) => {
          const img = card.faceDown ? undefined : cardImage(cards[card.scryfallId]);
          const isTop = i === 0;
          return (
            <div
              key={card.instanceId}
              className={cn(
                "rounded-md border bg-surface-2 p-1.5 space-y-1",
                isTop ? "border-accent" : "border-border"
              )}
            >
              <div className="flex gap-1.5">
                <StackImg img={img} card={card} />
                <div className="min-w-0 text-[11px]">
                  <div className="text-white truncate">{card.name}</div>
                  <div className="text-muted">by {controllerName(card.controllerId)}</div>
                  {card.stackNote && <div className="text-accent truncate">{card.stackNote}</div>}
                  {isTop && <div className="text-[9px] text-accent">▲ top</div>}
                </div>
              </div>
              {!readOnly && (
                <div className="flex flex-wrap gap-1">
                  <StackBtn label="→ Battlefield"
                    onClick={() => act({ type: "resolve_stack_item", instanceId: card.instanceId, to: "battlefield", toRow: "other" })} />
                  <StackBtn label="→ GY"
                    onClick={() => act({ type: "resolve_stack_item", instanceId: card.instanceId, to: "graveyard" })} />
                  <StackBtn label="↩ Hand"
                    onClick={() => act({ type: "resolve_stack_item", instanceId: card.instanceId, to: "hand" })} />
                </div>
              )}
            </div>
          );
        })
      )}
    </Droppable>
  );
}

function StackImg({ img, card }: { img?: string; card: StackItem }) {
  const hover = useCardHover(card.faceDown ? undefined : card.scryfallId);
  return img ? (
    <img {...hover} src={img} alt={card.name} className="h-16 w-12 rounded object-cover shrink-0" />
  ) : (
    <div className="h-16 w-12 rounded bg-bg flex items-center justify-center text-[9px] text-muted text-center p-0.5 shrink-0">
      {card.faceDown ? "face down" : card.name}
    </div>
  );
}

function StackBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-white hover:bg-surface/70 border border-border"
    >
      {label}
    </button>
  );
}
