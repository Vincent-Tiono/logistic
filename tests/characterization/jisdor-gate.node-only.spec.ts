import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

const node = targets.find((t) => t.name.startsWith("Node"))!;

// VM&FAT/1jisdor.php only checks that a session exists — the IT/VM&FAT
// sidebar link visibility is not enforced server-side in PHP. Same
// intentional server-side tightening as jetty (see jetty-gate.node-only.spec.ts),
// applied here to jisdor.
describe("jisdor access gate — divisi restriction (Node app only)", () => {
  const otherUser = `hr_${randomUUID().slice(0, 8)}`;
  const otherPassword = "hr-test-pass";

  beforeEach(async () => {
    await seedLegacyUser(otherUser, otherPassword, "Staff", "HR");
  });

  afterEach(async () => {
    await deleteUserRow(otherUser);
  });

  it("blocks a non-IT, non-VM&FAT divisi with 403 on the page route", async () => {
    const client = new HttpClient(node.baseUrl);
    await client.postForm(node.paths.login, {
      username: otherUser,
      password: otherPassword,
    });

    const res = await client.get(node.paths.jisdor);
    expect(res.status).toBe(403);
  });
});
