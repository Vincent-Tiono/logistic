import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { targets } from "./targets.js";

interface AjaxResult {
  ok: boolean;
  msg?: string;
  data?: Array<{ username: string; jabatan: string; divisi: string }>;
}

function pathnameOf(baseUrl: string, location: string | null): string | null {
  if (!location) return null;
  return new URL(location, baseUrl).pathname;
}

describe.each(targets)("create-user — $name", (target) => {
  const itUser = `it_${randomUUID().slice(0, 8)}`;
  const itPassword = "it-test-pass";
  const nonItUser = `staff_${randomUUID().slice(0, 8)}`;
  const nonItPassword = "staff-test-pass";
  const managedUser = `managed_${randomUUID().slice(0, 8)}`;

  beforeEach(async () => {
    await seedLegacyUser(itUser, itPassword, "Staff", "IT");
    await seedLegacyUser(nonItUser, nonItPassword, "Staff", "Operation");
  });

  afterEach(async () => {
    await deleteUserRow(itUser);
    await deleteUserRow(nonItUser);
    await deleteUserRow(managedUser);
  });

  async function loginAs(username: string, password: string) {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, { username, password });
    return client;
  }

  it("redirects to login when no session", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get(target.paths.createUser);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    // create_user.php hardcodes "/logistic/login.php" while login.php's own
    // redirects are relative — an existing PHP inconsistency, not something
    // this ticket fixes. endsWith() tolerates either form.
    expect(
      pathnameOf(target.baseUrl, res.location)?.endsWith(target.paths.login)
    ).toBe(true);
  });

  it("blocks non-IT users with 403", async () => {
    const client = await loginAs(nonItUser, nonItPassword);
    const res = await client.get(target.paths.createUser);
    expect(res.status).toBe(403);
  });

  it("renders the page for IT users", async () => {
    const client = await loginAs(itUser, itPassword);
    const res = await client.get(target.paths.createUser);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Create User");
  });

  it("validates required fields on create", async () => {
    const client = await loginAs(itUser, itPassword);
    const res = await client.postJsonForm<AjaxResult>(target.paths.createUser, {
      ajax: "1",
      action: "create",
      username: "",
      password: "",
      jabatan: "",
      divisi: "",
    });
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("Semua field wajib diisi.");
  });

  it("creates, lists, updates, and deletes a user end-to-end", async () => {
    const client = await loginAs(itUser, itPassword);

    const created = await client.postJsonForm<AjaxResult>(
      target.paths.createUser,
      {
        ajax: "1",
        action: "create",
        username: managedUser,
        password: "whatever123",
        jabatan: "Staff",
        divisi: "Operation",
      }
    );
    expect(created.ok).toBe(true);
    expect(created.msg).toContain("berhasil dibuat");

    const duplicate = await client.postJsonForm<AjaxResult>(
      target.paths.createUser,
      {
        ajax: "1",
        action: "create",
        username: managedUser,
        password: "whatever123",
        jabatan: "Staff",
        divisi: "Operation",
      }
    );
    expect(duplicate.ok).toBe(false);
    expect(duplicate.msg).toContain("Username sudah ada");

    const listed = await client.postJsonForm<AjaxResult>(
      target.paths.createUser,
      { ajax: "1", action: "list", q: managedUser }
    );
    expect(listed.ok).toBe(true);
    expect(listed.data?.some((u) => u.username === managedUser)).toBe(true);

    const updated = await client.postJsonForm<AjaxResult>(
      target.paths.createUser,
      {
        ajax: "1",
        action: "update",
        old_username: managedUser,
        username: managedUser,
        password: "",
        jabatan: "SPV",
        divisi: "Operation",
      }
    );
    expect(updated.ok).toBe(true);
    expect(updated.msg).toContain("berhasil diupdate");

    const deleted = await client.postJsonForm<AjaxResult>(
      target.paths.createUser,
      { ajax: "1", action: "delete", username: managedUser }
    );
    expect(deleted.ok).toBe(true);
    expect(deleted.msg).toContain("berhasil dihapus");
  });

  it("refuses to delete the protected admin account", async () => {
    const client = await loginAs(itUser, itPassword);
    const res = await client.postJsonForm<AjaxResult>(
      target.paths.createUser,
      { ajax: "1", action: "delete", username: "admin" }
    );
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("protected");
  });

  it("refuses to delete the currently logged-in account", async () => {
    const client = await loginAs(itUser, itPassword);
    const res = await client.postJsonForm<AjaxResult>(
      target.paths.createUser,
      { ajax: "1", action: "delete", username: itUser }
    );
    expect(res.ok).toBe(false);
    expect(res.msg).toContain("sedang login");
  });
});
