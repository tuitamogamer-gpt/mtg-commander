import type { PlayerStateView, BattlefieldRow, GameCard } from "@mtgc/shared";
import { GameCardView } from "./GameCardView";
import { cn } from "@/lib/utils";

const ROWS: BattlefieldRow[] = ["lands", "creatures", "other"];

function byRow(cards: GameCard[], row: BattlefieldRow): GameCard[] {
  return cards.filter((c) => (c.row ?? "other") === row);
}

function handCount(hand: PlayerStateView["zones"]["hand"]): number {
  return Array.isArray(hand) ? hand.length : hand.count;
}

export function OpponentPanel({ player }: { player: PlayerStateView }) {
  const bf = player.zones.battlefield;
  return (
    <div className={cn("rounded-lg border border-border bg-surface/60 p-2 space-y-1", !player.connected && "opacity-60")}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-white truncate">
          {player.username}
          {player.isMonarch && <span className="ml-1 text-amber-400">♛</span>}
        </span>
        <span className="text-muted text-xs">
          ♥ {player.life} · ✋ {handCount(player.zones.hand)} · 📚 {player.zones.library.count}
          {!player.keptHand && (
            <span className="ml-1 text-amber-400" title="Still mulliganing">
              · mull {player.mulligans}
            </span>
          )}
        </span>
      </div>
      <div className="space-y-1">
        {ROWS.map((row) => {
          const cards = byRow(bf, row);
          if (cards.length === 0) return null;
          return (
            <div key={row} className="flex flex-wrap gap-1">
              {cards.map((c) => (
                <GameCardView key={c.instanceId} card={c} zone="battlefield" owned={false} size="sm" />
              ))}
            </div>
          );
        })}
        {bf.length === 0 && <div className="text-[11px] text-muted italic">empty battlefield</div>}
      </div>
      <div className="flex gap-3 text-[11px] text-muted">
        <span>GY {player.zones.graveyard.length}</span>
        <span>EX {player.zones.exile.length}</span>
        <span>CMD {player.zones.command.length}</span>
      </div>
    </div>
  );
}
