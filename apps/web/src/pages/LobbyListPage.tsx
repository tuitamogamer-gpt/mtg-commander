import { Card, CardContent } from "@/components/ui/Card";

export function LobbyListPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Lobbies</h1>
      <Card>
        <CardContent>
          <p className="text-muted text-sm">Room list + create/join wired up in Faza 8.</p>
        </CardContent>
      </Card>
    </div>
  );
}
