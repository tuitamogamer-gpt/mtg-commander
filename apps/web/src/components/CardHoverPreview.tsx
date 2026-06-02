import { useEffect } from "react";
import { useHover } from "@/store/hover";
import { useCards, cardImageLarge } from "@/store/cards";

const W = 280;
const H = 390;
const OFFSET = 24;

/** Single global overlay that shows a large card image near the cursor while
 * hovering (after a short delay). Mounted once at the app root. */
export function CardHoverPreview() {
  const { scryfallId, x, y, hide } = useHover();
  const ensure = useCards((s) => s.ensure);
  const card = useCards((s) => (scryfallId ? s.cards[scryfallId] : undefined));

  useEffect(() => {
    if (scryfallId) void ensure([scryfallId]);
  }, [scryfallId, ensure]);

  useEffect(() => {
    if (!scryfallId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scryfallId, hide]);

  if (!scryfallId) return null;
  const img = cardImageLarge(card);
  if (!img) return null;

  // Prefer the right of the cursor; flip left if it would overflow. Clamp vertically.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = x + OFFSET + W > vw ? Math.max(8, x - OFFSET - W) : x + OFFSET;
  const top = Math.min(Math.max(8, y - H / 2), vh - H - 8);

  return (
    <div
      className="pointer-events-none fixed z-[100] rounded-xl shadow-2xl ring-1 ring-black/40"
      style={{ left, top, width: W, height: H }}
    >
      <img src={img} alt="" className="h-full w-full rounded-xl object-cover" />
    </div>
  );
}
