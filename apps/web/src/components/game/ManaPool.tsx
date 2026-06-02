import type { GameAction, ManaPool as Pool } from "@mtgc/shared";
import { cn } from "@/lib/utils";

const COLORS: { key: keyof Pool; label: string; className: string }[] = [
  { key: "W", label: "W", className: "bg-amber-100 text-black" },
  { key: "U", label: "U", className: "bg-sky-400 text-black" },
  { key: "B", label: "B", className: "bg-zinc-700 text-white" },
  { key: "R", label: "R", className: "bg-red-500 text-white" },
  { key: "G", label: "G", className: "bg-green-500 text-black" },
  { key: "C", label: "C", className: "bg-zinc-400 text-black" },
];

export function ManaPool({ pool, act }: { pool: Pool; act: (a: GameAction) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLORS.map((c) => (
        <div key={c.key} className="flex items-center gap-0.5">
          <button
            className={cn("h-6 w-6 rounded-full text-xs font-bold", c.className)}
            onClick={() => act({ type: "set_mana", color: c.key, amount: pool[c.key] + 1 })}
            title={`Add ${c.label}`}
          >
            {c.label}
          </button>
          <span className="w-4 text-center text-sm tabular-nums text-white">{pool[c.key]}</span>
          <button
            className="text-muted hover:text-white text-xs px-0.5"
            onClick={() => act({ type: "set_mana", color: c.key, amount: Math.max(0, pool[c.key] - 1) })}
            title={`Remove ${c.label}`}
          >
            −
          </button>
        </div>
      ))}
      <button
        className="ml-1 text-xs text-muted hover:text-white underline"
        onClick={() => act({ type: "empty_mana" })}
      >
        empty
      </button>
    </div>
  );
}
