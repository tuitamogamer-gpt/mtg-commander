# API reference

All REST routes are under `/api`. Auth is a JWT in an httpOnly `mtgc_token`
cookie; protected routes return `401` without it. Request/response shapes are the
TypeScript types in `packages/shared`.

## Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ username, password }` | 201 + sets cookie; 409 if taken |
| POST | `/api/auth/login` | `{ username, password }` | 200 + sets cookie; 401 on bad creds |
| GET | `/api/auth/me` | — | current `PublicUser`; 401 if unauthed |
| POST | `/api/auth/logout` | — | clears cookie |

## Cards (Scryfall proxy, 30-day cache)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/cards/:scryfallId` | single card; 404 if unknown |
| POST | `/api/cards/batch` | `{ ids: string[] }` → `{ cards, notFound }` |
| POST | `/api/cards/by-names` | `{ names: string[] }` → `{ cards, notFound }` |
| GET | `/api/cards/search?q=` | Scryfall query syntax → `Card[]` |
| GET | `/api/cards/banlist` | `{ names }` — Commander banned list |

## Decks (auth)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/decks` | the user's decks |
| GET/PUT/DELETE | `/api/decks/:id` | fetch / update / delete (ownership enforced) |
| POST | `/api/decks` | `{ name, cards }` |
| GET | `/api/decks/:id/validate` | advisory Commander legality |
| POST | `/api/decks/import/moxfield` | `{ deckId }` (id or URL) |
| POST | `/api/decks/import/precon/:preconId` | clone a precon |

## Precons (public) & matches (auth)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/precons?setCode=&colors=&search=` | filtered `PreconListItem[]` |
| GET | `/api/precons/sets` | distinct set codes |
| GET | `/api/precons/:id` | full `PreconDeck` |
| GET | `/api/matches` | the user's finished games |

## Ops

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | `{ status, db }`; 503 if DB down |
| GET | `/api/metrics` | uptime, requests, latency, active games/sockets |

## Lobby (auth, polled by clients)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/lobby/rooms` | open rooms (`RoomSummary[]`); polled ~2.5s |
| POST | `/api/lobby/rooms` | `{ name?, maxPlayers?, settings? }` → `Room` |
| GET | `/api/lobby/rooms/:id` | room state; also records the viewer's presence heartbeat |
| POST | `/api/lobby/rooms/:id/join` \| `/leave` | seat management |
| POST | `/api/lobby/rooms/:id/deck` | `{ deckId }` (ownership enforced) |
| POST | `/api/lobby/rooms/:id/ready` | `{ ready }` |
| POST | `/api/lobby/rooms/:id/start` | host-only → `{ gameId }`; peers see it via the room poll |
| GET/POST | `/api/lobby/rooms/:id/chat` | `?after=<epoch ms>` incremental fetch / `{ text }` |

## Game (auth, polled by clients)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/games/:id/state?since=<version>` | per-viewer redacted `GameStateView`; returns only `{ version }` when unchanged (polled ~1.5s); 403 for spectators when disallowed |
| POST | `/api/games/:id/action` | a `GameAction`; returns the actor's fresh state immediately |
| POST | `/api/games/:id/undo` | restore the last pre-action snapshot |
| POST | `/api/games/:id/end` | `{ winnerId }` — records a Match, cleans up the lobby room |
| GET | `/api/games/:id/peek?count=` | top N of your own library (scry/search), private |
| GET/POST | `/api/games/:id/chat` | `?after=` incremental / `{ text }` (spectator-tagged) |

> Realtime is plain HTTP polling — no WebSockets — so the API runs fully on
> serverless hosting (Vercel). The shared TypeScript types are the source of
> truth for payload shapes.
