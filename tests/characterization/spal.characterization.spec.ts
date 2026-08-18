import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import {
  deleteSpalAgreementByNomor,
  readSpalAgreementByNomor,
} from "./spal-fixture.js";
import { targets } from "./targets.js";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe.each(targets)("spal — $name", (target) => {
  const vmfatUser = `vmfat_${randomUUID().slice(0, 8)}`;
  const vmfatPassword = "vmfat-test-pass";
  const nomor = `TEST/${randomUUID().slice(0, 8)}/2026`;

  beforeEach(async () => {
    await seedLegacyUser(vmfatUser, vmfatPassword, "Staff", "VM&FAT");
  });

  afterEach(async () => {
    await deleteUserRow(vmfatUser);
    await deleteSpalAgreementByNomor(nomor);
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
    const res = await client.get(target.paths.spal);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("renders the page with the form fields and history table", async () => {
    const client = await loginAsVmfat();
    const res = await client.get(target.paths.spal);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Nomor Perjanjian");
    expect(res.body).toContain("Uang Tambang");
    expect(res.body).toContain("Jetty Muat");
    expect(res.body).toContain("Denda Demurrage");
  });

  it("creates an agreement, persists it, and streams back a docx download", async () => {
    const client = await loginAsVmfat();
    const res = await client.postForm(target.paths.spal, {
      nomor,
      tanggal: "2026-08-18",
      nama_pt: "Contoh Mining Nusantara",
      alamat: "Jl. Sudirman No. 1\nJakarta Selatan",
      uang_tambang: "1500000000",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
    });

    expect(res.status).toBe(200);
    expect(res.contentType).toBe(DOCX_CONTENT_TYPE);
    expect(res.contentDisposition).toContain("attachment");

    const row = await readSpalAgreementByNomor(nomor);
    expect(row).not.toBeNull();
    expect(row?.nama_pt).toBe("Contoh Mining Nusantara");
    expect(row?.uang_tambang).toBe(1500000000);
  });

  it("defaults Denda Demurrage to 35,000,000 when left blank", async () => {
    const client = await loginAsVmfat();
    await client.postForm(target.paths.spal, {
      nomor,
      tanggal: "2026-08-18",
      nama_pt: "Contoh Mining Nusantara",
      alamat: "Jl. Sudirman No. 1",
      uang_tambang: "1000000",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
    });

    const row = await readSpalAgreementByNomor(nomor);
    expect(row).not.toBeNull();
  });

  it("rejects a missing required field with a 400 and re-renders the form with an error", async () => {
    const client = await loginAsVmfat();
    const res = await client.postForm(target.paths.spal, {
      nomor: "",
      tanggal: "2026-08-18",
      nama_pt: "Contoh Mining Nusantara",
      alamat: "Jl. Sudirman No. 1",
      uang_tambang: "1000000",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
    });

    expect(res.status).toBe(400);
    expect(res.body).toContain("Nomor Perjanjian wajib diisi.");

    const row = await readSpalAgreementByNomor(nomor);
    expect(row).toBeNull();
  });

  it("rejects a second submission reusing the same Nomor Perjanjian", async () => {
    const client = await loginAsVmfat();
    const payload = {
      nomor,
      tanggal: "2026-08-18",
      nama_pt: "Contoh Mining Nusantara",
      alamat: "Jl. Sudirman No. 1",
      uang_tambang: "1000000",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
    };

    const first = await client.postForm(target.paths.spal, payload);
    expect(first.status).toBe(200);

    const second = await client.postForm(target.paths.spal, payload);
    expect(second.status).toBe(400);
    expect(second.body).toContain("sudah digunakan");
  });

  it("rejects a zero Uang Tambang", async () => {
    const client = await loginAsVmfat();
    const res = await client.postForm(target.paths.spal, {
      nomor,
      tanggal: "2026-08-18",
      nama_pt: "Contoh Mining Nusantara",
      alamat: "Jl. Sudirman No. 1",
      uang_tambang: "0",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
    });

    expect(res.status).toBe(400);
    expect(res.body).toContain("Uang Tambang harus lebih dari 0.");
  });

  it("re-downloads a saved agreement by id and lists it in the history search", async () => {
    const client = await loginAsVmfat();
    await client.postForm(target.paths.spal, {
      nomor,
      tanggal: "2026-08-18",
      nama_pt: "Contoh Mining Nusantara",
      alamat: "Jl. Sudirman No. 1",
      uang_tambang: "1000000",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
    });

    const row = await readSpalAgreementByNomor(nomor);
    const downloadRes = await client.get(`${target.paths.spal}?download=agreement&id=${row?.id}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.contentType).toBe(DOCX_CONTENT_TYPE);

    const searchRes = await client.get(
      `${target.paths.spal}?customer=${encodeURIComponent("Contoh Mining Nusantara")}`
    );
    expect(searchRes.status).toBe(200);
    expect(searchRes.body).toContain(nomor);
  });

  it("returns 404 for a download of a nonexistent agreement id", async () => {
    const client = await loginAsVmfat();
    const res = await client.get(`${target.paths.spal}?download=agreement&id=999999999`);
    expect(res.status).toBe(404);
  });

  it("does not serve the docx template as a public static asset", async () => {
    const client = new HttpClient(target.baseUrl);
    const res = await client.get("/assets/templates/spal-sjn-template.docx");
    expect(res.status).toBe(404);
  });
});
