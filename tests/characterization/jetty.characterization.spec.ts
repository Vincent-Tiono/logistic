import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { deleteJettyRow, seedJettyRow } from "./jetty-fixture.js";
import { targets } from "./targets.js";

interface JettyRow {
  jetty: string;
  nama_panjang: string;
}

interface AjaxResult {
  ok: boolean;
  msg?: string;
  data?: JettyRow[];
}

// jetty is guarded by the same app-level divisi check as shipper (see
// jetty-gate.node-only.spec.ts for the Node-specific tightening beyond raw
// PHP behavior). Jetty has only two free-text-ish fields (jetty code +
// nama_panjang), no decimal/numeric fields, so there is no null-coercion
// test here like shipper's laytime one.
describe.each(targets)("jetty — $name", (target) => {
  const itUser = `it_${randomUUID().slice(0, 8)}`;
  const itPassword = "it-test-pass";
  const opUser = `op_${randomUUID().slice(0, 8)}`;
  const opPassword = "op-test-pass";
  const managedJetty = `JT${randomUUID().slice(0, 6)}`.toUpperCase();
  const importedJetty = `${managedJetty}N`;

  beforeEach(async () => {
    await seedLegacyUser(itUser, itPassword, "Staff", "IT");
    await seedLegacyUser(opUser, opPassword, "Staff", "Operation");
  });

  afterEach(async () => {
    await deleteUserRow(itUser);
    await deleteUserRow(opUser);
    await deleteJettyRow(managedJetty);
    await deleteJettyRow(importedJetty);
  });

  async function loginAs(username: string, password: string) {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, { username, password });
    return client;
  }

  function ajaxUrl() {
    return `${target.paths.jetty}?ajax=1`;
  }

  function listUrl(q: string) {
    return `${target.paths.jetty}?ajax=1&action=list&q=${encodeURIComponent(q)}`;
  }

  it("redirects to login when no session", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get(target.paths.jetty);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("renders the page for Operation users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.get(target.paths.jetty);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Jetty");
  });

  it("validates required fields on create", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      jetty: "",
      nama_panjang: "",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("wajib diisi");
  });

  it("creates, lists, updates, and deletes a jetty end-to-end", async () => {
    const client = await loginAs(opUser, opPassword);

    const created = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      jetty: managedJetty.toLowerCase(),
      nama_panjang: "JETTY PT TEST HARAPAN, EAST KALIMANTAN",
    });
    expect(created.ok).toBe(true);
    expect(created.msg).toContain("berhasil ditambah");

    const duplicate = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      jetty: managedJetty,
      nama_panjang: "JETTY PT TEST HARAPAN, EAST KALIMANTAN",
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.msg).toContain("sudah ada");

    const listed = await client.get(listUrl(managedJetty));
    const listedJson = JSON.parse(listed.body) as AjaxResult;
    expect(listedJson.ok).toBe(true);
    const row = listedJson.data?.find((r) => r.jetty === managedJetty);
    // jetty code is uppercased on write, even when posted lowercase
    expect(row).toBeDefined();

    const updated = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "update",
      jetty: managedJetty,
      nama_panjang: "JETTY PT TEST HARAPAN UPDATED",
    });
    expect(updated.ok).toBe(true);
    expect(updated.msg).toContain("berhasil diupdate");

    const deleted = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete",
      jetty: managedJetty,
    });
    expect(deleted.ok).toBe(true);
    expect(deleted.msg).toContain("berhasil dihapus");
  });

  it("rejects delete with an empty jetty code", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete",
      jetty: "",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Kode Jetty kosong");
  });

  it("rejects import_csv for non-IT users", async () => {
    const client = await loginAs(opUser, opPassword);
    const csv = "jetty,nama_panjang\n";
    const res = await client.postJsonMultipart<AjaxResult>(
      ajaxUrl(),
      { action: "import_csv" },
      { fieldName: "csv", filename: "jetty.csv", content: csv }
    );
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Hanya Divisi IT");
  });

  // PHP 8.5's `php -S` unconditionally emits an fgetcsv() deprecation notice
  // into the response body on every call, corrupting the JSON regardless of
  // CSV content — a PHP-version environment artifact, not business logic.
  // Per the ticket's CSV-parity carve-out ("nice-to-have... don't block"),
  // this assertion runs Node-only; "rejects import_csv for non-IT" above
  // still covers the PHP target since it returns before fgetcsv() runs.
  it.skipIf(target.name.startsWith("PHP"))(
    "imports valid rows, skips duplicate jetty codes, and counts invalid rows as errors (IT only)",
    async () => {
      const client = await loginAs(itUser, itPassword);
      await seedJettyRow({
        jetty: managedJetty,
        nama_panjang: "JETTY PT TEST HARAPAN",
      });

      const header = "jetty,nama_panjang";
      const dupRow = `${managedJetty},JETTY PT TEST HARAPAN`;
      const newRow = `${importedJetty},JETTY PT NEW HARAPAN`;
      const badRow = `,`;
      const csv = [header, dupRow, newRow, badRow].join("\n") + "\n";

      const res = await client.postJsonMultipart<AjaxResult>(
        ajaxUrl(),
        { action: "import_csv" },
        { fieldName: "csv", filename: "jetty.csv", content: csv }
      );
      expect(res.ok).toBe(true);
      expect(res.msg).toContain("Inserted: 1");
      expect(res.msg).toContain("Skipped (duplicate): 1");
      expect(res.msg).toContain("Error: 1");
    }
  );

  // delete_all wipes the *entire* table with no filter — only the rejection
  // path is exercised here. The real DB carries live jetty rows, and the
  // ticket requires disposable-row-only tests, so this never runs as IT.
  it("rejects delete_all for non-IT users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete_all",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Hanya Divisi IT");
  });
});
