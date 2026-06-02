import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/Card";

export function LobbyRoomPage() {
  const { roomId } = useParams();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Room {roomId}</h1>
      <Card>
        <CardContent>
          <p className="text-muted text-sm">
            Seats, deck selection, ready/start wired up in Faza 8.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
