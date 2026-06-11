// Polling-based realtime. Stores register a "stopper" (cancel intervals + clear
// state); resetRealtime() runs them all — called on login/register/logout so no
// polling loop survives an identity switch.

const stoppers = new Set<() => void>();

export function registerRealtimeStopper(fn: () => void): void {
  stoppers.add(fn);
}

export function resetRealtime(): void {
  for (const fn of stoppers) fn();
}

/** setInterval that also fires immediately; returns a cancel function. */
export function pollEvery(ms: number, tick: () => void): () => void {
  tick();
  const id = setInterval(tick, ms);
  return () => clearInterval(id);
}
