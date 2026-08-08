import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

const node = targets.find((t) => t.name.startsWith("Node"))!;

// PHP's operation_bootstrap.php only checks that a session exists — any
// logged-in user of any divisi can hit 8tluoperation.php directly; the IT-or-
// Operation rule is purely a sidebar-link-visibility gate in PHP, not
// enforced server-side. Same intentional tightening as sibarges (issue #9),
// applied here to TLU Operation (issue #10), so this assertion only holds
// for the Node target.
describe("tlu-operation access gate — divisi restriction (Node app only)", () => {
  const otherUser = `hr_${randomUUID().slice(0, 8)}`;
  const otherPassword = "hr-test-pass";

  beforeEach(async () => {
    await seedLegacyUser(otherUser, otherPassword, "Staff", "HR");
  });

  afterEach(async () => {
    await deleteUserRow(otherUser);
  });

  it("blocks a non-IT, non-Operation divisi with 403 on the page route", async () => {
    const client = new HttpClient(node.baseUrl);
    await client.postForm(node.paths.login, {
      username: otherUser,
      password: otherPassword,
    });

    const res = await client.get(node.paths.tluOperation);
    expect(res.status).toBe(403);
  });

  it("blocks a non-IT, non-Operation divisi with 403 on the AJAX endpoint", async () => {
    const client = new HttpClient(node.baseUrl);
    await client.postForm(node.paths.login, {
      username: otherUser,
      password: otherPassword,
    });

    const res = await client.get(
      `${node.paths.tluOperation}?ajax=1&action=si_barges_by_vessel&no_pk=X`
    );
    expect(res.status).toBe(403);
  });
});
