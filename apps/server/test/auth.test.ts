import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, registerUser } from "./helpers.js";

describe("auth", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await makeApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("registers a new user and sets a cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: `reg_${Date.now()}`, password: "secret123" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers["set-cookie"]).toBeTruthy();
    expect(res.json().user.username).toMatch(/^reg_/);
  });

  it("rejects a short password with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "shorty", password: "x" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a duplicate username with 409", async () => {
    const name = `dup_${Date.now()}`;
    await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: name, password: "secret123" } });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: name, password: "secret123" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns the current user from /me with a valid cookie", async () => {
    const { cookie, username } = await registerUser(app);
    const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe(username);
  });

  it("rejects /me without a cookie (401)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects /me with a garbage token (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: "mtgc_token=not-a-real-jwt" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    const name = `login_${Date.now()}`;
    await app.inject({ method: "POST", url: "/api/auth/register", payload: { username: name, password: "secret123" } });

    const ok = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: name, password: "secret123" } });
    expect(ok.statusCode).toBe(200);

    const bad = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: name, password: "wrongpass" } });
    expect(bad.statusCode).toBe(401);
  });

  it("logs out", async () => {
    const { cookie } = await registerUser(app);
    const res = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });
});
