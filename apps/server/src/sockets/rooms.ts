import { nanoid } from "nanoid";
import type { Room, RoomPlayer, RoomSettings, RoomSummary } from "@mtgc/shared";
import { DEFAULT_ROOM_SETTINGS } from "@mtgc/shared";
import type { SocketUser } from "./auth.js";

/**
 * In-memory lobby state. Rooms live only while the server is up; that's fine for
 * a lobby (games get persisted separately for reconnect). A single instance is
 * shared by the lobby namespace.
 */
class RoomManager {
  private rooms = new Map<string, Room>();

  list(): RoomSummary[] {
    return [...this.rooms.values()].map((room) => ({
      id: room.id,
      name: room.name,
      hostUsername: room.players.find((p) => p.id === room.hostId)?.username ?? "—",
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      status: room.status,
      allowSpectators: room.settings.allowSpectators,
      gameId: room.gameId,
    }));
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  create(
    host: SocketUser,
    name: string,
    maxPlayers: number,
    settings?: Partial<RoomSettings>
  ): Room {
    const id = nanoid(8);
    const clampedMax = Math.min(4, Math.max(2, maxPlayers || 4));
    const room: Room = {
      id,
      name: name.trim() || `${host.username}'s table`,
      hostId: host.id,
      players: [makePlayer(host, true)],
      maxPlayers: clampedMax,
      settings: { ...DEFAULT_ROOM_SETTINGS, ...settings },
      status: "waiting",
      gameId: null,
    };
    this.rooms.set(id, room);
    return room;
  }

  join(roomId: string, user: SocketUser): Room {
    const room = this.require(roomId);
    if (room.status !== "waiting") throw new Error("Game already started");
    const existing = room.players.find((p) => p.id === user.id);
    if (existing) {
      existing.connected = true;
      return room;
    }
    if (room.players.length >= room.maxPlayers) throw new Error("Room is full");
    room.players.push(makePlayer(user, false));
    return room;
  }

  /** Remove a user from a room. Returns the room (or undefined if it was deleted). */
  leave(roomId: string, userId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    room.players = room.players.filter((p) => p.id !== userId);
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return undefined;
    }
    // Promote a new host if the host left.
    if (room.hostId === userId) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }
    return room;
  }

  setDeck(roomId: string, userId: string, deckId: string, deckName: string): Room {
    const room = this.require(roomId);
    const player = this.requirePlayer(room, userId);
    player.deckId = deckId;
    player.deckName = deckName;
    // Changing deck clears the ready flag to force a re-confirm.
    player.ready = false;
    return room;
  }

  setReady(roomId: string, userId: string, ready: boolean): Room {
    const room = this.require(roomId);
    const player = this.requirePlayer(room, userId);
    if (ready && !player.deckId) throw new Error("Pick a deck before readying up");
    player.ready = ready;
    return room;
  }

  setConnected(roomId: string, userId: string, connected: boolean): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    const player = room.players.find((p) => p.id === userId);
    if (player) player.connected = connected;
    return room;
  }

  /** Drop a room entirely (e.g. its game finished). No-op if already gone. */
  remove(roomId: string): void {
    this.rooms.delete(roomId);
  }

  markStarted(roomId: string, gameId: string): Room {
    const room = this.require(roomId);
    room.status = "in_game";
    room.gameId = gameId;
    return room;
  }

  canStart(room: Room): string | null {
    if (room.players.length < 2) return "Need at least 2 players";
    if (room.players.some((p) => !p.deckId)) return "All players must pick a deck";
    if (room.players.some((p) => !p.ready)) return "All players must be ready";
    return null;
  }

  private require(roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room not found");
    return room;
  }

  private requirePlayer(room: Room, userId: string): RoomPlayer {
    const player = room.players.find((p) => p.id === userId);
    if (!player) throw new Error("You are not in this room");
    return player;
  }
}

function makePlayer(user: SocketUser, isHost: boolean): RoomPlayer {
  return {
    id: user.id,
    username: user.username,
    deckId: null,
    deckName: null,
    ready: false,
    isHost,
    connected: true,
  };
}

export const roomManager = new RoomManager();
