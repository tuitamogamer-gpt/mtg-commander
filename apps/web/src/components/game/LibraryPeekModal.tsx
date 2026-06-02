import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GameAction, GameCard } from "@mtgc/shared";
import { useGame } from "@/store/game";
import { useCards, cardImage } from "@/store/cards";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export type PeekMode = "scry" | "look" | "tutor";

interface Props {
  mode: PeekMode;
  count: number;
  act: (a: GameAction) => void;
  onClose: () => void;
}

export function LibraryPeekModal({ mode, count, act, onClose }: Props) {
  const peek = useGame((s) => s.peek);
  const ensure = useCards((s) => s.ensure);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [bottom, setBottom] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    peek(mode === "tutor" ? 9999 : count).then((cs) => {
      if (cancelled) return;
      setCards(cs);
      setOrder(cs.map((c) => c.instanceId));
      void ensure(cs.map((c) => c.scryfallId));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, count, peek, ensure]);

  const byId = new Map(cards.map((c) => [c.instanceId, c]));
  const title =
    mode === "scry"
      ? `Scry ${count}`
      : mode === "look"
        ? `Top ${count} of your library`
        : "Search your library";

  function confirmScry() {
    const top = order.filter((id) => !bottom.has(id));
    const bot = order.filter((id) => bottom.has(id));
    act({ type: "arrange_library_top", top, bottom: bot });
    onClose();
  }

  function takeToHand(id: string) {
    act({ type: "move_card", instanceId: id, to: "hand" });
    act({ type: "shuffle" });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-surface p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {mode === "scry" && (
          <p className="text-sm text-muted">
            Drag to reorder the top (left = top of library). Toggle cards to send them to the
            bottom instead.
          </p>
        )}
        {mode === "tutor" && (
          <p className="text-sm text-muted">
            Click a card to put it into your hand. Your library is shuffled afterwards.
          </p>
        )}

        {loading ? (
          <p className="text-muted">Looking…</p>
        ) : cards.length === 0 ? (
          <p className="text-muted">Your library is empty.</p>
        ) : mode === "scry" ? (
          <ScryReorder
            order={order}
            byId={byId}
            bottom={bottom}
            setOrder={setOrder}
            toggleBottom={(id) =>
              setBottom((prev) => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })
            }
          />
        ) : mode === "tutor" ? (
          <TutorGrid cards={cards} byId={byId} filter={filter} setFilter={setFilter} onTake={takeToHand} />
        ) : (
          <CardRow ids={order} byId={byId} />
        )}

        {mode === "scry" && !loading && cards.length > 0 && (
          <div className="flex justify-end gap-2">
            <Button onClick={confirmScry}>Confirm order</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- scry reorder (sortable) ----------------------------------------------

function ScryReorder({
  order,
  byId,
  bottom,
  setOrder,
  toggleBottom,
}: {
  order: string[];
  byId: Map<string, GameCard>;
  bottom: Set<string>;
  setOrder: (o: string[]) => void;
  toggleBottom: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = order.indexOf(String(e.active.id));
    const to = order.indexOf(String(e.over.id));
    if (from >= 0 && to >= 0) setOrder(arrayMove(order, from, to));
  }
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap gap-3">
          {order.map((id, i) => (
            <SortableScryCard
              key={id}
              id={id}
              index={i}
              card={byId.get(id)}
              isBottom={bottom.has(id)}
              onToggleBottom={() => toggleBottom(id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableScryCard({
  id,
  index,
  card,
  isBottom,
  onToggleBottom,
}: {
  id: string;
  index: number;
  card?: GameCard;
  isBottom: boolean;
  onToggleBottom: () => void;
}) {
  const cards = useCards((s) => s.cards);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const img = card ? cardImage(cards[card.scryfallId]) : undefined;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("space-y-1", isDragging && "opacity-50")}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "relative w-24 h-[8.4rem] rounded-md border-2 overflow-hidden cursor-grab",
          isBottom ? "border-danger opacity-60" : "border-border"
        )}
      >
        {img ? (
          <img src={img} alt={card?.name} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="h-full w-full flex items-center justify-center p-1 text-center text-[10px] text-muted bg-surface-2">
            {card?.name}
          </div>
        )}
        <span className="absolute top-0 left-0 bg-black/70 px-1 text-[10px] text-white">
          {isBottom ? "↓" : index + 1}
        </span>
      </div>
      <button
        onClick={onToggleBottom}
        className={cn(
          "w-full rounded px-1 text-[10px]",
          isBottom ? "bg-danger text-white" : "bg-surface-2 text-muted hover:text-white"
        )}
      >
        {isBottom ? "to bottom" : "keep on top"}
      </button>
    </div>
  );
}

// --- look (read-only row) --------------------------------------------------

function CardRow({ ids, byId }: { ids: string[]; byId: Map<string, GameCard> }) {
  const cards = useCards((s) => s.cards);
  return (
    <div className="flex flex-wrap gap-3">
      {ids.map((id, i) => {
        const card = byId.get(id);
        const img = card ? cardImage(cards[card.scryfallId]) : undefined;
        return (
          <div key={id} className="relative w-24 h-[8.4rem] rounded-md border border-border overflow-hidden">
            {img ? (
              <img src={img} alt={card?.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center p-1 text-center text-[10px] text-muted bg-surface-2">
                {card?.name}
              </div>
            )}
            <span className="absolute top-0 left-0 bg-black/70 px-1 text-[10px] text-white">{i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- tutor (searchable grid, click to take) --------------------------------

function TutorGrid({
  cards,
  byId,
  filter,
  setFilter,
  onTake,
}: {
  cards: GameCard[];
  byId: Map<string, GameCard>;
  filter: string;
  setFilter: (s: string) => void;
  onTake: (id: string) => void;
}) {
  const cardData = useCards((s) => s.cards);
  const f = filter.trim().toLowerCase();
  const shown = cards.filter((c) => !f || c.name.toLowerCase().includes(f));
  return (
    <div className="space-y-3">
      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filter ${cards.length} cards…`} />
      <div className="flex flex-wrap gap-2">
        {shown.map((c) => {
          const img = cardImage(cardData[c.scryfallId]);
          return (
            <button
              key={c.instanceId}
              onClick={() => onTake(c.instanceId)}
              className="w-20 h-[7rem] rounded-md border border-border overflow-hidden hover:border-accent transition"
              title={`Take ${byId.get(c.instanceId)?.name ?? c.name} to hand`}
            >
              {img ? (
                <img src={img} alt={c.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center p-1 text-center text-[9px] text-muted bg-surface-2">
                  {c.name}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
