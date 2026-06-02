import { useMemo } from "react";
import type { DeckCardEntry } from "@mtgc/shared";
import { useCards } from "@/store/cards";

/** Mana-curve bar chart by converted mana cost. Lands and commanders are excluded
 * (lands have no meaningful CMC; commanders sit in the command zone). */
export function ManaCurve({ cards }: { cards: DeckCardEntry[] }) {
  const data = useCards((s) => s.cards);

  const buckets = useMemo(() => {
    const b = [0, 0, 0, 0, 0, 0, 0, 0]; // 0,1,2,3,4,5,6,7+
    for (const entry of cards) {
      if (entry.isCommander) continue;
      const card = data[entry.scryfallId];
      if (!card || /Land/.test(card.typeLine ?? "")) continue;
      const cmc = Math.min(7, Math.floor(card.cmc ?? 0));
      b[cmc] += entry.quantity;
    }
    return b;
  }, [cards, data]);

  const max = Math.max(1, ...buckets);

  return (
    <div className="flex items-end gap-1 h-24">
      {buckets.map((n, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="text-[10px] text-muted">{n}</div>
          <div
            className="w-full rounded-t bg-accent/80"
            style={{ height: `${(n / max) * 100}%`, minHeight: n > 0 ? "4px" : "0" }}
            title={`CMC ${i === 7 ? "7+" : i}: ${n}`}
          />
          <div className="text-[10px] text-muted">{i === 7 ? "7+" : i}</div>
        </div>
      ))}
    </div>
  );
}
