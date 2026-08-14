import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { deleteFuelRateRow, deleteFuelRow } from "./fuel-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

interface AjaxResult {
  ok: boolean;
  error?: string;
}

const node = targets.find((t) => t.name.startsWith("Node"))!;

// Fuel & Kurs's Barges MHU daily engine used to compute PPN/PBBKB/PPH22 with
// a hardcoded constant instead of fuel.service.ts's per-month carry-forward
// resolver — see docs improve-codebase-architecture candidate 3. This
// exercises the fix end-to-end through GET /fuel-kurs's embedded
// window.bargesMhuData.fuelPeriodTable, the same data the client-side Barges
// MHU/CAM and FLF engines (assets/js/fuel-kurs-calc.mjs) read fuel.total/
// fuel.pertaminaPbbkbPph22 from.
describe("fuel-kurs Barges MHU engine: tax rate carry-forward (Node app only)", () => {
  const vmfatUser = `vmfat_${randomUUID().slice(0, 8)}`;
  const vmfatPassword = "vmfat-test-pass";
  // Years far outside real usage so these can't inherit an override saved
  // by real app usage (which only exists from 2026+ onward).
  const rateSuffix = String(Math.floor(Math.random() * 20)).padStart(2, "0");
  const overrideBulanTahun = `Mar-${rateSuffix}`;
  const earlierBulanTahun = `Jan-${rateSuffix}`;
  const pertamina = 7000;

  beforeEach(async () => {
    await seedLegacyUser(vmfatUser, vmfatPassword, "Staff", "VM&FAT");
  });

  afterEach(async () => {
    await deleteUserRow(vmfatUser);
    await deleteFuelRateRow(overrideBulanTahun);
    await deleteFuelRow(overrideBulanTahun, 1);
    await deleteFuelRow(earlierBulanTahun, 1);
  });

  async function loginAsVmfat() {
    const client = new HttpClient(node.baseUrl);
    await client.postForm(node.paths.login, {
      username: vmfatUser,
      password: vmfatPassword,
    });
    return client;
  }

  function fuelPeriodTable(html: string): Record<string, Record<string, { pertamina: number; total: number; pertaminaPbbkbPph22: number }>> {
    const match = html.match(/window\.bargesMhuData = (\{.*?\});/s);
    if (!match) throw new Error("window.bargesMhuData not found in /fuel-kurs response");
    return JSON.parse(match[1]).fuelPeriodTable;
  }

  it("uses the carried-forward month rate, not a fixed constant", async () => {
    const client = await loginAsVmfat();

    await client.postJsonForm<AjaxResult>(node.paths.fuel, {
      action: "save_fuel",
      bulan_tahun: earlierBulanTahun,
      periode: "1",
      field: "pertamina",
      value: String(pertamina),
    });
    await client.postJsonForm<AjaxResult>(node.paths.fuel, {
      action: "save_fuel",
      bulan_tahun: overrideBulanTahun,
      periode: "1",
      field: "pertamina",
      value: String(pertamina),
    });
    const rateRes = await client.postJsonForm<AjaxResult>(node.paths.fuel, {
      action: "save_fuel_rate",
      bulan_tahun: overrideBulanTahun,
      field: "pbbkb_rate",
      value: "8.25",
    });
    expect(rateRes.ok).toBe(true);

    const pageRes = await client.get(node.paths.fuelKurs);
    expect(pageRes.status).toBe(200);
    const table = fuelPeriodTable(pageRes.body);

    // Earlier month: no override yet, DEFAULT_FUEL_RATES (ppn 11%, pbbkb
    // 7.5%, pph22 0.3%) still apply.
    const earlierCell = table[earlierBulanTahun]["1"];
    expect(earlierCell.total).toBeCloseTo(pertamina * (1 + 0.11 + 0.075 + 0.003), 6);
    expect(earlierCell.pertaminaPbbkbPph22).toBeCloseTo(pertamina * (1 + 0.075 + 0.003), 6);

    // Override month: pbbkb carried forward to 8.25%, ppn/pph22 stay default.
    const overrideCell = table[overrideBulanTahun]["1"];
    expect(overrideCell.total).toBeCloseTo(pertamina * (1 + 0.11 + 0.0825 + 0.003), 6);
    expect(overrideCell.pertaminaPbbkbPph22).toBeCloseTo(pertamina * (1 + 0.0825 + 0.003), 6);

    // The two months must differ — proves the rate isn't a shared constant.
    expect(overrideCell.total).not.toBeCloseTo(earlierCell.total, 6);
  });
});
