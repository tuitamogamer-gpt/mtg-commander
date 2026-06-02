import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { useHover } from "@/store/hover";

const DELAY_MS = 500;

/**
 * Bind a card element to the global zoom preview. Returns mouse handlers; spread
 * them on the card. Passing a falsy id (e.g. a face-down card) disables preview.
 */
export function useCardHover(scryfallId?: string | null) {
  const show = useHover((s) => s.show);
  const move = useHover((s) => s.move);
  const hide = useHover((s) => s.hide);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up on unmount so a removed card never leaves a stuck preview.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      hide();
    };
  }, [hide]);

  if (!scryfallId) return {};

  const onMouseEnter = (e: MouseEvent) => {
    const { clientX, clientY } = e;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => show(scryfallId, clientX, clientY), DELAY_MS);
  };
  const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
  const onMouseLeave = () => {
    if (timer.current) clearTimeout(timer.current);
    hide();
  };

  return { onMouseEnter, onMouseMove, onMouseLeave };
}
