import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { deleteFuelRateRow, readFuelRateRow } from "./fuel-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

interface AjaxResult {
  ok: boolean;
  error?: string;
}

const node = targets.find((t) => t.name.startsWith("Node"))!;

// Per-month PPN/PBBKB/PPH22 rate carry-forward is a Node-only feature — the
// legacy PHP app (VM&FAT/3fuel.php) only ever had one rate per whole year,
// keyed by `tahun`, so it has no equivalent behavior to compare against.
describe("fuel rate carry-forward (Node app only)", () => {
  const vmfatUser = `vmfat_${randomUUID().slice(0, 8)}`;
  const vmfatPassword = "vmfat-test-pass";
  // Years before 2020 so the carry-forward assertions can't inherit an
  // override from any real (non-test) rate change, which only exist from
  // the app's actual usage years (2026+) onward.
  const rateSuffix = String(Math.floor(Math.random() * 20)).padStart(2, "0");
  const rateYear = 2000 + Number(rateSuffix);
  const rateBulanTahun = `Mar-${rateSuffix}`;
  const laterBulanTahun = `Agu-${rateSuffix}`;
  const earlierBulanTahun = `Jan-${rateSuffix}`;

  beforeEach(async () => {
    await seedLegacyUser(vmfatUser, vmfatPassword, "Staff", "VM&FAT");
  });

  afterEach(async () => {
    await deleteUserRow(vmfatUser);
    await deleteFuelRateRow(rateBulanTahun);
  });

  async function loginAsVmfat() {
    const client = new HttpClient(node.baseUrl);
    await client.postForm(node.paths.login, {
      username: vmfatUser,
      password: vmfatPassword,
    });
    return client;
  }

  it("saves a fuel rate keyed by bulan_tahun and persists it", async () => {
    const client = await loginAsVmfat();
    const res = await client.postJsonForm<AjaxResult>(node.paths.fuel, {
      action: "save_fuel_rate",
      bulan_tahun: rateBulanTahun,
      field: "pbbkb_rate",
      value: "8.25",
    });
    expect(res.ok).toBe(true);

    const row = await readFuelRateRow(rateBulanTahun);
    expect(row?.pbbkb_rate).toBe(8.25);
  });

  it("carries a rate change forward to later months but not earlier ones", async () => {
    const client = await loginAsVmfat();
    const saveRes = await client.postJsonForm<AjaxResult>(node.paths.fuel, {
      action: "save_fuel_rate",
      bulan_tahun: rateBulanTahun,
      field: "pbbkb_rate",
      value: "9.99",
    });
    expect(saveRes.ok).toBe(true);

    const laterRes = await client.get(
      `${node.paths.fuel}?tahun=${rateYear}&bulan=Agu`
    );
    expect(laterRes.status).toBe(200);
    expect(laterRes.body).toContain(
      `"${laterBulanTahun}":{"ppnRate":11,"pbbkbRate":9.99`
    );

    const earlierRes = await client.get(
      `${node.paths.fuel}?tahun=${rateYear}&bulan=Jan`
    );
    expect(earlierRes.status).toBe(200);
    expect(earlierRes.body).toContain(
      `"${earlierBulanTahun}":{"ppnRate":11,"pbbkbRate":7.5`
    );
  });
});
