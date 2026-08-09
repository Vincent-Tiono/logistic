import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SHIPPER_TEMPLATE_COLUMNS } from "../../src/services/shipper.service.js";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { deleteShipperRow, seedShipperRow } from "./shipper-fixture.js";
import { targets } from "./targets.js";

interface ShipperRow {
  shipper: string;
  pt: string;
  nama_lengkap: string;
  laytime: string | number | null;
}

interface AjaxResult {
  ok: boolean;
  msg?: string;
  data?: ShipperRow[];
}

// shipper is guarded by the same app-level divisi check as vessel (see
// shipper-gate.node-only.spec.ts for the Node-specific tightening beyond raw
// PHP behavior), so every test here authenticates as either an IT or an
// Operation user. Unlike vessel, shipper has no enum fields (pt/nama_lengkap
// are free text), so there is no "invalid enum treated as blank" test here.
describe.each(targets)("shipper — $name", (target) => {
  const itUser = `it_${randomUUID().slice(0, 8)}`;
  const itPassword = "it-test-pass";
  const opUser = `op_${randomUUID().slice(0, 8)}`;
  const opPassword = "op-test-pass";
  const managedShipper = `CH${randomUUID().slice(0, 6)}`.toUpperCase();
  const importedShipper = `${managedShipper}N`;

  beforeEach(async () => {
    await seedLegacyUser(itUser, itPassword, "Staff", "IT");
    await seedLegacyUser(opUser, opPassword, "Staff", "Operation");
  });

  afterEach(async () => {
    await deleteUserRow(itUser);
    await deleteUserRow(opUser);
    await deleteShipperRow(managedShipper);
    await deleteShipperRow(importedShipper);
  });

  async function loginAs(username: string, password: string) {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, { username, password });
    return client;
  }

  function ajaxUrl() {
    return `${target.paths.shipper}?ajax=1`;
  }

  function listUrl(q: string) {
    return `${target.paths.shipper}?ajax=1&action=list&q=${encodeURIComponent(q)}`;
  }

  it("redirects to login when no session", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get(target.paths.shipper);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("renders the page for Operation users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.get(target.paths.shipper);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Shipper");
  });

  it("validates required fields on create", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      shipper: "",
      pt: "",
      nama_lengkap: "",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("wajib diisi");
  });

  it("creates, lists, updates, and deletes a shipper end-to-end", async () => {
    const client = await loginAs(opUser, opPassword);

    const created = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      shipper: managedShipper.toLowerCase(),
      pt: "PT. TEST HARAPAN",
      nama_lengkap: "PT TEST HARAPAN\nJL. TEST NO. 1",
      laytime: "9",
    });
    expect(created.ok).toBe(true);
    expect(created.msg).toContain("berhasil ditambah");

    const duplicate = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      shipper: managedShipper,
      pt: "PT. TEST HARAPAN",
      nama_lengkap: "PT TEST HARAPAN",
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.msg).toContain("sudah ada");

    const listed = await client.get(listUrl(managedShipper));
    const listedJson = JSON.parse(listed.body) as AjaxResult;
    expect(listedJson.ok).toBe(true);
    const row = listedJson.data?.find((r) => r.shipper === managedShipper);
    // shipper code is uppercased on write, even when posted lowercase
    expect(row).toBeDefined();
    expect(Number(row?.laytime)).toBe(9);

    const updated = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "update",
      shipper: managedShipper,
      pt: "PT. TEST HARAPAN UPDATED",
      nama_lengkap: "PT TEST HARAPAN UPDATED",
      laytime: "5",
    });
    expect(updated.ok).toBe(true);
    expect(updated.msg).toContain("berhasil diupdate");

    const deleted = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete",
      shipper: managedShipper,
    });
    expect(deleted.ok).toBe(true);
    expect(deleted.msg).toContain("berhasil dihapus");
  });

  it("stores a non-numeric laytime as null instead of rejecting it", async () => {
    const client = await loginAs(opUser, opPassword);

    const created = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      shipper: managedShipper,
      pt: "PT. TEST HARAPAN",
      nama_lengkap: "PT TEST HARAPAN",
      laytime: "abc",
    });
    expect(created.ok).toBe(true);

    const listed = await client.get(listUrl(managedShipper));
    const listedJson = JSON.parse(listed.body) as AjaxResult;
    const row = listedJson.data?.find((r) => r.shipper === managedShipper);
    expect(row).toBeDefined();
    expect(row?.laytime === null || row?.laytime === "").toBe(true);
  });

  it("rejects import_csv for non-IT users", async () => {
    const client = await loginAs(opUser, opPassword);
    const csv = "shipper,pt,nama_lengkap,laytime\n";
    const res = await client.postJsonMultipart<AjaxResult>(
      ajaxUrl(),
      { action: "import_csv" },
      { fieldName: "csv", filename: "shipper.csv", content: csv }
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
    "imports valid rows, skips duplicate shipper codes, and counts invalid rows as errors (IT only)",
    async () => {
      const client = await loginAs(itUser, itPassword);
      await seedShipperRow({
        shipper: managedShipper,
        pt: "PT. TEST HARAPAN",
        nama_lengkap: "PT TEST HARAPAN",
      });

      const header = "shipper,pt,nama_lengkap,laytime";
      const dupRow = `${managedShipper},PT. TEST HARAPAN,PT TEST HARAPAN,9`;
      const newRow = `${importedShipper},PT. NEW HARAPAN,PT NEW HARAPAN,5`;
      const badRow = `,PT. BAD,,3`;
      const csv = [header, dupRow, newRow, badRow].join("\n") + "\n";

      const res = await client.postJsonMultipart<AjaxResult>(
        ajaxUrl(),
        { action: "import_csv" },
        { fieldName: "csv", filename: "shipper.csv", content: csv }
      );
      expect(res.ok).toBe(true);
      expect(res.msg).toContain("Inserted: 1");
      expect(res.msg).toContain("Skipped (duplicate): 1");
      expect(res.msg).toContain("Error: 1");
    }
  );

  // delete_all wipes the *entire* table with no filter — only the rejection
  // path is exercised here. The real DB carries live shipper rows, and the
  // ticket requires disposable-row-only tests, so this never runs as IT.
  it("rejects delete_all for non-IT users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete_all",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Hanya Divisi IT");
  });

  describe("download=shipper_template", () => {
    it("returns the template CSV with the expected header and filename", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(`${target.paths.shipper}?download=shipper_template`);
      expect(res.status).toBe(200);
      expect(res.contentType).toContain("text/csv");
      expect(res.contentDisposition).toContain("shipper_template.csv");
      // .toContain, not .toBe: this repo's local PHP 8.5 prints a fputcsv()
      // $escape-param deprecation notice ahead of each CSV line (legacy PHP
      // predates that deprecation) — an environment quirk, not a behavior
      // difference worth characterizing line-for-line here.
      expect(res.body).toContain(SHIPPER_TEMPLATE_COLUMNS.join(","));
    });
  });
});
