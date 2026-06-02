# Changelog

All notable changes to this project. Built in numbered phases (Faze); each was a
self-contained commit.

## v0.2.0 — "polished product" pass

Turns the v0.1.0 MVP into something a playgroup would actually enjoy using.

- **Faza 21 — Tests + CI**: Vitest backend suite via Fastify inject (auth, decks,
  precons, cards, moxfield, game engine, lobby + game sockets) at ~82% server
  coverage; Vitest/RTL frontend tests; Playwright happy-path e2e; GitHub Actions
  CI (lint + test + build, plus an e2e job).
- **Faza 22 — UI polish**: toast notifications, loading skeletons, empty states,
  light/dark theme toggle (no-flash), lazy/fade-in card art, Framer Motion modal
  + route transitions.
- **Faza 23 — Game UX**: undo (server snapshot ring + Ctrl+Z), right-click card
  context menu, token creator, custom player/card counters, keyboard shortcuts,
  phase auto-pass, sound cues.
- **Faza 24 — Deck builder**: import-from-text (name resolution), export to
  clipboard, mana-curve chart, inline ban-list flags.
- **Faza 25 — Social**: match history, persisted (replayed) in-game chat,
  end-game winner recording, lobby filters.
- **Faza 26 — Performance**: route code-splitting + vendor chunking (no more
  oversized bundle), rate limiting, response-time logging, socket heartbeat
  tuning.
- **Faza 27 — Observability**: DB-aware health check, /api/metrics, central error
  handler + Sentry stub, frontend ErrorBoundary.
- **Faza 28 — Accessibility**: high-contrast mode, reduced-motion, ARIA labels,
  dialog roles on modals.
- **Faza 29 — Docs & onboarding**: ARCHITECTURE/API/CONTRIBUTING docs + in-app
  first-login walkthrough.
- **Faza 30 — Release**: full suite green, version bump, this entry, `v0.2.0` tag.
- **Faza 31 — Commander mechanics**: command-zone start, commander tax (+2/cast),
  return-to-command, 21-damage / 0-life / 10-poison elimination, color-identity
  deck validation, singleton "any number" exemption.
- **Faza 32 — Tokens**: visual indicator, copies count, correct preset P/T.
- **Faza 33 — MTG test coverage**: explicit commander/token/validation tests, a
  consolidated socket e2e (full lifecycle), a working Playwright happy-path, and
  `TESTING.md`. Final counts: 59 server + 12 web unit/integration tests + 1
  Playwright e2e, all green.

Deferred to a later iteration: friends/presence system, spectator waitlist,
service-worker offline cache, EDHREC suggestions, OpenAPI/swagger, automated axe
audit, and (by design) any MTG rules enforcement.

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
