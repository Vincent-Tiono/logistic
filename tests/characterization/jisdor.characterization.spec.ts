import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

// Jisdor calls the live BI webservice (bi.go.id). Both targets degrade
// gracefully to a "Gagal memuat data" state on network failure (see
// VM&FAT/1jisdor.php:30-34 / src/lib/bi-kurs.ts fetchBiKurs), so these
// assertions only check page structure that holds regardless of whether
// the external fetch actually succeeds in this environment — not the
// fetched currency data itself, which would be flaky offline.
describe.each(targets)("jisdor — $name", (target) => {
  const vmfatUser = `vmfat_${randomUUID().slice(0, 8)}`;
  const vmfatPassword = "vmfat-test-pass";

  beforeEach(async () => {
    await seedLegacyUser(vmfatUser, vmfatPassword, "Staff", "VM&FAT");
  });

  afterEach(async () => {
    await deleteUserRow(vmfatUser);
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
    const res = await client.get(target.paths.jisdor);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("renders the page with the Periode filter and table headers", async () => {
    const client = await loginAsVmfat();
    const res = await client.get(target.paths.jisdor);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Periode");
    expect(res.body).toContain("Tanggal");
    expect(res.body).toContain("Kurs");
  });

  it("accepts a custom date range query without erroring", async () => {
    const client = await loginAsVmfat();
    const res = await client.get(
      `${target.paths.jisdor}?dari=2024-01-01&sampai=2024-01-31`
    );
    expect(res.status).toBe(200);
  });

  it("ignores a malformed date range and falls back to the default window", async () => {
    const client = await loginAsVmfat();
    const res = await client.get(`${target.paths.jisdor}?dari=not-a-date`);
    expect(res.status).toBe(200);
  });
});
