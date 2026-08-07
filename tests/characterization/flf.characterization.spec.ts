import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { deleteFlfRow, seedFlfRow } from "./flf-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

interface FlfRow {
  floating_crane: string;
  vendor_flf: string;
  pbm: string;
  anchorage: string;
}

interface AjaxResult {
  ok: boolean;
  msg?: string;
  data?: FlfRow[];
}

// flf is guarded by the same app-level divisi check as jetty (see
// flf-gate.node-only.spec.ts for the Node-specific tightening beyond raw
// PHP behavior). Only floating_crane is uppercase-normalized on write;
// vendor_flf/pbm/anchorage are trimmed only, per the ticket.
describe.each(targets)("flf — $name", (target) => {
  const itUser = `it_${randomUUID().slice(0, 8)}`;
  const itPassword = "it-test-pass";
  const opUser = `op_${randomUUID().slice(0, 8)}`;
  const opPassword = "op-test-pass";
  const managedFlf = `FC${randomUUID().slice(0, 6)}`.toUpperCase();
  const importedFlf = `${managedFlf}N`;

  beforeEach(async () => {
    await seedLegacyUser(itUser, itPassword, "Staff", "IT");
    await seedLegacyUser(opUser, opPassword, "Staff", "Operation");
  });

  afterEach(async () => {
    await deleteUserRow(itUser);
    await deleteUserRow(opUser);
    await deleteFlfRow(managedFlf);
    await deleteFlfRow(importedFlf);
  });

  async function loginAs(username: string, password: string) {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, { username, password });
    return client;
  }

  function ajaxUrl() {
    return `${target.paths.flf}?ajax=1`;
  }

  function listUrl(q: string) {
    return `${target.paths.flf}?ajax=1&action=list&q=${encodeURIComponent(q)}`;
  }

  it("redirects to login when no session", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get(target.paths.flf);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("renders the page for Operation users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.get(target.paths.flf);
    expect(res.status).toBe(200);
    expect(res.body).toContain("FLF");
  });

  it("validates required fields on create", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      floating_crane: "",
      vendor_flf: "",
      pbm: "",
      anchorage: "",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("wajib diisi");
  });

  it("creates, lists, updates, and deletes an flf end-to-end", async () => {
    const client = await loginAs(opUser, opPassword);

    const created = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      floating_crane: managedFlf.toLowerCase(),
      vendor_flf: "PSS",
      pbm: "FLOATING CRANE",
      anchorage: "M.BERAU",
    });
    expect(created.ok).toBe(true);
    expect(created.msg).toContain("berhasil ditambah");

    const duplicate = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      floating_crane: managedFlf,
      vendor_flf: "PSS",
      pbm: "FLOATING CRANE",
      anchorage: "M.BERAU",
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.msg).toContain("sudah ada");

    const listed = await client.get(listUrl(managedFlf));
    const listedJson = JSON.parse(listed.body) as AjaxResult;
    expect(listedJson.ok).toBe(true);
    const row = listedJson.data?.find(
      (r) => r.floating_crane === managedFlf
    );
    // floating_crane is uppercased on write, even when posted lowercase
    expect(row).toBeDefined();

    const updated = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "update",
      floating_crane: managedFlf,
      vendor_flf: "MLS",
      pbm: "STEVEDORE",
      anchorage: "M.JAWA",
    });
    expect(updated.ok).toBe(true);
    expect(updated.msg).toContain("berhasil diupdate");

    const deleted = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete",
      floating_crane: managedFlf,
    });
    expect(deleted.ok).toBe(true);
    expect(deleted.msg).toContain("berhasil dihapus");
  });

  it("rejects update with a blank required field", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "update",
      floating_crane: managedFlf,
      vendor_flf: "",
      pbm: "STEVEDORE",
      anchorage: "M.JAWA",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Data update tidak valid");
  });

  it("rejects delete with an empty floating_crane code", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete",
      floating_crane: "",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Floating Crane kosong");
  });

  it("rejects import_csv for non-IT users", async () => {
    const client = await loginAs(opUser, opPassword);
    const csv = "floating_crane,vendor_flf,pbm,anchorage\n";
    const res = await client.postJsonMultipart<AjaxResult>(
      ajaxUrl(),
      { action: "import_csv" },
      { fieldName: "csv", filename: "flf.csv", content: csv }
    );
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Hanya Divisi IT");
  });

  // Same PHP 8.5 `php -S` fgetcsv() deprecation-notice-in-body artifact as
  // Jetty (#7) — Node-only per the ticket's CSV-parity carve-out.
  it.skipIf(target.name.startsWith("PHP"))(
    "imports valid rows, skips duplicate floating_crane, and counts invalid rows as errors (IT only)",
    async () => {
      const client = await loginAs(itUser, itPassword);
      await seedFlfRow({
        floating_crane: managedFlf,
        vendor_flf: "PSS",
        pbm: "FLOATING CRANE",
        anchorage: "M.BERAU",
      });

      const header = "floating_crane,vendor_flf,pbm,anchorage";
      const dupRow = `${managedFlf},PSS,FLOATING CRANE,M.BERAU`;
      const newRow = `${importedFlf},MLS,STEVEDORE,M.JAWA`;
      const badRow = ",,,";
      const csv = [header, dupRow, newRow, badRow].join("\n") + "\n";

      const res = await client.postJsonMultipart<AjaxResult>(
        ajaxUrl(),
        { action: "import_csv" },
        { fieldName: "csv", filename: "flf.csv", content: csv }
      );
      expect(res.ok).toBe(true);
      expect(res.msg).toContain("Inserted: 1");
      expect(res.msg).toContain("Skipped (duplicate): 1");
      expect(res.msg).toContain("Error: 1");
    }
  );

  // delete_all wipes the *entire* table with no filter — only the rejection
  // path is exercised here, same precedent as Jetty.
  it("rejects delete_all for non-IT users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete_all",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Hanya Divisi IT");
  });
});
