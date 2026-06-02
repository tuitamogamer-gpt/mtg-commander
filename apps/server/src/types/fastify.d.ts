import type { Server as SocketServer } from "socket.io";
import type { PublicUser } from "@mtgc/shared";

declare module "fastify" {
  interface FastifyInstance {
    io: SocketServer;
  }
  interface FastifyRequest {
    /** Populated by the auth hook when a valid session cookie is present. */
    user?: PublicUser;
  }
}

export {};
