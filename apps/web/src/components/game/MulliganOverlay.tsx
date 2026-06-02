import { useEffect, useState } from "react";
import type { GameAction, GameCard, PlayerStateView } from "@mtgc/shared";
import { useCards, cardImage } from "@/store/cards";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface Props {
  me: PlayerStateView;
  players: PlayerStateView[];
  act: (a: GameAction) => void;
}

/**
 * London mulligan flow. Shown until the viewer keeps their opening hand.
 * Mulligan reshuffles and redraws 7; keeping after N mulligans requires choosing
 * N cards to put on the bottom of the library.
 */
export function MulliganOverlay({ me, players, act }: Props) {
  const hand = (Array.isArray(me.zones.hand) ? me.zones.hand : []) as GameCard[];
  const ensure = useCards((s) => s.ensure);
  const cards = useCards((s) => s.cards);
  const [bottoming, setBottoming] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    void ensure(hand.map((c) => c.scryfallId));
  }, [hand, ensure]);

  // Reset selection whenever the hand changes (e.g. after a mulligan).
  useEffect(() => {
    setSelected(new Set());
    setBottoming(false);
  }, [me.mulligans]);

  const needBottom = me.mulligans;
  const canConfirm = selected.size === needBottom;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < needBottom) next.add(id);
      return next;
    });
  }

  function onKeep() {
    if (needBottom === 0) {
      act({ type: "keep_hand", bottom: [] });
    } else {
      setBottoming(true);
    }
  }

  function onConfirmBottom() {
    act({ type: "keep_hand", bottom: [...selected] });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-4xl rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {bottoming ? `Put ${needBottom} card${needBottom === 1 ? "" : "s"} on the bottom` : "Opening hand"}
          </h2>
          <span className="text-sm text-muted">
            Mulligans taken: <span className="text-accent font-semibold">{me.mulligans}</span>
          </span>
        </div>

        {bottoming ? (
          <p className="text-sm text-muted">
            Selected {selected.size}/{needBottom}. Click cards to choose which go to the bottom of
            your library.
          </p>
        ) : (
          <p className="text-sm text-muted">
            Keep this hand, or mulligan to draw a new seven{" "}
            {me.mulligans > 0 && <>— you'll then bottom {me.mulligans} card(s)</>}.
          </p>
        )}

        <div className="flex flex-wrap gap-2 justify-center min-h-[8.4rem]">
          {hand.map((c) => {
            const img = cardImage(cards[c.scryfallId]);
            const isSel = selected.has(c.instanceId);
            return (
              <button
                key={c.instanceId}
                onClick={() => bottoming && toggle(c.instanceId)}
                disabled={!bottoming}
                className={cn(
                  "relative w-24 h-[8.4rem] rounded-md border-2 overflow-hidden transition",
                  bottoming ? "cursor-pointer" : "cursor-default",
                  isSel ? "border-danger scale-95" : "border-border"
                )}
                title={c.name}
              >
                {img ? (
                  <img src={img} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center p-1 text-center text-[10px] text-muted bg-surface-2">
                    {c.name}
                  </div>
                )}
                {isSel && (
                  <div className="absolute inset-0 bg-danger/30 flex items-center justify-center text-white font-bold text-xs">
                    ↓ bottom
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted">
            {players
              .filter((p) => p.id !== me.id)
              .map((p) => `${p.username}: ${p.keptHand ? "kept" : `mull ${p.mulligans}`}`)
              .join(" · ")}
          </div>
          <div className="flex gap-2">
            {bottoming ? (
              <>
                <Button variant="ghost" onClick={() => setBottoming(false)}>
                  Back
                </Button>
                <Button onClick={onConfirmBottom} disabled={!canConfirm}>
                  Confirm keep
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => act({ type: "mulligan" })}>
                  Mulligan
                </Button>
                <Button onClick={onKeep}>Keep hand</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
