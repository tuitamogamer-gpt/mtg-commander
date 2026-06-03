import { useEffect } from "react";
import { useHover } from "@/store/hover";
import { useCards, cardImageLarge } from "@/store/cards";

const W = 240;
const H = 336;
const MARGIN = 12;

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

  // Pin to the screen edge OPPOSITE the cursor so the preview never covers the
  // card you're hovering (and its action toolbar / context menu stay visible).
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = x < vw / 2 ? vw - W - MARGIN : MARGIN;
  const top = Math.min(Math.max(MARGIN, y - H / 2), vh - H - MARGIN);

  return (
    <div
      className="pointer-events-none fixed z-[100] rounded-xl shadow-2xl ring-1 ring-black/40"
      style={{ left, top, width: W, height: H }}
    >
      <img src={img} alt="" className="h-full w-full rounded-xl object-cover" />
    </div>
  );
}
