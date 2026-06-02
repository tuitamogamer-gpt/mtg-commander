import { useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { GameCard, Zone } from "@mtgc/shared";
import { useCards, cardImage } from "@/store/cards";
import { cn } from "@/lib/utils";

interface Props {
  card: GameCard;
  zone: Zone;
  /** Whether the viewer controls this card (can drag/act on it). */
  owned: boolean;
  size?: "sm" | "md";
  onTap?: () => void;
  onAction?: (kind: "gy" | "exile" | "plus" | "minus" | "flip") => void;
}

export function GameCardView({ card, zone, owned, size = "md", onTap, onAction }: Props) {
  const ensure = useCards((s) => s.ensure);
  const data = useCards((s) => s.cards[card.scryfallId]);

  useEffect(() => {
    if (!card.faceDown) void ensure([card.scryfallId]);
  }, [card.scryfallId, card.faceDown, ensure]);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.instanceId,
    data: { zone },
    disabled: !owned,
  });

  const img = card.faceDown ? undefined : cardImage(data);
  const w = size === "sm" ? "w-16" : "w-24";
  const h = size === "sm" ? "h-[5.6rem]" : "h-[8.4rem]";

  return (
    <div
      ref={setNodeRef}
      {...(owned ? listeners : {})}
      {...attributes}
      onClick={() => zone === "battlefield" && owned && onTap?.()}
      className={cn(
        "group relative shrink-0 rounded-md border border-border bg-surface-2 overflow-visible select-none",
        w,
        h,
        owned && "cursor-grab active:cursor-grabbing",
        card.tapped && "rotate-90",
        isDragging && "opacity-30",
        "transition-transform"
      )}
      title={card.faceDown ? "Face-down" : card.name}
    >
      <div className="absolute inset-0 rounded-md overflow-hidden">
        {card.faceDown ? (
          <div className="h-full w-full bg-gradient-to-br from-indigo-900 to-zinc-900 flex items-center justify-center text-[10px] text-muted">
            Face down
          </div>
        ) : img ? (
          <img src={img} alt={card.name} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="h-full w-full flex items-center justify-center p-1 text-center text-[10px] text-muted">
            {card.name}
          </div>
        )}
      </div>

      {/* Counters */}
      {card.counters.length > 0 && (
        <div className="absolute -top-1 -right-1 flex flex-col gap-0.5">
          {card.counters.map((c) => (
            <span
              key={c.kind}
              className="rounded-full bg-black/80 px-1 text-[9px] font-bold text-white border border-white/30"
              title={c.kind}
            >
              {c.kind === "+1/+1" ? `+${c.count}` : c.kind === "-1/-1" ? `-${c.count}` : `${c.count}`}
            </span>
          ))}
        </div>
      )}

      {card.annotation && (
        <div className="absolute -bottom-1 left-0 right-0 mx-auto w-fit rounded bg-accent px-1 text-[9px] font-semibold text-black">
          {card.annotation}
        </div>
      )}

      {/* Hover toolbar for quick actions */}
      {owned && onAction && (
        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:flex gap-0.5 rounded bg-black/90 px-1 py-0.5 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <ToolBtn label="+1" title="+1/+1 counter" onClick={() => onAction("plus")} />
          <ToolBtn label="−1" title="-1/-1 counter" onClick={() => onAction("minus")} />
          <ToolBtn label="GY" title="To graveyard" onClick={() => onAction("gy")} />
          <ToolBtn label="EX" title="To exile" onClick={() => onAction("exile")} />
          <ToolBtn label="⟳" title="Flip face-down" onClick={() => onAction("flip")} />
        </div>
      )}
    </div>
  );
}

function ToolBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded px-1 text-[10px] text-white hover:bg-white/20"
    >
      {label}
    </button>
  );
}
