import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { deleteShipperRow, seedShipperRow } from "./shipper-fixture.js";
import { targets } from "./targets.js";
import { deleteVendorRowsByName } from "./vendor-fixture.js";

interface VendorRow {
  id: number;
  vendor: string;
  shipper: string | null;
  freight: string | number | null;
  tonnage: string | number | null;
  penalty: string | null;
  discount: string | number | null;
  contract: string | null;
  laytime: string | number | null;
  ltc_rate: string | number | null;
}

interface AjaxResult {
  ok: boolean;
  msg?: string;
  data?: VendorRow[];
}

// Vendor differs from Vessel/Shipper in three ways this suite pins down:
// (1) PK is an auto-increment `id`, not a natural key, so create doesn't
//     return an identity — tests look the row up via `list` by its (unique,
//     randomly-suffixed) vendor name to get the id for update/delete;
// (2) create/update/import_csv compute freight/contract/laytime/ltc_rate
//     defaults from a shipper cross-reference when the field is posted
//     blank — the core business rule this ticket calls out;
// (3) `list` accepts sort/dir query params validated against a whitelist.
describe.each(targets)("vendor — $name", (target) => {
  const opUser = `op_${randomUUID().slice(0, 8)}`;
  const opPassword = "op-test-pass";
  const itUser = `it_${randomUUID().slice(0, 8)}`;
  const itPassword = "it-test-pass";

  let createdVendorNames: string[] = [];
  let createdShipperCodes: string[] = [];

  beforeEach(async () => {
    createdVendorNames = [];
    createdShipperCodes = [];
    await seedLegacyUser(opUser, opPassword, "Staff", "Operation");
    await seedLegacyUser(itUser, itPassword, "Staff", "IT");
  });

  afterEach(async () => {
    await deleteUserRow(opUser);
    await deleteUserRow(itUser);
    for (const name of createdVendorNames) await deleteVendorRowsByName(name);
    for (const code of createdShipperCodes) await deleteShipperRow(code);
  });

  async function loginAs(username: string, password: string) {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, { username, password });
    return client;
  }

  function ajaxUrl() {
    return `${target.paths.vendor}?ajax=1`;
  }

  function listUrl(q: string, sort?: string, dir?: string) {
    let url = `${target.paths.vendor}?ajax=1&action=list&q=${encodeURIComponent(q)}`;
    if (sort !== undefined) url += `&sort=${encodeURIComponent(sort)}`;
    if (dir !== undefined) url += `&dir=${encodeURIComponent(dir)}`;
    return url;
  }

  function vendorName(): string {
    const name = `V${randomUUID().slice(0, 8)}`;
    createdVendorNames.push(name);
    return name;
  }

  async function findByName(
    client: HttpClient,
    name: string
  ): Promise<VendorRow | undefined> {
    const res = await client.get(listUrl(name));
    const json = JSON.parse(res.body) as AjaxResult;
    return json.data?.find((r) => r.vendor === name);
  }

  it("redirects to login when no session", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get(target.paths.vendor);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("renders the page for Operation users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.get(target.paths.vendor);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Vendor");
  });

  it("validates required vendor field on create", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: "",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("wajib diisi");
  });

  it("computes freight/contract/ltc_rate from a hardcoded shipper lookup when blank (MHU/CAM/unknown)", async () => {
    const client = await loginAs(opUser, opPassword);
    const nameMhu = vendorName();
    const nameCam = vendorName();
    const nameOther = vendorName();

    const mhu = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: nameMhu,
      shipper: "MHU",
      tonnage: "100",
      laytime: "9", // explicit, to avoid depending on real shipper-table data
    });
    expect(mhu.ok).toBe(true);
    const mhuRow = await findByName(client, nameMhu);
    expect(Number(mhuRow?.freight)).toBe(51500);
    expect(String(mhuRow?.contract)).toBe("3");
    expect(Number(mhuRow?.ltc_rate)).toBe(515000); // round(51500*100*3/30)

    const cam = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: nameCam,
      shipper: "CAM",
      tonnage: "100",
      laytime: "9",
    });
    expect(cam.ok).toBe(true);
    const camRow = await findByName(client, nameCam);
    expect(Number(camRow?.freight)).toBe(85000);
    expect(String(camRow?.contract)).toBe("2");
    expect(Number(camRow?.ltc_rate)).toBe(566667); // round(85000*100*2/30)

    const other = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: nameOther,
      shipper: "ZZZUNKNOWN",
      tonnage: "100",
      laytime: "9",
    });
    expect(other.ok).toBe(true);
    const otherRow = await findByName(client, nameOther);
    expect(Number(otherRow?.freight)).toBe(0);
    expect(String(otherRow?.contract ?? "")).toBe("");
    expect(Number(otherRow?.ltc_rate)).toBe(0);
  });

  it("looks up laytime default from the shipper table when blank, falling back to 0 for an unknown shipper", async () => {
    const client = await loginAs(opUser, opPassword);
    const shipperCode = `LT${randomUUID().slice(0, 6)}`.toUpperCase();
    createdShipperCodes.push(shipperCode);
    await seedShipperRow({
      shipper: shipperCode,
      pt: "PT. TEST LAYTIME",
      nama_lengkap: "PT TEST LAYTIME",
      laytime: 7,
    });

    const nameKnown = vendorName();
    const known = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: nameKnown,
      shipper: shipperCode,
      freight: "100",
      contract: "1",
      tonnage: "10",
    });
    expect(known.ok).toBe(true);
    const knownRow = await findByName(client, nameKnown);
    expect(Number(knownRow?.laytime)).toBe(7);
    expect(Number(knownRow?.ltc_rate)).toBe(33); // round(100*10*1/30) = round(33.33)

    const nameUnknown = vendorName();
    const unknown = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: nameUnknown,
      shipper: `NOSUCH${randomUUID().slice(0, 6)}`,
      freight: "100",
      contract: "1",
      tonnage: "10",
    });
    expect(unknown.ok).toBe(true);
    const unknownRow = await findByName(client, nameUnknown);
    expect(Number(unknownRow?.laytime)).toBe(0);
  });

  it("uses explicitly posted values over computed defaults, applying toDecimal's thousands-dot normalization", async () => {
    const client = await loginAs(opUser, opPassword);
    const name = vendorName();

    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: name,
      shipper: "MHU",
      freight: "8.200", // thousands-dot form -> 8200, not 8.2
      discount: "8.20", // genuine decimal (only 2 digits after dot) -> 8.2
      contract: "99",
      tonnage: "1",
      laytime: "3",
      ltc_rate: "123456",
    });
    expect(res.ok).toBe(true);

    const row = await findByName(client, name);
    expect(Number(row?.freight)).toBe(8200);
    expect(Number(row?.discount)).toBe(8.2);
    expect(String(row?.contract)).toBe("99");
    expect(Number(row?.laytime)).toBe(3);
    expect(Number(row?.ltc_rate)).toBe(123456);
  });

  it("normalizes penalty to DF/CQD/null, unconditionally", async () => {
    const client = await loginAs(opUser, opPassword);

    const nameDf = vendorName();
    await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: nameDf,
      penalty: "df",
    });
    expect((await findByName(client, nameDf))?.penalty).toBe("DF");

    const nameCqd = vendorName();
    await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: nameCqd,
      penalty: "CQD",
    });
    expect((await findByName(client, nameCqd))?.penalty).toBe("CQD");

    const nameInvalid = vendorName();
    await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: nameInvalid,
      penalty: "bogus",
    });
    expect((await findByName(client, nameInvalid))?.penalty).toBeNull();
  });

  it("sorts list results against a column whitelist, falling back to vendor/ASC for invalid sort/dir", async () => {
    const client = await loginAs(opUser, opPassword);
    const prefix = `SRT${randomUUID().slice(0, 6)}`;
    const nameA = `${prefix}_A`;
    const nameB = `${prefix}_B`;
    const nameC = `${prefix}_C`;
    createdVendorNames.push(nameA, nameB, nameC);

    for (const [name, freight] of [
      [nameA, "100"],
      [nameB, "300"],
      [nameC, "200"],
    ] as const) {
      const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
        action: "create",
        vendor: name,
        shipper: "OTHER",
        freight,
        tonnage: "1",
        laytime: "0",
      });
      expect(res.ok).toBe(true);
    }

    const desc = await client.get(listUrl(prefix, "freight", "DESC"));
    const descJson = JSON.parse(desc.body) as AjaxResult;
    expect(descJson.data?.map((r) => r.vendor)).toEqual([nameB, nameC, nameA]);

    // invalid sort/dir must not error and must fall back to vendor ASC
    const bogus = await client.get(
      listUrl(prefix, "id; DROP TABLE vendor;--", "SIDEWAYS")
    );
    expect(bogus.status).toBe(200);
    const bogusJson = JSON.parse(bogus.body) as AjaxResult;
    expect(bogusJson.ok).toBe(true);
    expect(bogusJson.data?.map((r) => r.vendor)).toEqual([nameA, nameB, nameC]);
  });

  it("updates and deletes a vendor by id", async () => {
    const client = await loginAs(opUser, opPassword);
    const name = vendorName();

    await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "create",
      vendor: name,
      shipper: "OTHER",
      freight: "1",
      tonnage: "1",
      laytime: "0",
    });
    const row = await findByName(client, name);
    expect(row).toBeDefined();
    const id = String(row?.id);

    const updated = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "update",
      id,
      vendor: name,
      shipper: "OTHER",
      tonnage: "42",
      freight: "1",
      laytime: "0",
    });
    expect(updated.ok).toBe(true);
    expect(updated.msg).toContain("berhasil diupdate");
    const updatedRow = await findByName(client, name);
    expect(Number(updatedRow?.tonnage)).toBe(42);

    const deleted = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete",
      id,
    });
    expect(deleted.ok).toBe(true);
    expect(deleted.msg).toContain("berhasil dihapus");
    expect(await findByName(client, name)).toBeUndefined();
  });

  it("rejects update with an invalid id and delete with an empty id", async () => {
    const client = await loginAs(opUser, opPassword);

    const updated = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "update",
      id: "0",
      vendor: "whatever",
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
    const csv = "vendor,shipper,tonnage,penalty,discount,contract,laytime,ltc_rate\n";
    const res = await client.postJsonMultipart<AjaxResult>(
      ajaxUrl(),
      { action: "import_csv" },
      { fieldName: "csv", filename: "vendor.csv", content: csv }
    );
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Hanya Divisi IT");
  });

  // Same PHP 8.5 `fgetcsv()` deprecation-notice-in-response-body carve-out as
  // vessel/shipper (see shipper.characterization.spec.ts) — Node-only.
  it.skipIf(target.name.startsWith("PHP"))(
    "imports valid rows applying computed defaults, counting blank-vendor rows as errors (IT only)",
    async () => {
      const client = await loginAs(itUser, itPassword);
      const name = vendorName();

      const header = "vendor,shipper,tonnage,penalty,discount,contract,laytime,ltc_rate";
      // freight column omitted entirely -> derived from shipper=MHU; contract
      // left blank -> derived (3); ltc_rate left blank -> computed from the
      // resolved freight/tonnage/contract.
      const goodRow = `${name},MHU,50,DF,0,,5,`;
      const badRow = `,MHU,10,DF,0,,5,`;
      const csv = [header, goodRow, badRow].join("\n") + "\n";

      const res = await client.postJsonMultipart<AjaxResult>(
        ajaxUrl(),
        { action: "import_csv" },
        { fieldName: "csv", filename: "vendor.csv", content: csv }
      );
      expect(res.ok).toBe(true);
      expect(res.msg).toContain("Inserted: 1");
      expect(res.msg).toContain("Error: 1");

      const row = await findByName(client, name);
      expect(row).toBeDefined();
      expect(Number(row?.freight)).toBe(51500);
      expect(String(row?.contract)).toBe("3");
      expect(Number(row?.ltc_rate)).toBe(257500); // round(51500*50*3/30)
    }
  );

  // delete_all wipes the *entire* table with no filter — only the rejection
  // path is exercised here, same as vessel/shipper.
  it("rejects delete_all for non-IT users", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.postJsonForm<AjaxResult>(ajaxUrl(), {
      action: "delete_all",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Hanya Divisi IT");
  });
});
