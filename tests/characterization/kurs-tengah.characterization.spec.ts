import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

// Kurs Tengah calls the live BI webservice, same graceful-degradation
// caveat as jisdor.characterization.spec.ts — see the note there.
describe.each(targets)("kurs-tengah — $name", (target) => {
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
    const res = await client.get(target.paths.kursTengah);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("renders the page with the Periode filter and all four columns", async () => {
    const client = await loginAsVmfat();
    const res = await client.get(target.paths.kursTengah);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Periode");
    expect(res.body).toContain("Kurs Jual");
    expect(res.body).toContain("Kurs Beli");
    expect(res.body).toContain("Kurs Tengah");
  });

  it("accepts a custom date range query without erroring", async () => {
    const client = await loginAsVmfat();
    const res = await client.get(
      `${target.paths.kursTengah}?dari=2024-01-01&sampai=2024-01-31`
    );
    expect(res.status).toBe(200);
  });
});
