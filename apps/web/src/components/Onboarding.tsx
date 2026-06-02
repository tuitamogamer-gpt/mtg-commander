import { useState } from "react";
import { Button } from "@/components/ui/Button";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Welcome to MTG Commander 👋",
    body: "Play Commander online with your pod, 2–4 players. Here's the 30-second tour.",
  },
  {
    title: "1. Get a deck",
    body: "Go to Decks → import from Moxfield by URL, build one from scratch, or clone an official precon from the Precon Library.",
  },
  {
    title: "2. Make a table",
    body: "Open the Lobby, create a table (2–4 seats, starting life, spectators), and share it with friends — or join an open one.",
  },
  {
    title: "3. Ready up & start",
    body: "Everyone picks a deck and readies up; the host starts the game. You'll go through a London mulligan first.",
  },
  {
    title: "4. Play — honor system",
    body: "Drag cards between zones, tap, add counters, cast to the stack. There's no rules enforcement — you control your own cards. Press the ☰ panel for life, mana, log and chat; hover a card to zoom.",
  },
];

const KEY = "mtgc-onboarded";

/** One-time walkthrough shown to a freshly logged-in user. */
export function Onboarding() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "1";
    } catch {
      return false;
    }
  });
  const [step, setStep] = useState(0);

  function finish() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-label="Getting started" className="w-full max-w-md rounded-lg border border-border bg-surface p-5 space-y-4">
        <h2 className="text-lg font-bold text-white">{s.title}</h2>
        <p className="text-sm text-muted">{s.body}</p>
        <div className="flex items-center justify-center gap-1">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i === step ? "bg-accent" : "bg-surface-2"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setStep((x) => x - 1)}>
                Back
              </Button>
            )}
            {last ? (
              <Button size="sm" onClick={finish}>
                Get started
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((x) => x + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
