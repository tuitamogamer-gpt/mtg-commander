# Changelog

All notable changes to this project. Built in numbered phases (Faze); each was a
self-contained commit.

## v0.1.0

### Foundation (Faze 0–10)
- **Faza 0** — Repo cleanup: fresh `git init`, `.gitignore`, `.gitattributes`.
- **Faza 1** — Monorepo scaffold: pnpm workspaces (`apps/web`, `apps/server`,
  `packages/shared`); shared TypeScript contracts (cards, decks, auth, game,
  lobby, socket).
- **Faza 2** — Backend skeleton: Fastify 5 + Prisma (SQLite) + Socket.IO attach
  point; schema (User, Deck, PreconDeck, Card, Game); health endpoint.
- **Faza 3** — Frontend skeleton: Vite + React 18 + Tailwind v4 + Router; dark
  theme, UI primitives, page stubs.
- **Faza 4** — Auth end-to-end: register/login/me/logout, JWT httpOnly cookie,
  zod validation, route guard.
- **Faza 5** — Scryfall card proxy + 30-day cache (single + batch).
- **Faza 6** — Deck CRUD + Moxfield import (curl-based fetch to clear Cloudflare).
- **Faza 7** — Precon library: MTGJSON seed script (181 decks), filter/search API,
  clone-to-deck, browser UI.
- **Faza 8** — Socket.IO lobby: rooms, deck select, ready, host start, chat;
  authoritative initial game-state builder.
- **Faza 9** — Interactive game table (vertical slice): drag-drop zones, tap,
  counters, life/commander damage, mana, draw, phases, log, chat; per-viewer
  redaction.
- **Faza 10** — README: setup, architecture, status.

### Full client (Faze 11–20)
- **Faza 11** — London mulligan flow: deal opening 7, keep/mulligan, bottom-N step.
- **Faza 12** — Reconnect UX: auto re-join, 5-minute grace + auto-skip, disconnect
  banner with countdown, host skip/restore.
- **Faza 13** — Spectator mode: allow-spectators setting, read-only join with
  hidden hands/libraries, tagged chat.
- **Faza 14** — Stack as a real shared zone: cast from hand, resolve/counter to the
  owner's zone with card art.
- **Faza 15** — Library tools: scry (drag-reorder + bottom), look-at-top, reveal,
  search/tutor; private peek socket request.
- **Faza 16** — Deck builder/editor: Scryfall search + filters, click-to-add,
  quantities, commander toggle, live validation incl. Commander ban list.
- **Faza 17** — Hover-zoom card preview (global overlay, viewport-aware).
- **Faza 18** — Mobile/responsive layout: drawer sidebar, responsive grids, touch
  drag-drop.
- **Faza 19** — Production deploy: Dockerfiles (server + nginx web), docker-compose
  with Postgres, `prisma/postgres.prisma`, env reference, deploy docs.
- **Faza 20** — Final polish: consolidated end-to-end verification (18 checks),
  README Features section, this changelog, v0.1.0 tag.
