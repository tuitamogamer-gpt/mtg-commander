import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { BattlefieldRow, GameAction, Zone } from "@mtgc/shared";
import { useGame } from "@/store/game";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhaseBar } from "@/components/game/PhaseBar";
import { OpponentPanel } from "@/components/game/OpponentPanel";
import { SelfBoard } from "@/components/game/SelfBoard";
import { LifeTracker } from "@/components/game/LifeTracker";
import { ManaPool } from "@/components/game/ManaPool";
import { MulliganOverlay } from "@/components/game/MulliganOverlay";
import { DisconnectBanner } from "@/components/game/DisconnectBanner";

function resolveDrop(overId: string): { to: Zone; row?: BattlefieldRow } | null {
  if (overId.startsWith("bf:")) {
    return { to: "battlefield", row: overId.slice(3) as BattlefieldRow };
  }
  if (["hand", "graveyard", "exile", "command", "library"].includes(overId)) {
    return { to: overId as Zone };
  }
  return null;
}

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { state, chat, error, connected, join, act, sendChat, leave } = useGame();
  const [chatText, setChatText] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (gameId) void join(gameId);
    return () => leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.log, chat]);

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const instanceId = String(e.active.id);
    const target = resolveDrop(String(e.over.id));
    if (!target) return;
    const action: GameAction = {
      type: "move_card",
      instanceId,
      to: target.to,
      ...(target.row ? { toRow: target.row } : {}),
    };
    act(action);
  }

  if (!gameId) return null;

  if (!state) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted">
        <p>{error ?? (connected ? "Loading game…" : "Connecting…")}</p>
        {error && (
          <Button variant="outline" onClick={() => navigate("/lobby")}>
            Back to lobby
          </Button>
        )}
      </div>
    );
  }

  const me = state.players.find((p) => p.id === state.viewerId);
  const opponents = state.players.filter((p) => p.id !== state.viewerId);
  const isHost = state.players[0]?.id === state.viewerId;

  return (
    <div className="h-screen flex flex-col bg-bg">
      {me && !me.keptHand && <MulliganOverlay me={me} players={state.players} act={act} />}
      <DisconnectBanner players={state.players} isHost={isHost} act={act} />
      {!connected && (
        <div className="bg-amber-500/20 border-b border-amber-500 px-4 py-1 text-center text-sm text-amber-200">
          Connection lost — reconnecting…
        </div>
      )}
      {/* Header */}
      <header className="border-b border-border bg-surface px-4 py-2 flex items-center gap-4">
        <PhaseBar state={state} act={act} />
        <Button size="sm" variant="outline" onClick={() => navigate("/lobby")}>
          Leave
        </Button>
      </header>

      <div className="flex-1 flex min-h-0">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <main className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Opponents */}
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${Math.max(1, opponents.length)}, minmax(0, 1fr))` }}
            >
              {opponents.map((p) => (
                <OpponentPanel key={p.id} player={p} />
              ))}
            </div>

            {/* Your board */}
            {me && (
              <SelfBoard player={me} libraryCount={me.zones.library.count} act={act} />
            )}
          </main>
        </DndContext>

        {/* Sidebar */}
        <aside className="w-80 shrink-0 border-l border-border bg-surface/60 flex flex-col min-h-0">
          <div className="p-3 space-y-3 overflow-y-auto">
            <section>
              <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Players</h3>
              <LifeTracker players={state.players} viewerId={state.viewerId} act={act} />
            </section>

            {me && (
              <section>
                <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Your mana</h3>
                <ManaPool pool={me.manaPool} act={act} />
              </section>
            )}

            <section>
              <h3 className="text-xs uppercase tracking-wide text-muted mb-2">
                Stack ({state.stack.length})
              </h3>
              {state.stack.length === 0 ? (
                <p className="text-xs text-muted">Empty</p>
              ) : (
                <div className="space-y-1">
                  {[...state.stack].reverse().map((item, i) => (
                    <div key={item.instanceId + i} className="rounded bg-surface-2 px-2 py-1 text-xs text-white">
                      {item.description}
                    </div>
                  ))}
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => act({ type: "resolve_stack" })}>
                    Resolve top
                  </Button>
                </div>
              )}
            </section>
          </div>

          {/* Log + chat */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-border">
            <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
              {state.log.map((l, i) => (
                <div key={i} className="text-muted">
                  {l.message}
                </div>
              ))}
              {chat.map((m) => (
                <div key={m.id}>
                  <span className="text-accent">{m.username}: </span>
                  <span className="text-white">{m.text}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
            <div className="flex gap-2 p-2 border-t border-border">
              <Input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chatText.trim()) {
                    sendChat(chatText);
                    setChatText("");
                  }
                }}
                placeholder="Say something…"
                className="h-8"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (chatText.trim()) {
                    sendChat(chatText);
                    setChatText("");
                  }
                }}
              >
                Send
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
