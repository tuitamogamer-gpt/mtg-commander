import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, registerUser, seedPrecon } from "./helpers.js";

describe("precons", () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    app = await makeApp();
    ({ cookie } = await registerUser(app));
    await seedPrecon("TST", "Mono White Precon", [{ scryfallId: "a", name: "Plains", quantity: 1, isCommander: false }], ["W"]);
    await seedPrecon("TST", "Azorius Precon", [{ scryfallId: "b", name: "Island", quantity: 1, isCommander: false }], ["W", "U"]);
    await seedPrecon("OTH", "Rakdos Precon", [{ scryfallId: "c", name: "Swamp", quantity: 1, isCommander: false }], ["B", "R"]);
  });
  afterAll(async () => {
    await app.close();
  });

  it("lists precons (public, no auth)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/precons" });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(3);
  });

  it("filters by set code", async () => {
    const res = await app.inject({ method: "GET", url: "/api/precons?setCode=OTH" });
    const items = res.json();
    expect(items.every((p: { setCode: string }) => p.setCode === "OTH")).toBe(true);
  });

  it("filters by color-identity subset", async () => {
    // colors=W returns only decks whose identity ⊆ {W} (mono-white).
    const res = await app.inject({ method: "GET", url: "/api/precons?colors=W" });
    const names = res.json().map((p: { name: string }) => p.name);
    expect(names).toContain("Mono White Precon");
    expect(names).not.toContain("Azorius Precon");
  });

  it("searches by name", async () => {
    const res = await app.inject({ method: "GET", url: "/api/precons?search=Rakdos" });
    expect(res.json()).toHaveLength(1);
  });

  it("clones a precon into the user's decks", async () => {
    const list = await app.inject({ method: "GET", url: "/api/precons" });
    const preconId = list.json()[0].id;
    const res = await app.inject({
      method: "POST",
      url: `/api/decks/import/precon/${preconId}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().source).toBe("precon");
  });

  it("404s an unknown precon clone", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/decks/import/precon/does-not-exist",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
