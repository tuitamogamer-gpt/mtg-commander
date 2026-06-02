import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLobby } from "@/store/lobby";

export function LobbyListPage() {
  const navigate = useNavigate();
  const { connected, rooms, init, refreshRooms, createRoom, joinRoom } = useLobby();

  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [startingLife, setStartingLife] = useState(40);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    init();
    refreshRooms();
  }, [init, refreshRooms]);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom(name, maxPlayers, { startingLife });
      navigate(`/lobby/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(roomId: string) {
    setError(null);
    try {
      await joinRoom(roomId);
      navigate(`/lobby/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Lobbies</h1>
        <span className={connected ? "text-success text-sm" : "text-muted text-sm"}>
          {connected ? "● Connected" : "○ Connecting…"}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a table</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="text-sm text-muted">Table name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Pod" />
            </div>
            <div>
              <label className="text-sm text-muted">Max players</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-white"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              >
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} players
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted">Starting life</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-white"
                value={startingLife}
                onChange={(e) => setStartingLife(Number(e.target.value))}
              >
                {[40, 30, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} life
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={onCreate} disabled={busy}>
            {busy ? "Creating…" : "Create table"}
          </Button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Open tables</h2>
          <Button size="sm" variant="ghost" onClick={refreshRooms}>
            Refresh
          </Button>
        </div>
        {rooms.length === 0 ? (
          <p className="text-muted text-sm">No open tables. Create one above.</p>
        ) : (
          <div className="grid gap-2">
            {rooms.map((room) => (
              <Card key={room.id}>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{room.name}</div>
                    <div className="text-sm text-muted">
                      Host {room.hostUsername} · {room.playerCount}/{room.maxPlayers} ·{" "}
                      <span className={room.status === "waiting" ? "text-success" : "text-accent"}>
                        {room.status === "waiting" ? "Waiting" : "In game"}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={room.status !== "waiting" || room.playerCount >= room.maxPlayers}
                    onClick={() => onJoin(room.id)}
                  >
                    Join
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
