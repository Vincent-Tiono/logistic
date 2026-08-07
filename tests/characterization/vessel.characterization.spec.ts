import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";
import { deleteVesselRow, seedVesselRow } from "./vessel-fixture.js";

interface VesselRow {
  no_pk: string;
  no_si_vessel: string;
  buyer: string;
  mothervessel: string;
  anchorage: string;
  term: string;
  stowageplan_mt: string;
}

interface AjaxResult {
  ok: boolean;
  msg?: string;
  data?: VesselRow[];
}

// vessel is guarded by an app-level divisi check (see vessel-gate.node-only.spec.ts
// for the Node-specific tightening beyond raw PHP behavior), so every test here
// authenticates as either an IT or an Operation user.
describe.each(targets)("vessel — $name", (target) => {
  const itUser = `it_${randomUUID().slice(0, 8)}`;
  const itPassword = "it-test-pass";
  const opUser = `op_${randomUUID().slice(0, 8)}`;
  const opPassword = "op-test-pass";
  const managedNoPk = `char_${randomUUID().slice(0, 8)}`;
  const importedNoPk = `${managedNoPk}_new`;

  beforeEach(async () => {
    await seedLegacyUser(itUser, itPassword, "Staff", "IT");
    await seedLegacyUser(opUser, opPassword, "Staff", "Operation");
  });

  afterEach(async () => {
    await deleteUserRow(itUser);
    await deleteUserRow(opUser);
    await deleteVesselRow(managedNoPk);
    await deleteVesselRow(importedNoPk);
  });

  async function loginAs(username: string, password: string) {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, { username, password });
    return client;
  }

  function ajaxUrl() {
    return `${target.paths.vessel}?ajax=1`;
  }

  function listUrl(q: string) {
    return `${target.paths.vessel}?ajax=1&action=list&q=${encodeURIComponent(q)}`;
  }

  it("redirects to login when no session", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get(target.paths.vessel);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("renders the page for Operation users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.get(target.paths.vessel);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Vessel");
  });

  it("validates required fields on create", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      no_pk: "",
      no_si_vessel: "",
      buyer: "",
      mothervessel: "",
      anchorage: "",
      term: "",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("wajib diisi");
  });

  it("treats an invalid anchorage as blank, failing required-field validation", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      no_pk: managedNoPk,
      no_si_vessel: "060",
      buyer: "BCPCL",
      mothervessel: "MV. TEST",
      anchorage: "NOT A REAL PLACE",
      term: "FOB",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("wajib diisi");
  });

  it("creates, lists, updates, and deletes a vessel end-to-end", async () => {
    const client = await loginAs(opUser, opPassword);

    const created = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      no_pk: managedNoPk,
      no_si_vessel: "060",
      buyer: "BCPCL",
      mothervessel: "MV. KENZEN",
      anchorage: "muara berau",
      term: "fob",
      laycan_start: "2025-11-05",
      laycan_end: "2025-11-14",
      single_mt: "60500",
      blending_mt: "0",
      stowageplan_mt: "0",
      loading_rate_kontrak: "10000",
    });
    expect(created.ok).toBe(true);
    expect(created.msg).toContain("berhasil ditambah");

    const duplicate = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      no_pk: managedNoPk,
      no_si_vessel: "060",
      buyer: "BCPCL",
      mothervessel: "MV. KENZEN",
      anchorage: "MUARA BERAU",
      term: "FOB",
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.msg).toContain("sudah ada");

    const listed = await client.get(listUrl(managedNoPk));
    const listedJson = JSON.parse(listed.body) as AjaxResult;
    expect(listedJson.ok).toBe(true);
    const row = listedJson.data?.find((r) => r.no_pk === managedNoPk);
    expect(row).toBeDefined();
    expect(row?.anchorage).toBe("MUARA BERAU");
    expect(row?.term).toBe("FOB");
    // stowage auto-sums single+blending when posted as 0
    expect(Number(row?.stowageplan_mt)).toBe(60500);

    const updated = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "update",
      no_pk: managedNoPk,
      no_si_vessel: "060",
      buyer: "BCPCL",
      mothervessel: "MV. KENZEN II",
      anchorage: "MUARA JAWA",
      term: "CIF",
    });
    expect(updated.ok).toBe(true);
    expect(updated.msg).toContain("berhasil diupdate");

    const deleted = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete",
      no_pk: managedNoPk,
    });
    expect(deleted.ok).toBe(true);
    expect(deleted.msg).toContain("berhasil dihapus");
  });

  it("rejects import_csv for non-IT users", async () => {
    const client = await loginAs(opUser, opPassword);
    const csv =
      "no_pk,no_si_vessel,buyer,mothervessel,anchorage,term,laycan_start,laycan_end,ta_vessel,single_mt,blending_mt,stowageplan_mt,loading_rate_kontrak\n";
    const res = await client.postJsonMultipart<AjaxResult>(
      ajaxUrl(),
      { action: "import_csv" },
      { fieldName: "csv", filename: "vessel.csv", content: csv }
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
    "imports valid rows, skips duplicate No. Reff, and counts invalid rows as errors (IT only)",
    async () => {
      const client = await loginAs(itUser, itPassword);
      await seedVesselRow({
        no_pk: managedNoPk,
        no_si_vessel: "060",
        buyer: "BCPCL",
        mothervessel: "MV. KENZEN",
        anchorage: "MUARA BERAU",
        term: "FOB",
      });

      const header =
        "no_pk,no_si_vessel,buyer,mothervessel,anchorage,term,laycan_start,laycan_end,ta_vessel,pkk,rkbm,single_mt,blending_mt,stowageplan_mt,loading_rate_kontrak";
      const dupRow = `${managedNoPk},060,BCPCL,MV. KENZEN,MUARA BERAU,FOB,,,,,,0,0,0,0`;
      const newRow = `${importedNoPk},061,BCPCL,MV. NEW,MUARA JAWA,CIF,,,,,,1000,0,0,0`;
      const badRow = `,061,,,,,,,,,,0,0,0,0`;
      const csv = [header, dupRow, newRow, badRow].join("\n") + "\n";

      const res = await client.postJsonMultipart<AjaxResult>(
        ajaxUrl(),
        { action: "import_csv" },
        { fieldName: "csv", filename: "vessel.csv", content: csv }
      );
      expect(res.ok).toBe(true);
      expect(res.msg).toContain("Inserted: 1");
      expect(res.msg).toContain("Skipped (duplicate No. Reff): 1");
      expect(res.msg).toContain("Error: 1");
    }
  );

  // delete_all wipes the *entire* table with no filter — only the rejection
  // path is exercised here. The real DB carries live vessel rows, and the
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
