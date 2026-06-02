# MTG Commander — online multiplayer client

A full-stack web app for playing the **Magic: The Gathering Commander** format
online with 2–4 players. Import decks from **Moxfield** or pick any official
**Commander precon**, gather a pod in a lobby, and play on a shared virtual table.

Rules are **honor-system** (like Cockatrice / Untap.in): the server is
authoritative over state and hidden information, but it does **not** enforce MTG
rules — players move their own cards freely. No AI opponent, no rules engine.

---

## Tech stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Monorepo   | pnpm workspaces (`apps/web`, `apps/server`, `packages/shared`)    |
| Frontend   | React 18 · Vite 6 · TypeScript · Tailwind v4 · React Router · Zustand · dnd-kit |
| Backend    | Node 20+ · Fastify 5 · Socket.IO · Prisma · SQLite (Postgres-ready) |
| Auth       | JWT in an httpOnly cookie · bcrypt                                |
| Realtime   | Socket.IO namespaces `/lobby` and `/game`                         |
| Card data  | Scryfall (cards) · Moxfield (deck import) · MTGJSON (precons)      |

`packages/shared` holds all cross-cutting TypeScript contracts (card/deck/game/
lobby models, the `GameAction` union, and the Socket.IO event maps), imported by
both apps so the wire protocol is typed end-to-end.

---

## Prerequisites

- **Node 20+** (developed on Node 24)
- **pnpm** — `npm install -g pnpm` (or `corepack enable pnpm`)
- **curl** on `PATH` — bundled with Windows 10+/macOS/Linux. The server shells out
  to it for Moxfield/MTGJSON, whose Cloudflare blocks Node's `fetch` by TLS
  fingerprint. (There is an undici `fetch` fallback, but curl is strongly
  preferred.)

---

## Setup

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Create the server env file. A random JWT secret is generated on first run,
#    but you can copy the example and set your own:
#      apps/server/.env.example  ->  apps/server/.env

# 3. Create the SQLite database + run migrations
pnpm db:migrate            # prisma migrate dev

# 4. Seed the precon library from MTGJSON (~181 Commander decks, ~1 min)
pnpm db:seed:precons

# 5. Run both apps (server on :4000, web on :5173)
pnpm dev
```

Then open **http://localhost:5173**. Register two accounts (e.g. in a normal
window and an incognito window), import/clone a deck for each, create a table,
join with the second account, ready up, and start the game.

### Useful scripts (run from the repo root)

| Script                    | What it does                                  |
| ------------------------- | --------------------------------------------- |
| `pnpm dev`                | Server + web together (concurrently)          |
| `pnpm dev:server`         | Backend only (`tsx watch`)                    |
| `pnpm dev:web`            | Frontend only (Vite)                          |
| `pnpm build`              | Type-build shared → server → web              |
| `pnpm db:migrate`         | Prisma migrate dev                            |
| `pnpm db:seed:precons`    | Download + seed all Commander precons         |
| `pnpm --filter @mtgc/server db:studio` | Browse the DB in Prisma Studio   |

> The `.env`, `*.db`, and `node_modules` are gitignored. After cloning fresh,
> you must re-run steps 3–4 (the database is not committed).

---

## Architecture

```
mtg-commander/
├─ packages/shared/          # TS contracts shared by web + server
│  └─ src/{cards,decks,auth,game,lobby,socket}.ts
├─ apps/server/
│  ├─ prisma/schema.prisma   # User, Deck, PreconDeck, Card (cache), Game (snapshot)
│  ├─ scripts/seed-precons.ts
│  └─ src/
│     ├─ app.ts / index.ts   # Fastify build + HTTP/Socket.IO listener
│     ├─ auth/               # JWT sign/verify, requireAuth hook
│     ├─ routes/             # auth, cards, decks, precons
│     ├─ services/           # scryfall (cache), moxfield, deck, http (curl)
│     ├─ game/               # state builder, action engine, GameManager
│     └─ sockets/            # auth middleware, rooms, lobby ns, game ns
└─ apps/web/
   └─ src/
      ├─ pages/              # Landing, Login/Register, Lobby list/room, Decks, Precons, Game
      ├─ components/         # UI primitives + game/* (board, cards, trackers)
      ├─ store/              # zustand: auth, lobby, game, cards
      └─ lib/                # api client, socket client, helpers
