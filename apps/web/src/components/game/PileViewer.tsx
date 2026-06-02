import type { GameCard, GameAction, Zone } from "@mtgc/shared";
import { GameCardView } from "./GameCardView";
import { Button } from "@/components/ui/Button";

interface Props {
  title: string;
  zone: Zone;
  cards: GameCard[];
  owned: boolean;
  act: (a: GameAction) => void;
  onClose: () => void;
}

/** Modal listing the contents of a zone, with quick "move to…" buttons. */
export function PileViewer({ title, zone, cards, owned, act, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {title} ({cards.length})
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        {cards.length === 0 ? (
          <p className="text-muted text-sm">Empty.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {cards.map((c) => (
              <div key={c.instanceId} className="space-y-1">
                <GameCardView card={c} zone={zone} owned={owned} />
                {owned && (
                  <div className="flex justify-center gap-1">
                    <Mini label="Hand" onClick={() => act({ type: "move_card", instanceId: c.instanceId, to: "hand" })} />
                    <Mini label="BF" onClick={() => act({ type: "move_card", instanceId: c.instanceId, to: "battlefield", toRow: "other" })} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded bg-surface-2 px-1.5 text-[10px] text-white hover:bg-surface-2/70">
      {label}
    </button>
  );
}
