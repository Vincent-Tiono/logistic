import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

function pathnameOf(baseUrl: string, location: string | null): string | null {
  if (!location) return null;
  return new URL(location, baseUrl).pathname;
}

describe.each(targets)("login — $name", (target) => {
  const username = `char_${randomUUID().slice(0, 8)}`;
  const password = "char-test-pass";

  beforeEach(async () => {
    await seedLegacyUser(username, password, "Staff", "Operation");
  });

  afterEach(async () => {
    await deleteUserRow(username);
  });

  it("shows the login form when logged out", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get(target.paths.login);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Login");
  });

  it("rejects an unknown username", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.postForm(target.paths.login, {
      username: "no-such-user",
      password: "whatever",
    });
    expect(res.status).toBe(200);
    expect(res.body).toContain("Username tidak ditemukan.");
  });

  it("rejects a known username with the wrong password", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.postForm(target.paths.login, {
      username,
      password: "wrong-password",
    });
    expect(res.status).toBe(200);
    expect(res.body).toContain("Password salah.");
  });

  it("logs in with correct credentials and redirects home", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.postForm(target.paths.login, {
      username,
      password,
    });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(pathnameOf(target.baseUrl, res.location)).toBe(target.paths.home);

    const home = await client.get(target.paths.home);
    expect(home.status).toBe(200);
    expect(home.body).toContain(username);
  });

  it("redirects an already-logged-in user away from /login", async () => {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, { username, password });

    const res = await client.get(target.paths.login);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(pathnameOf(target.baseUrl, res.location)).toBe(target.paths.home);
  });

  it("blocks /home without a session", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get(target.paths.home);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(pathnameOf(target.baseUrl, res.location)).toBe(target.paths.login);
  });

  it("logout clears the session", async () => {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, { username, password });

    await client.get(target.paths.logout);
    const res = await client.get(target.paths.home);
    expect(pathnameOf(target.baseUrl, res.location)).toBe(target.paths.login);
  });
});