```

### Request flow

- The Vite dev server proxies `/api/*` and `/socket.io` to the backend on `:4000`,
  so the browser is always same-origin and the httpOnly JWT cookie is first-party.
- Socket.IO connections authenticate from that same cookie in the handshake.

### Game model (honor system)

- The authoritative `GameState` lives in memory in `GameManager` and is
  snapshotted (debounced) to the `Game` table for reconnect/restart recovery.
- Each client receives a **redacted** `GameStateView`: it sees its own hand and
  all public zones; other players' hands are counts only and every library is
  hidden.
- Clients send a `GameAction` (a discriminated union) over `game:action`; the
  server applies it (`game/actions.ts`), bumps a version, appends to the log, and
  rebroadcasts each player their own view. The server does **not** referee rules.

---

## What works today

- **Auth** — register / login / me / logout with a JWT httpOnly cookie.
- **Card proxy** — `GET /api/cards/:id` and `POST /api/cards/batch` with a 30-day
  Scryfall cache; serves stale on upstream failure.
- **Decks** — full CRUD, Commander-legality validation (advisory), color-identity
  computation, **Moxfield import** by URL/id.
- **Precon library** — all Commander precons seeded from MTGJSON; browse with
  search + color-identity + set filters; one-click clone into your decks.
- **Lobby** — Socket.IO rooms: create/join/leave, deck selection, ready-up,
  host-only start (2–4 players), table chat.
- **Game (vertical slice)** — server-authoritative, synced table for 2–4 players:
  - drag-and-drop between battlefield rows (lands/creatures/other), hand,
    graveyard, exile, command;
  - click to tap/untap, hover toolbar (+1/+1, −1/−1, to GY/exile, flip face-down);
  - life tracker + Commander-damage matrix, poison, mana pool;
  - draw / mill / shuffle / London mulligan, create token, custom counters;
  - phase + turn indicator with pass-priority / next-phase / next-turn;
  - stack visualization, game log, in-game chat;
  - hidden hands/libraries enforced per viewer; reconnect-safe snapshots.

---

## What remains (next iterations)

These are deliberately deferred — the slice above is fully playable without them:

- **Mulligan flow UI** — the London mulligan action exists; a guided
  "keep N / bottom cards" wizard at game start does not.
- **Reconnect UX** — snapshots persist and `game:join` reloads state, but there is
  no automatic resume banner / spectator-to-seat handoff on the client yet.
- **Spectator mode** — joining a game you're not seated in.
- **Stack as a real zone** — currently the stack is a visual list of descriptions;
  cards aren't physically moved onto it.
- **Scry / surveil / "look at top N"** — `scry` is a no-op placeholder; library
  contents are hidden, so a reveal-to-self flow is needed.
- **Deck builder / editor UI** — decks are import-only; no manual card editing yet.
- **Richer card interactions** — card preview on hover/zoom, double-faced flip,
  attach/aura grouping, multi-select drag.
- **Mobile/responsive layout** — desktop-first today.
- **Production deployment** — dev setup only (swap SQLite → Postgres via the
  Prisma datasource, set real `JWT_SECRET`, build + serve `apps/web/dist`).
- **No rules enforcement by design** — layers, replacement effects, triggers, and
  combat math remain the players' responsibility (honor system).

---

## Deployment

A `docker-compose.yml` brings up Postgres + the API server + an nginx-served web
build. The server image runs Prisma against Postgres (via `prisma/postgres.prisma`,
synced with `prisma db push`); nginx serves the SPA and reverse-proxies `/api`
and `/socket.io` to the server so the browser stays same-origin.

```bash
cp .env.example .env          # set JWT_SECRET and a POSTGRES_PASSWORD
docker compose up --build     # web → http://localhost:8080
docker compose exec server pnpm seed:precons   # one-time precon seed
```

Environment variables (`.env`): `POSTGRES_USER/PASSWORD/DB`, `JWT_SECRET`
(required), `CLIENT_ORIGIN` (browser origin, for CORS + cookie), `COOKIE_DOMAIN`
(optional, for cross-subdomain auth), `WEB_PORT`.

**Health check:** `GET /api/health` returns `{ status: "ok", … }` for uptime
monitors / container healthchecks.

**Postgres vs SQLite:** dev uses SQLite (`prisma/schema.prisma`); production uses
the mirrored `prisma/postgres.prisma`. Keep the two model blocks in sync. Because
the providers differ, production uses `prisma db push` (schema sync) rather than
the SQLite migration history.

### Other hosts

- **Fly.io** — `fly launch` for the server (set `JWT_SECRET`, `DATABASE_URL`,
  `CLIENT_ORIGIN` as secrets; attach Fly Postgres), and deploy the web image
  separately or point a static host at `apps/web/dist`. Set `CLIENT_ORIGIN` to
  the web origin and `COOKIE_DOMAIN` if sharing a parent domain.
- **Railway** — one service from `apps/server/Dockerfile` + a Railway Postgres
  plugin (injects `DATABASE_URL`); a second service from `apps/web/Dockerfile`
  (or any static host for `apps/web/dist`).

> Note: the Docker/compose setup is provided as a starting point and was authored
> but not run in the build environment — expect to tune resource limits, TLS
> termination, and the run-via-`tsx` server entry (swap to a compiled/bundled
> start for a leaner image) for a real production deployment.

---

## External data & attribution

- **Scryfall** — card data and images (no auth required). Please respect their
  [API guidelines](https://scryfall.com/docs/api).
- **Moxfield** — public deck import via their public API.
- **MTGJSON** — precon decklists (`DeckList.json` + per-deck files).

Magic: The Gathering is © Wizards of the Coast. This is an unofficial,
non-commercial hobby project.
