import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Deck } from "@mtgc/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLobby } from "@/store/lobby";
import { useAuth } from "@/store/auth";
import { decksApi } from "@/lib/decks";
import { cn } from "@/lib/utils";

export function LobbyRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const {
    room,
    chat,
    startedGameId,
    init,
    joinRoom,
    leaveRoom,
    setDeck,
    setReady,
    startGame,
    sendChat,
    clearStarted,
  } = useLobby();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Connect + ensure we're joined to this room.
  useEffect(() => {
    init();
    if (roomId && (!room || room.id !== roomId)) {
      joinRoom(roomId).catch((e) => setError(e.message));
    }
  }, [roomId, room, init, joinRoom]);

  // Load the user's decks for the picker.
  useEffect(() => {
    void decksApi.list().then(setDecks);
  }, []);

  // Navigate to the table when the host starts the game.
  useEffect(() => {
    if (startedGameId) {
      const id = startedGameId;
      clearStarted();
      navigate(`/game/${id}`);
    }
  }, [startedGameId, clearStarted, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  if (!roomId) return null;
  const me = room?.players.find((p) => p.id === user?.id);
  const isHost = room?.hostId === user?.id;
  const startBlocker =
    !room || room.players.length < 2
      ? "Need at least 2 players"
      : room.players.some((p) => !p.deckId)
        ? "All players must pick a deck"
        : room.players.some((p) => !p.ready)
          ? "All players must be ready"
          : null;

  function onLeave() {
    leaveRoom(roomId!);
    navigate("/lobby");
  }

  async function onStart() {
    setError(null);
    try {
      await startGame(roomId!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    }
  }

  function onSendChat() {
    if (!chatText.trim()) return;
    sendChat(roomId!, chatText);
    setChatText("");
  }

  if (!room) {
    return <p className="text-muted py-10">{error ?? "Joining room…"}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{room.name}</h1>
          <p className="text-sm text-muted">
            {room.players.length}/{room.maxPlayers} players · {room.settings.startingLife} life ·
            mulligan: {room.settings.mulligan}
          </p>
        </div>
        <Button variant="outline" onClick={onLeave}>
          Leave
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Seats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {room.players.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between rounded-md border border-border px-3 py-2",
                    p.ready ? "bg-success/10" : "bg-surface-2"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{p.username}</span>
                    {p.isHost && <span className="text-xs text-accent">HOST</span>}
                    {p.id === user?.id && <span className="text-xs text-muted">(you)</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted">{p.deckName ?? "No deck"}</span>
                    <span className={p.ready ? "text-success text-sm" : "text-muted text-sm"}>
                      {p.ready ? "✓ Ready" : "Not ready"}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your deck</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {decks.length === 0 ? (
                <p className="text-sm text-muted">
                  You have no decks.{" "}
                  <button className="text-accent underline" onClick={() => navigate("/decks")}>
                    Import one
                  </button>{" "}
                  first.
                </p>
              ) : (
                <select
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-white"
                  value={me?.deckId ?? ""}
                  onChange={(e) => setDeck(roomId, e.target.value).catch((x) => setError(x.message))}
                >
                  <option value="" disabled>
                    Select a deck…
                  </option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.commander ? ` — ${d.commander}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant={me?.ready ? "secondary" : "primary"}
                  disabled={!me?.deckId}
                  onClick={() => setReady(roomId, !me?.ready).catch((x) => setError(x.message))}
                >
                  {me?.ready ? "Unready" : "Ready up"}
                </Button>
                {isHost && (
                  <Button onClick={onStart} disabled={!!startBlocker} title={startBlocker ?? ""}>
                    Start game
                  </Button>
                )}
              </div>
              {isHost && startBlocker && <p className="text-xs text-muted">{startBlocker}</p>}
              {error && <p className="text-sm text-danger">{error}</p>}
            </CardContent>
          </Card>
        </div>

        <Card className="flex flex-col h-[28rem]">
          <CardHeader>
            <CardTitle>Table chat</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-2 min-h-0">
            <div className="flex-1 overflow-y-auto space-y-1 text-sm">
              {chat.length === 0 ? (
                <p className="text-muted">No messages yet.</p>
              ) : (
                chat.map((m) => (
                  <div key={m.id}>
                    <span className="text-accent">{m.username}: </span>
                    <span className="text-white">{m.text}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <Input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSendChat()}
                placeholder="Message…"
              />
              <Button size="sm" onClick={onSendChat}>
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
