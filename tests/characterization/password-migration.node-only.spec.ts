import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, readPassword, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

const node = targets.find((t) => t.name.startsWith("Node"))!;

describe("legacy plaintext password migration (Node app only)", () => {
  const username = `mig_${randomUUID().slice(0, 8)}`;
  const password = "legacy-plain-pass";

  beforeEach(async () => {
    await seedLegacyUser(username, password, "Staff", "Operation");
  });

  afterEach(async () => {
    await deleteUserRow(username);
  });

  it("rehashes the stored password to bcrypt after the first successful login", async () => {
    expect(await readPassword(username)).toBe(password);

    const client = new HttpClient(node.baseUrl);
    await client.postForm(node.paths.login, { username, password });

    const stored = await readPassword(username);
    expect(stored).not.toBe(password);
    expect(stored).toMatch(/^\$2[aby]\$/);
  });

  it("still logs in with the same plaintext password after rehashing", async () => {
    const client = new HttpClient(node.baseUrl);
    await client.postForm(node.paths.login, { username, password });

    const second = new HttpClient(node.baseUrl);
    const res = await second.postForm(node.paths.login, { username, password });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });
});
