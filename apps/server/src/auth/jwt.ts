import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface JwtPayload {
  sub: string; // user id
  username: string;
}

const TOKEN_TTL = "30d";
export const AUTH_COOKIE = "mtgc_token";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === "string") return null;
    const { sub, username } = decoded as jwt.JwtPayload & Partial<JwtPayload>;
    if (typeof sub !== "string" || typeof username !== "string") return null;
    return { sub, username };
  } catch {
    return null;
  }
}

/** Cookie options for the auth token. httpOnly so JS can't read it. */
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.isProd,
  path: "/",
  maxAge: 30 * 24 * 60 * 60, // seconds
};
