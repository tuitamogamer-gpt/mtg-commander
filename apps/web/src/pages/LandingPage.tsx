import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function LandingPage() {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-16">
      <h1 className="text-4xl font-bold text-white max-w-2xl">
        Play <span className="text-accent">Commander</span> online with your pod
      </h1>
      <p className="text-muted max-w-xl">
        Import decks from Moxfield or pick any official Commander precon, gather 2–4 players in a
        room, and play on a shared virtual table. Honor-system rules — you control your own cards.
      </p>
      <div className="flex gap-3">
        <Link to="/lobby">
          <Button size="lg">Browse Lobbies</Button>
        </Link>
        <Link to="/decks">
          <Button size="lg" variant="outline">
            My Decks
          </Button>
        </Link>
      </div>
    </div>
  );
}
