import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET", "dev-insecure-secret-change-me"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  clientOrigins: (process.env.CLIENT_ORIGIN ?? process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** Optional cookie Domain attribute (e.g. ".example.com") for cross-subdomain
   * auth in production. Unset = host-only cookie (correct for localhost). */
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  /** Cookie SameSite. Use "none" for a split-origin deploy (web on a different
   * domain than the API, e.g. Vercel + Railway) — requires Secure (HTTPS). */
  cookieSameSite: (process.env.COOKIE_SAMESITE as "lax" | "none" | "strict") || "lax",
  /** Card cache time-to-live in milliseconds (30 days). */
  cardCacheTtlMs: 30 * 24 * 60 * 60 * 1000,
} as const;
