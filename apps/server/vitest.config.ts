import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // A dedicated SQLite file is created/reset by global-setup.
    env: {
      DATABASE_URL: "file:./test.db",
      JWT_SECRET: "test-secret-please-change",
      NODE_ENV: "test",
      CLIENT_ORIGIN: "http://localhost:5173",
    },
    globalSetup: "./test/global-setup.ts",
    include: ["test/**/*.test.ts"],
    // Share one SQLite file across files without write races.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/types/**"],
      reporter: ["text", "html"],
    },
  },
});
