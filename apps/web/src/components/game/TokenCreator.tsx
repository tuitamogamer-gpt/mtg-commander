import { useState } from "react";
import { motion } from "framer-motion";
import type { GameAction } from "@mtgc/shared";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Props {
  act: (a: GameAction) => void;
  onClose: () => void;
}

// Common token presets. `id` is a synthetic scryfall id — tokens render by name
// (no art lookup needed) which keeps token creation offline and instant.
// Common tokens with correct P/T / type. `id` is synthetic — tokens render by
// name (no art lookup) which keeps creation offline and instant.
export const PRESETS: { name: string; row: "creatures" | "other" }[] = [
  { name: "Soldier 1/1 W", row: "creatures" },
  { name: "Goblin 1/1 R", row: "creatures" },
  { name: "Spirit 1/1 W Flying", row: "creatures" },
  { name: "Saproling 1/1 G", row: "creatures" },
  { name: "Zombie 2/2 B", row: "creatures" },
  { name: "Beast 3/3 G", row: "creatures" },
  { name: "Treasure", row: "other" },
  { name: "Clue", row: "other" },
  { name: "Food", row: "other" },
  { name: "Map", row: "other" },
];

let tokenSeq = 0;

export function TokenCreator({ act, onClose }: Props) {
  const [name, setName] = useState("");
  const [power, setPower] = useState("");
  const [toughness, setToughness] = useState("");
  const [count, setCount] = useState(1);

  function create(displayName: string, row: "creatures" | "other") {
    const n = Math.max(1, Math.min(99, count));
    for (let i = 0; i < n; i++) {
      act({ type: "create_token", scryfallId: `token:${displayName}:${tokenSeq++}`, name: displayName, row });
    }
  }

  function createCustom() {
    const pt = power && toughness ? ` ${power}/${toughness}` : "";
    const display = `${name.trim() || "Token"}${pt}`;
    create(display, power && toughness ? "creatures" : "other");
    onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Create token"
        className="w-full max-w-lg rounded-lg border border-border bg-surface p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Create token</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          Copies
          <input
            type="number"
            min={1}
            max={99}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            className="h-9 w-16 rounded-md border border-border bg-surface px-2 text-center text-sm text-white"
          />
        </label>

        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-2">Common</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  create(p.name, p.row);
                  onClose();
                }}
                className="rounded border border-border bg-surface-2 px-2 py-1 text-xs text-white hover:border-accent"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <div className="text-xs uppercase tracking-wide text-muted">Custom</div>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" />
            <input
              value={power}
              onChange={(e) => setPower(e.target.value)}
              placeholder="P"
              className="h-10 w-12 rounded-md border border-border bg-surface px-2 text-center text-sm text-white"
            />
            <input
              value={toughness}
              onChange={(e) => setToughness(e.target.value)}
              placeholder="T"
              className="h-10 w-12 rounded-md border border-border bg-surface px-2 text-center text-sm text-white"
            />
            <Button onClick={createCustom}>Create</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
