import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const FILES = ["prisma/test.db", "prisma/test.db-journal"];

function removeDb() {
  for (const f of FILES) {
    try {
      rmSync(f);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Create a fresh test database before the suite and remove it afterwards.
 * We delete the file first so a plain `db push` starts clean — avoiding Prisma's
 * `--force-reset` / `--accept-data-loss` guard (the test DB is disposable).
 */
export default function setup() {
  process.env.DATABASE_URL = "file:./test.db";
  removeDb();
  // No --skip-generate: ensures the Prisma client is generated for the SQLite
  // schema before the suite imports it.
  execSync("pnpm exec prisma db push --schema prisma/schema.prisma", {
    stdio: "inherit",
    env: process.env,
  });
  return removeDb;
}
