# Testing

How the project is tested, and which file covers what — so future work knows
what's already guarded.

## Commands

```bash
pnpm lint                 # typecheck all packages (0 errors)
pnpm test                 # server (Vitest) + web (Vitest/RTL) — all unit/integration
pnpm --filter @mtgc/server test:cov   # server coverage (~82%+)
pnpm test:e2e             # Playwright browser e2e (needs: pnpm test:e2e:install)
pnpm build                # full production build (shared → server → web)
```

CI (`.github/workflows/ci.yml`) runs lint + test + build, plus a separate
Playwright e2e job.

## Backend (Vitest + Fastify `inject`, disposable SQLite)

| File | Scenarios |
| --- | --- |
| `test/auth.test.ts` | register with email (201 + cookie), short-password / invalid-email 400, duplicate username / duplicate email 409, `/me` with/without/garbage cookie, **login by username or email**, wrong-password 401, logout |
| `test/decks.test.ts` | auth required; create + computed color identity; invalid 400; full CRUD; cross-user 404; validate (count/commander); **color-identity violation flagged**; **singleton exemption for basics + "any number" cards** |
| `test/precons.test.ts` | list; filter by set; **color-identity subset filter**; name search; clone to deck; unknown 404 |
| `test/cards.test.ts` | cached-card no network; fetch+cache; 404; search proxy; empty query; batch validation; **resolve-by-name (text import)** |
| `test/moxfield.test.ts` | id/URL parse; v3 board parse (commander vs mainboard); friendly failure (network mocked) |
| `test/game-engine.test.ts` | opening hand + command zone; per-viewer + spectator redaction; draw/mill/shuffle; move + battlefield-state reset; untap-all; life/commander-damage/poison; mana + player counters; monarch/initiative; **London mulligan + keep/bottom**; **stack cast + resolve to owner**; **scry arrange + reveal**; token create + vanish; phase/turn skip; annotate/flip/reveal/concede; **commander starts in command zone**; **commander tax per cast**; **return to command zone**; **elimination at 21 cmd damage / 0 life / 10 poison** |
| `test/lobby.test.ts` | unauthenticated socket rejected; create→join→ready→start; non-host start blocked |
| `test/game-socket.test.ts` | seated join + redacted view; spectator join allowed but actions rejected; peek; action reflected; **undo restores pre-action library count** |
| `test/health.test.ts` | health reports DB ok; `/api/metrics` shape |
| `test/consolidated-e2e.test.ts` | **full lifecycle** over real sockets: auth → commander decks → lobby (+spectator) → start → mulligan keep → cast commander (tax/timesCast) → token create → undo (token gone) → scry 3 → 21 commander damage → end game (winner) → match in history; spectator sees hidden hands |

## Frontend (Vitest + React Testing Library + jsdom)

| File | Scenarios |
| --- | --- |
| `test/lib.test.ts` | `buildScryfallQuery`, `colorPips`, `deckCardCount`, `cn` |
| `test/components.test.tsx` | Button variants, ColorPips, AuthForm renders (login/register) |
| `test/tokens.test.ts` | token presets include the common set with correct P/T; creature vs other row |

## E2E (Playwright, `e2e/happy-path.spec.ts`)

Two browser contexts: register → import precon → create lobby → join as a second
player → ready → start → keep hand → draw → next turn. Requires
`pnpm db:seed:precons` first (the import step needs precon data) and
`pnpm test:e2e:install` for the Chromium binary. Runs headless in CI.

## MTG-specific coverage map (per the v0.2.0 follow-up)

- **Commander in command zone at start** — `game-engine.test.ts`, `consolidated-e2e.test.ts`
- **Cast commander from command** — `game-engine.test.ts`, `consolidated-e2e.test.ts`
- **Commander tax (+2 per prior cast)** — `game-engine.test.ts` ("applies commander tax"), `consolidated-e2e.test.ts`
- **Commander returns to command zone** — `game-engine.test.ts` ("returns a commander…")
- **Commander damage 21+ = loss** — `game-engine.test.ts`, `consolidated-e2e.test.ts` (+ in-game banner via shared `isEliminated`)
- **Color-identity deck validation** — `decks.test.ts` ("flags cards outside…")
- **Singleton rule + exceptions** — `decks.test.ts` ("exempts basic lands and 'any number'…")
- **Token presets P/T + type** — `tokens.test.ts`
- **Token create / count / vanish** — `game-engine.test.ts` (create + vanish), `TokenCreator` count UI, `consolidated-e2e.test.ts`
- **Token visual indicator** — `GameCardView` (dashed border + TOKEN strip)

## Setup verification (manual / CI)

`pnpm install` → `pnpm db:migrate` → `pnpm db:seed:precons` → `pnpm dev` (both
servers respond: `GET /api/health` 200, web at `/`) → `pnpm build` → `pnpm test`
→ `pnpm lint`. The CI workflow exercises install/generate/migrate/seed/build/test.
