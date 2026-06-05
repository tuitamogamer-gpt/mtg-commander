import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, registerUser } from "./helpers.js";

const reg = (app: FastifyInstance, body: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/api/auth/register", payload: body });
const login = (app: FastifyInstance, body: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/api/auth/login", payload: body });

describe("auth", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await makeApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("registers a new user with email and sets a cookie", async () => {
    const name = `reg_${Date.now()}`;
    const res = await reg(app, { username: name, email: `${name}@example.com`, password: "secret123" });
    expect(res.statusCode).toBe(201);
    expect(res.headers["set-cookie"]).toBeTruthy();
    expect(res.json().user.username).toMatch(/^reg_/);
    expect(res.json().user.email).toBe(`${name}@example.com`);
  });

  it("rejects a short password with 400", async () => {
    const res = await reg(app, { username: "shorty", email: "shorty@example.com", password: "x" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an invalid email with 400", async () => {
    const res = await reg(app, { username: "bademail", email: "not-an-email", password: "secret123" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a duplicate username with 409", async () => {
    const name = `dup_${Date.now()}`;
    await reg(app, { username: name, email: `${name}@example.com`, password: "secret123" });
    const res = await reg(app, { username: name, email: `${name}2@example.com`, password: "secret123" });
    expect(res.statusCode).toBe(409);
  });

  it("rejects a duplicate email with 409", async () => {
    const email = `dupmail_${Date.now()}@example.com`;
    await reg(app, { username: `um_${Date.now()}a`, email, password: "secret123" });
    const res = await reg(app, { username: `um_${Date.now()}b`, email, password: "secret123" });
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

  it("logs in by username or email, and rejects wrong passwords", async () => {
    const name = `login_${Date.now()}`;
    const email = `${name}@example.com`;
    await reg(app, { username: name, email, password: "secret123" });

    const byUser = await login(app, { identifier: name, password: "secret123" });
    expect(byUser.statusCode).toBe(200);

    const byEmail = await login(app, { identifier: email, password: "secret123" });
    expect(byEmail.statusCode).toBe(200);

    const bad = await login(app, { identifier: name, password: "wrongpass" });
    expect(bad.statusCode).toBe(401);
  });

  it("logs out", async () => {
    const { cookie } = await registerUser(app);
    const res = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });
});
