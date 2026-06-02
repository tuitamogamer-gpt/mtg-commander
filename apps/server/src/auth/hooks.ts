import type { FastifyReply, FastifyRequest } from "fastify";
import { AUTH_COOKIE, verifyToken } from "./jwt.js";
import { prisma } from "../db.js";

/**
 * preHandler that requires a valid session. On success it populates
 * `request.user`; otherwise it replies 401 and the route never runs.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await resolveUser(request);
  if (!user) {
    await reply.code(401).send({ error: "Not authenticated" });
    return;
  }
  request.user = user;
}

/** Resolve the current user from the auth cookie, or null. Does not reply. */
export async function resolveUser(request: FastifyRequest) {
  const token = request.cookies?.[AUTH_COOKIE];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;
  return { id: user.id, username: user.username, createdAt: user.createdAt.toISOString() };
}
