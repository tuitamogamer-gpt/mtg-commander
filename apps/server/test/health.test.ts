import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp } from "./helpers.js";

describe("health & metrics", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await makeApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("reports healthy with a working DB", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
  });

  it("exposes basic metrics", async () => {
    const res = await app.inject({ method: "GET", url: "/api/metrics" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.requests).toBe("number");
    expect(typeof body.activeGames).toBe("number");
    expect(typeof body.avgLatencyMs).toBe("number");
  });
});
