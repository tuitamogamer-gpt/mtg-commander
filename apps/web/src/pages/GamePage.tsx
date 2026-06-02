import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { BattlefieldRow, Zone } from "@mtgc/shared";
import { useGame } from "@/store/game";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhaseBar } from "@/components/game/PhaseBar";
import { OpponentPanel } from "@/components/game/OpponentPanel";
import { SelfBoard } from "@/components/game/SelfBoard";
import { LifeTracker } from "@/components/game/LifeTracker";
import { ManaPool } from "@/components/game/ManaPool";
import { MulliganOverlay } from "@/components/game/MulliganOverlay";
import { DisconnectBanner } from "@/components/game/DisconnectBanner";
import { StackZone } from "@/components/game/StackZone";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Mouse drags immediately (small distance); touch waits briefly so a tap or a
  // scroll isn't mistaken for a drag.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

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
    const overId = String(e.over.id);
    // Dropping onto the stack casts the card (hand → shared stack).
    if (overId === "stack") {
      act({ type: "add_to_stack", instanceId });
      return;
    }
    const target = resolveDrop(overId);
    if (!target) return;
    act({
      type: "move_card",
      instanceId,
      to: target.to,
      ...(target.row ? { toRow: target.row } : {}),
    });
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
  const isSpectator = !me;

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
      <header className="border-b border-border bg-surface px-3 py-2 flex items-center gap-3 flex-wrap">
        <PhaseBar state={state} act={act} readOnly={isSpectator} />
        {isSpectator && (
          <span className="rounded bg-accent-2/20 px-2 py-0.5 text-xs text-accent-2 font-medium">
            👁 Spectating
          </span>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="lg:hidden"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          ☰ Panel
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate("/lobby")}>
          Leave
        </Button>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
            <div className="p-2 lg:p-3 lg:shrink-0">
              <StackZone state={state} readOnly={isSpectator} act={act} />
            </div>
            <main className="flex-1 lg:overflow-y-auto p-2 lg:p-3 space-y-3">
              {isSpectator ? (
                // Spectator: every player shown read-only (hands/libraries hidden).
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {state.players.map((p) => (
                    <OpponentPanel key={p.id} player={p} />
                  ))}
                </div>
              ) : (
                <>
                  {/* Opponents */}
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                    {opponents.map((p) => (
                      <OpponentPanel key={p.id} player={p} />
                    ))}
                  </div>

                  {/* Your board */}
                  {me && <SelfBoard player={me} libraryCount={me.zones.library.count} act={act} />}
                </>
              )}
            </main>
          </div>
        </DndContext>

        {/* Mobile drawer backdrop */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-20 bg-black/50" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar (static on desktop, slide-in drawer on mobile) */}
        <aside
          className={cn(
            "flex flex-col min-h-0 bg-surface border-border",
            "fixed inset-y-0 right-0 z-30 w-80 max-w-[85vw] border-l transform transition-transform",
            sidebarOpen ? "translate-x-0" : "translate-x-full",
            "lg:static lg:translate-x-0 lg:max-w-none lg:bg-surface/60"
          )}
        >
          <div className="p-3 space-y-3 overflow-y-auto">
            <div className="flex justify-end lg:hidden">
              <Button size="sm" variant="ghost" onClick={() => setSidebarOpen(false)}>
                ✕ Close
              </Button>
            </div>
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
                  <span className={m.isSpectator ? "text-accent-2" : "text-accent"}>
                    {m.username}
                    {m.isSpectator && " 👁"}:{" "}
                  </span>
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
