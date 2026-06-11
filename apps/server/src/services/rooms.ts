import { nanoid } from "nanoid";
import type { Room, RoomPlayer, RoomSettings, RoomSummary } from "@mtgc/shared";
import { DEFAULT_ROOM_SETTINGS } from "@mtgc/shared";
import { prisma } from "../db.js";

/**
 * DB-backed lobby rooms for the stateless (serverless/polling) architecture.
 * The Room row stores the shared Room shape as JSON; `connected` is derived from
 * each player's lastSeenAt heartbeat (updated by their room polls), so presence
 * works without any persistent connection.
 */

export interface AuthedUser {
  id: string;
  username: string;
}

/** A player counts as connected if they polled within this window. */
const PRESENCE_WINDOW_MS = 12_000;
/** Throttle presence writes so polling doesn't hammer the DB. */
const PRESENCE_WRITE_MS = 5_000;
/** Waiting rooms idle longer than this are garbage-collected on list(). */
const STALE_ROOM_MS = 30 * 60 * 1000;

function parseRoom(data: string): Room {
  return JSON.parse(data) as Room;
}

function deriveConnected(room: Room): Room {
  const now = Date.now();
  for (const p of room.players) {
    p.connected = now - (p.lastSeenAt ?? 0) < PRESENCE_WINDOW_MS;
  }
  return room;
}

async function saveRoom(room: Room): Promise<void> {
  await prisma.room.update({
    where: { id: room.id },
    data: { data: JSON.stringify(room), status: room.status },
  });
}

async function loadRoom(roomId: string): Promise<Room | null> {
  const row = await prisma.room.findUnique({ where: { id: roomId } });
  return row ? deriveConnected(parseRoom(row.data)) : null;
}

function requirePlayer(room: Room, userId: string): RoomPlayer {
  const player = room.players.find((p) => p.id === userId);
  if (!player) throw new Error("You are not in this room");
  return player;
}

function makePlayer(user: AuthedUser, isHost: boolean): RoomPlayer {
  return {
    id: user.id,
    username: user.username,
    deckId: null,
    deckName: null,
    ready: false,
    isHost,
    connected: true,
    lastSeenAt: Date.now(),
  };
}

export const roomService = {
  /** List open rooms, lazily GC-ing abandoned waiting rooms. */
  async list(): Promise<RoomSummary[]> {
    await prisma.room.deleteMany({
      where: { status: "waiting", updatedAt: { lt: new Date(Date.now() - STALE_ROOM_MS) } },
    });
    const rows = await prisma.room.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map((row) => {
      const room = parseRoom(row.data);
      return {
        id: room.id,
        name: room.name,
        hostUsername: room.players.find((p) => p.id === room.hostId)?.username ?? "—",
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        status: room.status,
        allowSpectators: room.settings.allowSpectators,
        gameId: room.gameId,
      };
    });
  },

  get: loadRoom,

  /** Load a room and record the viewer's presence heartbeat (throttled write). */
  async getAndTouch(roomId: string, userId: string): Promise<Room | null> {
    const room = await loadRoom(roomId);
    if (!room) return null;
    const me = room.players.find((p) => p.id === userId);
    if (me && Date.now() - (me.lastSeenAt ?? 0) > PRESENCE_WRITE_MS) {
      me.lastSeenAt = Date.now();
      await saveRoom(room);
    }
    return deriveConnected(room);
  },

  async create(
    host: AuthedUser,
    name: string,
    maxPlayers: number,
    settings?: Partial<RoomSettings>
  ): Promise<Room> {
    const room: Room = {
      id: nanoid(8),
      name: name.trim() || `${host.username}'s table`,
      hostId: host.id,
      players: [makePlayer(host, true)],
      maxPlayers: Math.min(4, Math.max(2, maxPlayers || 4)),
      settings: { ...DEFAULT_ROOM_SETTINGS, ...settings },
      status: "waiting",
      gameId: null,
    };
    await prisma.room.create({
      data: { id: room.id, data: JSON.stringify(room), status: room.status },
    });
    return room;
  },

  async join(roomId: string, user: AuthedUser): Promise<Room> {
    const room = await loadRoom(roomId);
    if (!room) throw new Error("Room not found");
    const existing = room.players.find((p) => p.id === user.id);
    if (existing) {
      existing.lastSeenAt = Date.now();
      await saveRoom(room);
      return deriveConnected(room);
    }
    if (room.status !== "waiting") throw new Error("Game already started");
    if (room.players.length >= room.maxPlayers) throw new Error("Room is full");
    room.players.push(makePlayer(user, false));
    await saveRoom(room);
    return deriveConnected(room);
  },

  /** Remove a user. Returns the updated room, or null if the room was deleted. */
  async leave(roomId: string, userId: string): Promise<Room | null> {
    const room = await loadRoom(roomId);
    if (!room) return null;
    room.players = room.players.filter((p) => p.id !== userId);
    if (room.players.length === 0) {
      await prisma.room.delete({ where: { id: roomId } }).catch(() => {});
      return null;
    }
    if (room.hostId === userId) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }
    await saveRoom(room);
    return deriveConnected(room);
  },

  async setDeck(roomId: string, userId: string, deckId: string, deckName: string): Promise<Room> {
    const room = await loadRoom(roomId);
    if (!room) throw new Error("Room not found");
    const player = requirePlayer(room, userId);
    player.deckId = deckId;
    player.deckName = deckName;
    player.ready = false; // changing deck requires re-confirm
    await saveRoom(room);
    return deriveConnected(room);
  },

  async setReady(roomId: string, userId: string, ready: boolean): Promise<Room> {
    const room = await loadRoom(roomId);
    if (!room) throw new Error("Room not found");
    const player = requirePlayer(room, userId);
    if (ready && !player.deckId) throw new Error("Pick a deck before readying up");
    player.ready = ready;
    await saveRoom(room);
    return deriveConnected(room);
  },

  canStart(room: Room): string | null {
    if (room.players.length < 2) return "Need at least 2 players";
    if (room.players.some((p) => !p.deckId)) return "All players must pick a deck";
    if (room.players.some((p) => !p.ready)) return "All players must be ready";
    return null;
  },

  async markStarted(roomId: string, gameId: string): Promise<Room> {
    const room = await loadRoom(roomId);
    if (!room) throw new Error("Room not found");
    room.status = "in_game";
    room.gameId = gameId;
    await saveRoom(room);
    return room;
  },

  /** Drop a room entirely (e.g. its game finished). No-op if already gone. */
  async remove(roomId: string): Promise<void> {
    await prisma.room.delete({ where: { id: roomId } }).catch(() => {});
  },
};
