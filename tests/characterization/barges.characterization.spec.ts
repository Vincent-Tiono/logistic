import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { deleteBargesRowsByTugboat } from "./barges-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

interface BargesRow {
  id: number;
  tugboat: string;
  barge: string;
  vendor: string | null;
  kontrak: string | null;
  muatan: string | number | null;
  penalty: string | null;
}

interface AjaxResult {
  ok: boolean;
  msg?: string;
  data?: BargesRow[];
}

// Barges is structurally simpler than Vendor: no cross-table shipper lookup,
// no computed defaults — just clean()/toDecimal() on free-text fields. It
// still shares Vendor's two distinguishing traits: an auto-increment `id`
// PK (so create doesn't return an identity — tests look rows up via `list`
// by a unique random tugboat name) and a sort/dir whitelist on `list`.
describe.each(targets)("barges — $name", (target) => {
  const opUser = `op_${randomUUID().slice(0, 8)}`;
  const opPassword = "op-test-pass";
  const itUser = `it_${randomUUID().slice(0, 8)}`;
  const itPassword = "it-test-pass";

  let createdTugboats: string[] = [];

  beforeEach(async () => {
    createdTugboats = [];
    await seedLegacyUser(opUser, opPassword, "Staff", "Operation");
    await seedLegacyUser(itUser, itPassword, "Staff", "IT");
  });

  afterEach(async () => {
    await deleteUserRow(opUser);
    await deleteUserRow(itUser);
    for (const tugboat of createdTugboats) await deleteBargesRowsByTugboat(tugboat);
  });

  async function loginAs(username: string, password: string) {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, { username, password });
    return client;
  }

  function ajaxUrl() {
    return `${target.paths.barges}?ajax=1`;
  }

  function listUrl(q: string, sort?: string, dir?: string) {
    let url = `${target.paths.barges}?ajax=1&action=list&q=${encodeURIComponent(q)}`;
    if (sort !== undefined) url += `&sort=${encodeURIComponent(sort)}`;
    if (dir !== undefined) url += `&dir=${encodeURIComponent(dir)}`;
    return url;
  }

  function tugboatName(): string {
    const name = `TB${randomUUID().slice(0, 8)}`;
    createdTugboats.push(name);
    return name;
  }

  async function findByTugboat(
    client: HttpClient,
    tugboat: string
  ): Promise<BargesRow | undefined> {
    const res = await client.get(listUrl(tugboat));
    const json = JSON.parse(res.body) as AjaxResult;
    return json.data?.find((r) => r.tugboat === tugboat);
  }

  it("redirects to login when no session", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get(target.paths.barges);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("renders the page for Operation users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.get(target.paths.barges);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Barges");
  });

  it("validates required tugboat/barge fields on create", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      tugboat: "",
      barge: "",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("wajib diisi");

    const missingBarge = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      tugboat: tugboatName(),
      barge: "",
    });
    expect(missingBarge.ok).toBe(false);
    expect(missingBarge.msg).toContain("wajib diisi");
  });

  it("applies toDecimal's thousands-dot normalization to muatan", async () => {
    const client = await loginAs(opUser, opPassword);
    const name = tugboatName();

    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      tugboat: name,
      barge: "BG. TEST",
      vendor: "BMC",
      kontrak: "DEDICATED",
      muatan: "8.200", // thousands-dot form -> 8200, not 8.2
      penalty: "Deadfreight",
    });
    expect(res.ok).toBe(true);

    const row = await findByTugboat(client, name);
    expect(Number(row?.muatan)).toBe(8200);
    expect(row?.vendor).toBe("BMC");
    expect(row?.kontrak).toBe("DEDICATED");
    expect(row?.penalty).toBe("Deadfreight");
  });

  it("sorts list results against a column whitelist, falling back to tugboat/ASC for invalid sort/dir", async () => {
    const client = await loginAs(opUser, opPassword);
    const prefix = `SRT${randomUUID().slice(0, 6)}`;
    const nameA = `${prefix}_A`;
    const nameB = `${prefix}_B`;
    const nameC = `${prefix}_C`;
    createdTugboats.push(nameA, nameB, nameC);

    for (const [name, muatan] of [
      [nameA, "100"],
      [nameB, "300"],
      [nameC, "200"],
    ] as const) {
      const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
        action: "create",
        tugboat: name,
        barge: "BG. TEST",
        muatan,
      });
      expect(res.ok).toBe(true);
    }

    const desc = await client.get(listUrl(prefix, "muatan", "DESC"));
    const descJson = JSON.parse(desc.body) as AjaxResult;
    expect(descJson.data?.map((r) => r.tugboat)).toEqual([nameB, nameC, nameA]);

    // invalid sort/dir must not error and must fall back to tugboat ASC
    const bogus = await client.get(
      listUrl(prefix, "id; DROP TABLE barges;--", "SIDEWAYS")
    );
    expect(bogus.status).toBe(200);
    const bogusJson = JSON.parse(bogus.body) as AjaxResult;
    expect(bogusJson.ok).toBe(true);
    expect(bogusJson.data?.map((r) => r.tugboat)).toEqual([nameA, nameB, nameC]);
  });

  it("updates and deletes a barges row by id", async () => {
    const client = await loginAs(opUser, opPassword);
    const name = tugboatName();

    await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      tugboat: name,
      barge: "BG. ORIGINAL",
      muatan: "1",
    });
    const row = await findByTugboat(client, name);
    expect(row).toBeDefined();
    const id = String(row?.id);

    const updated = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "update",
      id,
      tugboat: name,
      barge: "BG. UPDATED",
      muatan: "42",
    });
    expect(updated.ok).toBe(true);
    expect(updated.msg).toContain("berhasil diupdate");
    const updatedRow = await findByTugboat(client, name);
    expect(updatedRow?.barge).toBe("BG. UPDATED");
    expect(Number(updatedRow?.muatan)).toBe(42);

    const deleted = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete",
      id,
    });
    expect(deleted.ok).toBe(true);
    expect(deleted.msg).toContain("berhasil dihapus");
    expect(await findByTugboat(client, name)).toBeUndefined();
  });

  it("rejects update with an invalid id and delete with an empty id", async () => {
    const client = await loginAs(opUser, opPassword);

    const updated = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "update",
      id: "0",
      tugboat: "whatever",
      barge: "whatever",
    });
    expect(updated.ok).toBe(false);
    expect(updated.msg).toContain("tidak valid");

    const deleted = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete",
      id: "0",
    });
    expect(deleted.ok).toBe(false);
    expect(deleted.msg).toContain("ID kosong");
  });

  it("rejects import_csv for non-IT users", async () => {
    const client = await loginAs(opUser, opPassword);
    const csv = "tugboat,barge,vendor,kontrak,muatan,penalty\n";
    const res = await client.postJsonMultipart<AjaxResult>(
      ajaxUrl(),
      { action: "import_csv" },
      { fieldName: "csv", filename: "barges.csv", content: csv }
    );
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Hanya Divisi IT");
  });

  // Same PHP 8.5 `fgetcsv()` deprecation-notice-in-response-body carve-out as
  // vessel/shipper/vendor — Node-only.
  it.skipIf(target.name.startsWith("PHP"))(
    "imports valid rows, counting blank-tugboat/barge rows as errors (IT only)",
    async () => {
      const client = await loginAs(itUser, itPassword);
      const name = tugboatName();

      const header = "tugboat,barge,vendor,kontrak,muatan,penalty";
      const goodRow = `${name},BG. IMPORTED,BMC,DEDICATED,8200,Deadfreight`;
      const badRow = `,BG. NOBOAT,BMC,DEDICATED,8200,Deadfreight`;
      const csv = [header, goodRow, badRow].join("\n") + "\n";

      const res = await client.postJsonMultipart<AjaxResult>(
        ajaxUrl(),
        { action: "import_csv" },
        { fieldName: "csv", filename: "barges.csv", content: csv }
      );
      expect(res.ok).toBe(true);
      expect(res.msg).toContain("Inserted: 1");
      expect(res.msg).toContain("Error: 1");

      const row = await findByTugboat(client, name);
      expect(row).toBeDefined();
      expect(row?.barge).toBe("BG. IMPORTED");
      expect(Number(row?.muatan)).toBe(8200);
    }
  );

  // delete_all wipes the *entire* table with no filter — only the rejection
  // path is exercised here, same as vessel/shipper/vendor.
  it("rejects delete_all for non-IT users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete_all",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Hanya Divisi IT");
  });
});
