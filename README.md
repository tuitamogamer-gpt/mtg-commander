# MTG Commander — online multiplayer client

A full-stack web app for playing the **Magic: The Gathering Commander** format
online with 2–4 players. Import decks from **Moxfield** or pick any official
**Commander precon**, gather a pod in a lobby, and play on a shared virtual table.

Rules are **honor-system** (like Cockatrice / Untap.in): the server is
authoritative over state and hidden information, but it does **not** enforce MTG
rules — players move their own cards freely. No AI opponent, no rules engine.

**Docs:** [Architecture](ARCHITECTURE.md) · [API reference](API.md) ·
[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md). New players get a
short in-app walkthrough on first login.

> _Screenshots: not yet captured (the headless build environment can't grab them
> reliably). Run `pnpm dev` and open http://localhost:5173 to see the UI._

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

## Features

**Accounts & decks**
- Register / login / me / logout with a JWT httpOnly cookie (bcrypt-hashed).
- Scryfall card proxy with a 30-day local cache (`/api/cards/:id`, `/batch`,
  `/search`); serves stale on upstream failure.
- Deck CRUD + advisory Commander-legality validation + color-identity computation.
- **Moxfield import** by URL/id (clears Cloudflare via a curl-based fetch).
- **Precon library** — every Commander precon seeded from MTGJSON; browse with
  search + color-identity + set filters; one-click clone into your decks.
- **Deck builder/editor** — Scryfall-backed search (name/type/oracle/color/CMC),
  click-to-add, quantity & commander toggles, and a live validation panel
  (100-card count, singleton, Commander **ban list**, commander legality, identity).

**Lobby**
- Socket.IO rooms: create/join/leave, deck selection, ready-up, host-only start
  (2–4 players), per-table chat, and an "allow spectators" toggle.

**Game table (server-authoritative, honor-system)**
- Drag-and-drop between battlefield rows, hand, graveyard, exile, command, and the
  shared **stack** (drop to cast; resolve/counter to the owner's zone).
- Click to tap/untap, hover toolbar (+1/+1, −1/−1, to GY/exile, flip face-down).
- Life tracker + Commander-damage matrix, poison, mana pool, custom counters,
  monarch/initiative, tokens.
- Draw / mill / shuffle; **scry** (drag-reorder + bottom), look-at-top, reveal,
  and **search/tutor**.
- Full **London mulligan** flow (keep / mulligan / bottom-N), with opponents'
  mulligan counts shown.
- Phase + turn bar (pass-priority / next-phase / next-turn, skipping absent seats).
- **Reconnect** — auto re-join on socket reconnect; 5-minute grace with a
  disconnect banner + countdown and a host "skip / restore" control.
- **Spectator mode** — watch a table read-only with hidden hands/libraries and
  tagged chat.
- **Hover-zoom** large card preview anywhere; game log and in-game chat.
- Hidden hands/libraries enforced per viewer; reconnect-safe DB snapshots.

**Ops**
- Responsive / mobile layout (drawer sidebar, touch drag-drop).
- Docker + docker-compose (Postgres) deployment with health check — see
  [Deployment](#deployment).

---

## What remains (out of scope by design)

- **No rules enforcement** — layers, replacement effects, triggered abilities, and
  combat math are the players' responsibility (honor system, like Cockatrice).
- **No AI opponent.**
- **Spectator-to-seat handoff** mid-game, and richer card interactions
  (double-faced flip art, aura/equipment attachment grouping, multi-select drag).
- **Cross-provider migration history** — production uses `prisma db push` rather
  than committed Postgres migrations.
- The Docker setup is a starting point (authored, not run in CI) — see the note in
  [Deployment](#deployment).

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
