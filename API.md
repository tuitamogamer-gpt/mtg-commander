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

## Socket.IO

Both namespaces authenticate from the auth cookie.

### `/lobby`
Client → server (ack-based): `lobby:list_rooms`, `lobby:create_room`,
`lobby:join_room`, `lobby:leave_room`, `lobby:set_deck`, `lobby:ready`,
`lobby:start_game`, `lobby:chat`.
Server → client: `lobby:rooms`, `lobby:room_updated`, `lobby:game_started`,
`lobby:chat`.

### `/game`
Client → server: `game:join`, `game:action` (the `GameAction` union),
`game:undo`, `game:end`, `game:peek`, `game:request_state`, `game:chat`.
Server → client: `game:state` (per-viewer redacted `GameStateView`), `game:log`,
`game:chat`, `game:player_connection`, `game:error`.

> A machine-readable OpenAPI spec (via `fastify-swagger`) is a possible future
> addition; today the shared TypeScript types are the source of truth.
