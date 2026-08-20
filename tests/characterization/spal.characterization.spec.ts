import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import {
  deleteSpalAgreementsByNamaPt,
  readSpalAgreementsByNamaPt,
} from "./spal-fixture.js";
import { targets } from "./targets.js";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe.each(targets)("spal — $name", (target) => {
  const vmfatUser = `vmfat_${randomUUID().slice(0, 8)}`;
  const vmfatPassword = "vmfat-test-pass";
  const namaPt = `Contoh Mining ${randomUUID().slice(0, 8)}`;

  beforeEach(async () => {
    await seedLegacyUser(vmfatUser, vmfatPassword, "Staff", "VM&FAT");
  });

  afterEach(async () => {
    await deleteUserRow(vmfatUser);
    await deleteSpalAgreementsByNamaPt(namaPt);
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
    expect(res.body).toContain("Uang Tambang");
    expect(res.body).toContain("Pelabuhan Muat");
    expect(res.body).toContain("Denda Demurrage");
  });

  it("creates an agreement with an auto-generated Nomor Perjanjian and streams back a docx download", async () => {
    const client = await loginAsVmfat();
    const res = await client.postForm(target.paths.spal, {
      operator: "SJN",
      kode_customer: "CMN",
      nama_pt: namaPt,
      alamat: "Jl. Sudirman No. 1\nJakarta Selatan",
      uang_tambang: "1500000000",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      kesediaan_kapal_mulai: "2026-05-09",
      kesediaan_kapal_selesai: "2026-05-11",
      posisi_kapal: "Perairan Taboneo",
      total_hari_muat_bongkar: "7 Hari",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
      kapal_tugboat: "TB. TEST",
      kapal_barge: "BG. TEST",
    });

    expect(res.status).toBe(200);
    expect(res.contentType).toBe(DOCX_CONTENT_TYPE);
    expect(res.contentDisposition).toContain("attachment");

    const rows = await readSpalAgreementsByNamaPt(namaPt);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.nama_pt).toBe(namaPt);
    expect(rows[0]?.uang_tambang).toBe(1500000000);
    expect(rows[0]?.nomor).toMatch(/^001\/SJN-CMN\/[IVX]+\/\d{4}$/);
  });

  it("treats Denda Demurrage as Tidak ada (0) when left blank", async () => {
    const client = await loginAsVmfat();
    await client.postForm(target.paths.spal, {
      operator: "SJN",
      kode_customer: "CMN",
      nama_pt: namaPt,
      alamat: "Jl. Sudirman No. 1",
      uang_tambang: "1000000",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      kesediaan_kapal_mulai: "2026-05-09",
      kesediaan_kapal_selesai: "2026-05-11",
      posisi_kapal: "Perairan Taboneo",
      total_hari_muat_bongkar: "7 Hari",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
      kapal_tugboat: "TB. TEST",
      kapal_barge: "BG. TEST",
    });

    const rows = await readSpalAgreementsByNamaPt(namaPt);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.denda_demurrage).toBe(0);
  });

  it("rejects a missing required field with a 400 and re-renders the form with an error", async () => {
    const client = await loginAsVmfat();
    const res = await client.postForm(target.paths.spal, {
      operator: "SJN",
      kode_customer: "",
      nama_pt: namaPt,
      alamat: "Jl. Sudirman No. 1",
      uang_tambang: "1000000",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      kesediaan_kapal_mulai: "2026-05-09",
      kesediaan_kapal_selesai: "2026-05-11",
      posisi_kapal: "Perairan Taboneo",
      total_hari_muat_bongkar: "7 Hari",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
      kapal_tugboat: "TB. TEST",
      kapal_barge: "BG. TEST",
    });

    expect(res.status).toBe(400);
    expect(res.body).toContain("Customer wajib diisi.");

    const rows = await readSpalAgreementsByNamaPt(namaPt);
    expect(rows).toHaveLength(0);
  });

  it("continues the sequence number for repeated submissions with the same operator/customer/month", async () => {
    const client = await loginAsVmfat();
    const payload = {
      operator: "SJN",
      kode_customer: "CMN",
      nama_pt: namaPt,
      alamat: "Jl. Sudirman No. 1",
      uang_tambang: "1000000",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      kesediaan_kapal_mulai: "2026-05-09",
      kesediaan_kapal_selesai: "2026-05-11",
      posisi_kapal: "Perairan Taboneo",
      total_hari_muat_bongkar: "7 Hari",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
      kapal_tugboat: "TB. TEST",
      kapal_barge: "BG. TEST",
    };

    const first = await client.postForm(target.paths.spal, payload);
    expect(first.status).toBe(200);

    const second = await client.postForm(target.paths.spal, payload);
    expect(second.status).toBe(200);

    const rows = await readSpalAgreementsByNamaPt(namaPt);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.nomor).toMatch(/^001\/SJN-CMN\/[IVX]+\/\d{4}$/);
    expect(rows[1]?.nomor).toMatch(/^002\/SJN-CMN\/[IVX]+\/\d{4}$/);
  });

  it("rejects a zero Uang Tambang", async () => {
    const client = await loginAsVmfat();
    const res = await client.postForm(target.paths.spal, {
      operator: "SJN",
      kode_customer: "CMN",
      nama_pt: namaPt,
      alamat: "Jl. Sudirman No. 1",
      uang_tambang: "0",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      kesediaan_kapal_mulai: "2026-05-09",
      kesediaan_kapal_selesai: "2026-05-11",
      posisi_kapal: "Perairan Taboneo",
      total_hari_muat_bongkar: "7 Hari",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
      kapal_tugboat: "TB. TEST",
      kapal_barge: "BG. TEST",
    });

    expect(res.status).toBe(400);
    expect(res.body).toContain("Uang Tambang harus lebih dari 0.");
  });

  it("re-downloads a saved agreement by id and lists it in the history search", async () => {
    const client = await loginAsVmfat();
    await client.postForm(target.paths.spal, {
      operator: "SJN",
      kode_customer: "CMN",
      nama_pt: namaPt,
      alamat: "Jl. Sudirman No. 1",
      uang_tambang: "1000000",
      jetty_muat: "Taboneo",
      jetty_bongkar: "Suralaya",
      kesediaan_kapal_mulai: "2026-05-09",
      kesediaan_kapal_selesai: "2026-05-11",
      posisi_kapal: "Perairan Taboneo",
      total_hari_muat_bongkar: "7 Hari",
      nama_penandatangan: "Budi Santoso",
      jabatan: "Direktur Utama",
      kapal_tugboat: "TB. TEST",
      kapal_barge: "BG. TEST",
    });

    const rows = await readSpalAgreementsByNamaPt(namaPt);
    const row = rows[0];
    const downloadRes = await client.get(`${target.paths.spal}?download=agreement&id=${row?.id}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.contentType).toBe(DOCX_CONTENT_TYPE);

    const searchRes = await client.get(
      `${target.paths.spal}?customer=${encodeURIComponent(namaPt)}`
    );
    expect(searchRes.status).toBe(200);
    expect(searchRes.body).toContain(row!.nomor);
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
