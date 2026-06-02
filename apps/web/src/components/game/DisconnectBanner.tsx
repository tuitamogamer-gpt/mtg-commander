import { useEffect, useState } from "react";
import type { GameAction, PlayerStateView } from "@mtgc/shared";
import { Button } from "@/components/ui/Button";

const GRACE_MS = 5 * 60 * 1000;

interface Props {
  players: PlayerStateView[];
  /** Whether the viewer is the host (first seat) — only the host sees skip controls. */
  isHost: boolean;
  act: (a: GameAction) => void;
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Banner shown while any seated player is disconnected, with a reconnect
 * countdown and (for the host) a button to skip the player's turns. */
export function DisconnectBanner({ players, isHost, act }: Props) {
  const [now, setNow] = useState(Date.now());
  const dropped = players.filter((p) => !p.connected && !p.skipped && p.disconnectedAt);
  const skipped = players.filter((p) => p.skipped);

  useEffect(() => {
    if (dropped.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [dropped.length]);

  if (dropped.length === 0 && skipped.length === 0) return null;

  return (
    <div className="bg-danger/20 border-b border-danger px-4 py-2 flex flex-col gap-1">
      {skipped.map((p) => (
        <div key={p.id} className="flex items-center justify-between text-sm">
          <span className="text-muted">
            <span className="font-semibold text-white">{p.username}</span> is skipped
            {p.connected ? " (reconnected)" : ""}.
          </span>
          {isHost && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => act({ type: "set_skipped", playerId: p.id, skipped: false })}
            >
              Restore to turn order
            </Button>
          )}
        </div>
      ))}
      {dropped.map((p) => {
        const remaining = (p.disconnectedAt ?? now) + GRACE_MS - now;
        return (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span className="text-white">
              <span className="font-semibold">{p.username}</span> disconnected — waiting to
              reconnect ({fmt(remaining)})
            </span>
            {isHost && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => act({ type: "set_skipped", playerId: p.id, skipped: true })}
              >
                Skip their turns
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
