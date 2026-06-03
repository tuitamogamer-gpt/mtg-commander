import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/store/auth";

const FEATURES = [
  { icon: "🃏", title: "Bring any deck", body: "Import from Moxfield, paste a decklist, build from scratch, or clone an official Commander precon." },
  { icon: "👥", title: "2–4 player pods", body: "Create a table, share it, and play on a shared virtual battlefield with spectators welcome." },
  { icon: "🎴", title: "Honor-system play", body: "Drag cards, tap, cast to the stack, track commander damage — you control your own cards, no rules nanny." },
];

export function LandingPage() {
  const user = useAuth((s) => s.user);
  return (
    <div className="flex flex-col items-center text-center gap-10 py-14">
      <div className="flex flex-col items-center gap-5">
        <span className="rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted">
          Online Commander · 2–4 players · honor system
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold max-w-2xl tracking-tight">
          Play{" "}
          <span className="bg-gradient-to-r from-accent to-amber-300 bg-clip-text text-transparent">
            Commander
          </span>{" "}
          online with your pod
        </h1>
        <p className="text-muted max-w-xl text-lg">
          Import decks from Moxfield or pick any official Commander precon, gather your playgroup,
          and battle on a shared virtual table.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          {user ? (
            <>
              <Link to="/lobby">
                <Button size="lg">Find a table</Button>
              </Link>
              <Link to="/decks">
                <Button size="lg" variant="outline">My decks</Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/register">
                <Button size="lg">Get started — it's free</Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">Log in</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 w-full max-w-4xl text-left">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-border bg-surface/70 p-5 transition-transform hover:-translate-y-1"
          >
            <div className="text-2xl">{f.icon}</div>
            <div className="mt-2 font-semibold text-white">{f.title}</div>
            <p className="mt-1 text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
