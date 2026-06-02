import { useEffect, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { GameCard, Zone } from "@mtgc/shared";
import { useCards, cardImage } from "@/store/cards";
import { useCardHover } from "@/lib/useCardHover";
import { cn } from "@/lib/utils";

export type CardActionKind =
  | "tap"
  | "untap"
  | "plus"
  | "minus"
  | "counter"
  | "gy"
  | "exile"
  | "hand"
  | "libTop"
  | "libBottom"
  | "flip"
  | "reveal"
  | "clone";

interface Props {
  card: GameCard;
  zone: Zone;
  /** Whether the viewer controls this card (can drag/act on it). */
  owned: boolean;
  size?: "sm" | "md";
  onTap?: () => void;
  onAction?: (kind: CardActionKind) => void;
}

const MENU: { kind: CardActionKind; label: string }[] = [
  { kind: "tap", label: "Tap / untap" },
  { kind: "plus", label: "Add +1/+1" },
  { kind: "minus", label: "Add −1/−1" },
  { kind: "counter", label: "Add counter…" },
  { kind: "flip", label: "Flip face-down" },
  { kind: "clone", label: "Clone (token)" },
  { kind: "reveal", label: "Reveal" },
  { kind: "hand", label: "→ Hand" },
  { kind: "gy", label: "→ Graveyard" },
  { kind: "exile", label: "→ Exile" },
  { kind: "libTop", label: "→ Library (top)" },
  { kind: "libBottom", label: "→ Library (bottom)" },
];

export function GameCardView({ card, zone, owned, size = "md", onTap, onAction }: Props) {
  const ensure = useCards((s) => s.ensure);
  const data = useCards((s) => s.cards[card.scryfallId]);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!card.faceDown) void ensure([card.scryfallId]);
  }, [card.scryfallId, card.faceDown, ensure]);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.instanceId,
    data: { zone },
    disabled: !owned,
  });
  const hover = useCardHover(card.faceDown ? undefined : card.scryfallId);

  const img = card.faceDown ? undefined : cardImage(data);
  const w = size === "sm" ? "w-16" : "w-24";
  const h = size === "sm" ? "h-[5.6rem]" : "h-[8.4rem]";

  return (
    <div
      ref={setNodeRef}
      {...(owned ? listeners : {})}
      {...attributes}
      {...hover}
      onClick={() => zone === "battlefield" && owned && onTap?.()}
      onContextMenu={(e) => {
        if (!owned || !onAction) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
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
          <img
            src={img}
            alt={card.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover opacity-0 transition-opacity duration-300"
            onLoad={(e) => e.currentTarget.classList.remove("opacity-0")}
          />
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
              {c.kind === "+1/+1" ? `+${c.count}` : c.kind === "-1/-1" ? `-${c.count}` : `${c.kind} ${c.count}`}
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

      {/* Right-click context menu */}
      {menu && onAction && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div
            className="fixed z-50 min-w-40 rounded-md border border-border bg-surface py-1 shadow-xl"
            style={{ left: Math.min(menu.x, window.innerWidth - 180), top: Math.min(menu.y, window.innerHeight - 320) }}
            onClick={(e) => e.stopPropagation()}
          >
            {MENU.map((m) => (
              <button
                key={m.kind}
                className="block w-full px-3 py-1 text-left text-xs text-white hover:bg-surface-2"
                onClick={() => {
                  onAction(m.kind);
                  setMenu(null);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
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
