import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { AUTH_COOKIE, cookieOptions, signToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/hooks.js";
import type { AuthResponse, PublicUser } from "@mtgc/shared";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores");

const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);

const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  password: passwordSchema,
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email"),
  password: z.string().min(1, "Enter your password"),
});

function toPublic(user: { id: string; username: string; email: string | null; createdAt: Date }): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { username, email, password } = parsed.data;

    if (await prisma.user.findUnique({ where: { username } })) {
      return reply.code(409).send({ error: "Username already taken" });
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      return reply.code(409).send({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { username, email, passwordHash } });

    const token = signToken({ sub: user.id, username: user.username });
    reply.setCookie(AUTH_COOKIE, token, cookieOptions);
    const body: AuthResponse = { user: toPublic(user) };
    return reply.code(201).send(body);
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid username or password" });
    }
    const { identifier, password } = parsed.data;

    // Identifier is a username or an email.
    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier.toLowerCase() }] },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid username or password" });
    }

    const token = signToken({ sub: user.id, username: user.username });
    reply.setCookie(AUTH_COOKIE, token, cookieOptions);
    const body: AuthResponse = { user: toPublic(user) };
    return reply.send(body);
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (request) => {
    const body: AuthResponse = { user: request.user! };
    return body;
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie(AUTH_COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });
}
