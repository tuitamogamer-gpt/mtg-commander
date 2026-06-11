import type { PublicUser } from "@mtgc/shared";

declare module "fastify" {
  interface FastifyRequest {
    /** Populated by the auth hook when a valid session cookie is present. */
    user?: PublicUser;
  }
}

export {};
