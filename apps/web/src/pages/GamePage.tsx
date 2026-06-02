import { useParams } from "react-router-dom";

export function GamePage() {
  const { gameId } = useParams();
  return (
    <div className="min-h-screen flex items-center justify-center text-muted">
      <p>Game {gameId} — table built in Faza 9.</p>
    </div>
  );
}
