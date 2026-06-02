import { useState } from "react";
import type { BattlefieldRow, GameAction, GameCard, PlayerStateView, Zone } from "@mtgc/shared";
import { GameCardView } from "./GameCardView";
import { Droppable } from "./Droppable";
import { PileViewer } from "./PileViewer";
import { Button } from "@/components/ui/Button";

interface Props {
  player: PlayerStateView;
  libraryCount: number;
  act: (a: GameAction) => void;
}

const ROW_LABELS: Record<BattlefieldRow, string> = {
  lands: "Lands",
  creatures: "Creatures",
  other: "Other",
};

function byRow(cards: GameCard[], row: BattlefieldRow): GameCard[] {
  return cards.filter((c) => (c.row ?? "other") === row);
}

function cardActionHandler(act: Props["act"], card: GameCard) {
  return (kind: "gy" | "exile" | "plus" | "minus" | "flip") => {
    switch (kind) {
      case "gy":
        return act({ type: "move_card", instanceId: card.instanceId, to: "graveyard" });
      case "exile":
        return act({ type: "move_card", instanceId: card.instanceId, to: "exile" });
      case "plus":
        return act({ type: "add_counter", instanceId: card.instanceId, kind: "+1/+1", delta: 1 });
      case "minus":
        return act({ type: "add_counter", instanceId: card.instanceId, kind: "-1/-1", delta: 1 });
      case "flip":
        return act({ type: "flip", instanceId: card.instanceId, faceDown: !card.faceDown });
    }
  };
}

export function SelfBoard({ player, libraryCount, act }: Props) {
  const hand = Array.isArray(player.zones.hand) ? player.zones.hand : [];
  const [viewer, setViewer] = useState<{ title: string; zone: Zone; cards: GameCard[] } | null>(null);

  const renderCard = (card: GameCard, zone: Zone, size?: "sm" | "md") => (
    <GameCardView
      key={card.instanceId}
      card={card}
      zone={zone}
      owned
      size={size}
      onTap={() => act({ type: "tap", instanceId: card.instanceId, tapped: !card.tapped })}
      onAction={cardActionHandler(act, card)}
    />
  );

  return (
    <div className="space-y-2">
      {/* Battlefield rows */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="space-y-2">
          {(["lands", "creatures", "other"] as BattlefieldRow[]).map((row) => (
            <Droppable
              key={row}
              id={`bf:${row}`}
              className="min-h-[5rem] rounded-md border border-dashed border-border bg-bg/40 p-1.5"
            >
              <div className="text-[10px] uppercase tracking-wide text-muted mb-1">{ROW_LABELS[row]}</div>
              <div className="flex flex-wrap gap-1">
                {byRow(player.zones.battlefield, row).map((c) => renderCard(c, "battlefield"))}
              </div>
            </Droppable>
          ))}
        </div>

        {/* Pile sidebar: library / graveyard / exile / command */}
        <div className="flex flex-col gap-2 w-36">
          <Pile label="Library" count={libraryCount}>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => act({ type: "draw", count: 1 })}>
                Draw
              </Button>
              <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => act({ type: "shuffle" })}>
                Shuffle
              </Button>
              <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => act({ type: "mill", count: 1 })}>
                Mill
              </Button>
            </div>
          </Pile>

          <DropPile label="Graveyard" zone="graveyard" cards={player.zones.graveyard}
            onView={() => setViewer({ title: "Graveyard", zone: "graveyard", cards: player.zones.graveyard })} />
          <DropPile label="Exile" zone="exile" cards={player.zones.exile}
            onView={() => setViewer({ title: "Exile", zone: "exile", cards: player.zones.exile })} />
          <DropPile label="Command" zone="command" cards={player.zones.command}
            onView={() => setViewer({ title: "Command zone", zone: "command", cards: player.zones.command })} />
        </div>
      </div>

      {/* Hand */}
      <Droppable id="hand" className="rounded-md border border-border bg-surface/60 p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">Hand ({hand.length})</span>
        </div>
        <div className="flex flex-wrap gap-1 min-h-[8.4rem]">
          {hand.length === 0 ? (
            <span className="text-muted text-sm italic self-center">No cards in hand</span>
          ) : (
            hand.map((c) => renderCard(c, "hand"))
          )}
        </div>
      </Droppable>

      {viewer && (
        <PileViewer
          title={viewer.title}
          zone={viewer.zone}
          cards={viewer.cards}
          owned
          act={act}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );

  function DropPile({
    label,
    zone,
    cards,
    onView,
  }: {
    label: string;
    zone: Zone;
    cards: GameCard[];
    onView: () => void;
  }) {
    return (
      <Droppable id={zone} className="rounded-md border border-border bg-surface-2 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{label}</span>
          <button className="text-xs text-accent hover:underline" onClick={onView}>
            {cards.length}
          </button>
        </div>
        {cards.length > 0 && (
          <div className="mt-1">{renderCard(cards[cards.length - 1], zone, "sm")}</div>
        )}
      </Droppable>
    );
  }
}

function Pile({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs text-white tabular-nums">{count}</span>
      </div>
      {children}
    </div>
  );
}
