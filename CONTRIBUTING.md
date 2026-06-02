# Contributing

Thanks for hacking on the MTG Commander client! This is a hobby project — keep it
friendly and pragmatic.

## Dev setup

```bash
pnpm install
pnpm db:migrate          # create the SQLite dev DB
pnpm db:seed:precons     # ~181 Commander precons from MTGJSON (~1 min)
pnpm dev                 # server :4000 + web :5173
```

Requires Node 20+, pnpm, and `curl` on PATH (used for Cloudflare-fronted
upstreams). See [README](README.md) for details and [ARCHITECTURE](ARCHITECTURE.md)
for the layout.

## Workflow

1. Branch off `main`.
2. Make your change. Keep commits focused and messages descriptive.
3. Before pushing:
   ```bash
   pnpm lint     # typecheck all packages
   pnpm test     # server (Vitest) + web (Vitest/RTL)
   pnpm build    # full production build
   ```
   CI (`.github/workflows/ci.yml`) runs the same plus Playwright e2e.
4. Open a PR. Describe what changed and how you verified it.

## Code style

- **TypeScript everywhere**, `strict` on. No `any` unless truly unavoidable.
- Shared types live in `packages/shared` — if the client and server both need a
  shape, define it there, don't duplicate.
- Match the surrounding code's style (it's Prettier-ish: 2-space, double quotes,
  semicolons). Keep comments about the *why*, not the *what*.
- New game actions: add to the `GameAction` union in `shared/src/game.ts`, handle
  in `server/src/game/actions.ts`, and cover with a case in
  `server/test/game-engine.test.ts`.
- New REST endpoints: add a route module under `server/src/routes`, register it in
  `routes/index.ts`, and add a Vitest spec.

## Tests

- Backend uses Fastify `inject` + a disposable SQLite DB (see
  `server/test/global-setup.ts`); external network is mocked.
- Aim to keep server coverage ≥ 70% (`pnpm --filter @mtgc/server test:cov`).
- Frontend: pure-logic units + component smoke tests with React Testing Library.

## Scope guardrails

This client is **honor-system** by design — no rules enforcement, no AI opponent.
PRs that try to add a full rules engine are out of scope; smaller quality-of-life
and UX improvements are very welcome.
