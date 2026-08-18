import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

const node = targets.find((t) => t.name.startsWith("Node"))!;

// SPAL is a Node-only module (no PHP predecessor), so the divisi gate is
// enforced from the start — same pattern as the other IT/VM&FAT modules
// (see jetty-gate.node-only.spec.ts).
describe("spal access gate — divisi restriction (Node app only)", () => {
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

    const res = await client.get(node.paths.spal);
    expect(res.status).toBe(403);
  });

  it("blocks a non-IT, non-VM&FAT divisi with 403 on the create endpoint", async () => {
    const client = new HttpClient(node.baseUrl);
    await client.postForm(node.paths.login, {
      username: otherUser,
      password: otherPassword,
    });

    const res = await client.postForm(node.paths.spal, {
      nomor: "999/SHOULD-NOT-EXIST/2026",
      tanggal: "2026-08-18",
      nama_pt: "Blocked",
      alamat: "Somewhere",
      uang_tambang: "1000000",
      jetty_muat: "A",
      jetty_bongkar: "B",
      nama_penandatangan: "X",
      jabatan: "Y",
    });
    expect(res.status).toBe(403);
  });
});
