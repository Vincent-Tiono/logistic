import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { deleteFuelRow, readFuelRow } from "./fuel-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

interface AjaxResult {
  ok: boolean;
  error?: string;
}

describe.each(targets)("fuel — $name", (target) => {
  const vmfatUser = `vmfat_${randomUUID().slice(0, 8)}`;
  const vmfatPassword = "vmfat-test-pass";
  const bulanTahun = `Feb-${randomUUID().slice(0, 2)}`;

  beforeEach(async () => {
    await seedLegacyUser(vmfatUser, vmfatPassword, "Staff", "VM&FAT");
  });

  afterEach(async () => {
    await deleteUserRow(vmfatUser);
    await deleteFuelRow(bulanTahun, 1);
  });

  async function loginAsVmfat() {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, {
      username: vmfatUser,
      password: vmfatPassword,
    });
    return client;
  }

  it("redirects to login when no session", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get(target.paths.fuel);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("renders the page with the input table headers", async () => {
    const client = await loginAsVmfat();
    const res = await client.get(target.paths.fuel);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Bulan-Tahun");
    expect(res.body).toContain("Pertamina");
    expect(res.body).toContain("ICI-3");
  });

  it("saves a pertamina value and persists it", async () => {
    const client = await loginAsVmfat();
    const res = await client.postJsonForm<AjaxResult>(target.paths.fuel, {
      action: "save_fuel",
      bulan_tahun: bulanTahun,
      periode: "1",
      field: "pertamina",
      value: "12345.67",
    });
    expect(res.ok).toBe(true);

    const row = await readFuelRow(bulanTahun, 1);
    expect(row?.pertamina).toBe(12345.67);
  });

  it("rejects an invalid periode", async () => {
    const client = await loginAsVmfat();
    const res = await client.postJsonForm<AjaxResult>(target.paths.fuel, {
      action: "save_fuel",
      bulan_tahun: bulanTahun,
      periode: "3",
      field: "pertamina",
      value: "100",
    });
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown field", async () => {
    const client = await loginAsVmfat();
    const res = await client.postJsonForm<AjaxResult>(target.paths.fuel, {
      action: "save_fuel",
      bulan_tahun: bulanTahun,
      periode: "1",
      field: "not_a_real_field",
      value: "100",
    });
    expect(res.ok).toBe(false);
  });
});
