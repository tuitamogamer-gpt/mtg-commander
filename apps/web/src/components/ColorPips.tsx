import { colorPips } from "@/lib/decks";
import { cn } from "@/lib/utils";

export function ColorPips({ identity }: { identity: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {colorPips(identity).map((pip, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
            pip.className
          )}
          title={pip.label}
        >
          {pip.label}
        </span>
      ))}
    </div>
  );
}
