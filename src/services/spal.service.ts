import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, RowDataPacket } from "mysql2/promise";
import PizZip from "pizzip";
import { formatTanggalID, formatTanggalRangeID } from "../lib/bi-kurs.js";
import { romanMonth } from "../lib/date.js";
import { terbilang } from "../lib/terbilang.js";
import type { PageResult } from "../lib/bi-kurs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Deliberately outside assets/ — fastifyStatic serves that whole tree
// unauthenticated at /assets/, and this template shouldn't be fetchable
// without the /spal route's divisi gate.
const TEMPLATE_PATHS: Record<SpalOperator, string> = {
  SJN: path.join(__dirname, "../../templates/spal-sjn-template.docx"),
  SNP: path.join(__dirname, "../../templates/spal-snp-template.docx"),
};

export const DEFAULT_DENDA_DEMURRAGE = 35_000_000;

export const SPAL_OPERATORS = ["SJN", "SNP"] as const;
export type SpalOperator = (typeof SPAL_OPERATORS)[number];

export interface SpalKapalPair {
  tugboat: string;
  barge: string;
}

export interface SpalAgreementInput {
  operator: string;
  namaPt: string;
  alamat: string;
  uangTambang: number;
  deadfreight: number;
  jettyMuat: string;
  jettyBongkar: string;
  kesediaanKapalMulai: string;
  kesediaanKapalSelesai: string;
  posisiKapal: string;
  totalHariMuatBongkar: string;
  dendaDemurrage: number;
  namaPenandatangan: string;
  jabatan: string;
  kapal: SpalKapalPair[];
  createdBy?: string;
}

/** kodeCustomer only feeds nomor generation — it isn't a stored column, so
 * it's kept off SpalAgreementInput (which SpalAgreement extends). */
export interface SpalCreateInput extends SpalAgreementInput {
  kodeCustomer: string;
}

export interface SpalAgreement extends SpalAgreementInput {
  id: number;
  nomor: string;
  tanggal: string;
  createdAt: string;
}

export type ActionResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

function required(value: string, label: string): string | null {
  return value.trim() ? null : `${label} wajib diisi.`;
}

function validateAgreementFields(input: SpalAgreementInput): string | null {
  return (
    required(input.namaPt, "Nama PT Customer") ??
    required(input.alamat, "Alamat") ??
    required(input.jettyMuat, "Pelabuhan Muat") ??
    required(input.jettyBongkar, "Pelabuhan Bongkar") ??
    required(input.kesediaanKapalMulai, "Kesediaan Kapal (Mulai)") ??
    required(input.kesediaanKapalSelesai, "Kesediaan Kapal (Selesai)") ??
    (!input.kesediaanKapalMulai ||
    !input.kesediaanKapalSelesai ||
    input.kesediaanKapalMulai <= input.kesediaanKapalSelesai
      ? null
      : "Kesediaan Kapal: tanggal mulai harus sebelum atau sama dengan tanggal selesai.") ??
    required(input.posisiKapal, "Posisi Kapal Saat Ini") ??
    required(input.totalHariMuatBongkar, "Total Hari Muat / Bongkar") ??
    required(input.namaPenandatangan, "Nama Penandatangan") ??
    required(input.jabatan, "Jabatan") ??
    (input.uangTambang > 0 ? null : "Uang Tambang harus lebih dari 0.") ??
    (input.operator !== "SNP" || input.deadfreight > 0
      ? null
      : "Deadfreight harus lebih dari 0.") ??
    (input.kapal.length > 0 &&
    input.kapal.every((k) => k.tugboat.trim() && k.barge.trim())
      ? null
      : "Kapal (Tugboat/Barge) wajib dipilih, minimal 1 pasang.")
  );
}

function validate(input: SpalCreateInput): string | null {
  return (
    (SPAL_OPERATORS.includes(input.operator as SpalOperator)
      ? null
      : "Operator wajib SJN atau SNP.") ??
    required(input.kodeCustomer, "Customer") ??
    validateAgreementFields(input)
  );
}

/** "001/{operator}-{kodeCustomer}/{romanMonth}/{year}" — seq restarts at 001
 * per operator+customer+month+year combo, continuing from however many OTHER
 * rows already share that exact base (e.g. "MHU-SNP/VIII/2026"). Excluding
 * `excludeId` makes this idempotent: recomputing on every save (even when
 * nothing about the combo actually changed) reproduces the same nomor
 * instead of counting the row's own prior nomor and drifting upward. */
async function nextSpalNomor(
  pool: Pool,
  operator: string,
  kodeCustomer: string,
  tanggal: string,
  excludeId?: number
): Promise<string> {
  const month = Number(tanggal.slice(5, 7));
  const year = tanggal.slice(0, 4);
  const base = `${operator}-${kodeCustomer}/${romanMonth(month)}/${year}`;
  const [rows] = await pool.query<RowDataPacket[]>(
    excludeId
      ? "SELECT COUNT(*) AS c FROM spal_agreements WHERE nomor LIKE ? AND id != ?"
      : "SELECT COUNT(*) AS c FROM spal_agreements WHERE nomor LIKE ?",
    excludeId ? [`%/${base}`, excludeId] : [`%/${base}`]
  );
  const count = Number(rows[0]!.c);
  return `${String(count + 1).padStart(3, "0")}/${base}`;
}

export async function createSpalAgreement(
  pool: Pool,
  input: SpalCreateInput
): Promise<ActionResult> {
  const error = validate(input);
  if (error) return { ok: false, error };

  const tanggal = new Date().toISOString().slice(0, 10);

  // Retries on a unique-key collision (concurrent submissions racing for the
  // same seq) by recomputing the count and trying the next nomor.
  for (let attempt = 0; attempt < 10; attempt++) {
    const nomor = await nextSpalNomor(
      pool,
      input.operator,
      input.kodeCustomer,
      tanggal
    );

    try {
      const [result] = await pool.query(
        `INSERT INTO spal_agreements
          (operator, nomor, tanggal, nama_pt, alamat, uang_tambang, deadfreight, jetty_muat, jetty_bongkar, kesediaan_kapal_mulai, kesediaan_kapal_selesai, posisi_kapal, total_hari_muat_bongkar, denda_demurrage, nama_penandatangan, jabatan, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.operator,
          nomor,
          tanggal,
          input.namaPt,
          input.alamat,
          input.uangTambang,
          input.operator === "SNP" ? input.deadfreight : null,
          input.jettyMuat,
          input.jettyBongkar,
          input.kesediaanKapalMulai,
          input.kesediaanKapalSelesai,
          input.posisiKapal,
          input.totalHariMuatBongkar,
          input.dendaDemurrage,
          input.namaPenandatangan,
          input.jabatan,
          input.createdBy ?? null,
        ]
      );
      const id = (result as { insertId: number }).insertId;

      for (const pair of input.kapal) {
        await pool.query(
          `INSERT INTO spal_kapal (spal_agreement_id, tugboat, barge) VALUES (?, ?, ?)`,
          [id, pair.tugboat, pair.barge]
        );
      }

      return { ok: true, id };
    } catch (err) {
      if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
        continue;
      }
      throw err;
    }
  }

  return {
    ok: false,
    error: "Gagal membuat Nomor Perjanjian, silakan coba lagi.",
  };
}

/** mysql2 returns DATE columns as local-time JS Date objects, not strings —
 * String(date) yields "Thu Aug 20 2026 ..." which corrupts downstream
 * formatting. Route Date instances through local Y/M/D instead of a blind
 * String().slice(0, 10). */
function toIsoDateOnly(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
}

function rowToAgreement(row: RowDataPacket, kapal: SpalKapalPair[]): SpalAgreement {
  return {
    id: Number(row.id),
    operator: String(row.operator),
    nomor: String(row.nomor),
    tanggal: toIsoDateOnly(row.tanggal),
    namaPt: String(row.nama_pt),
    alamat: String(row.alamat),
    uangTambang: Number(row.uang_tambang),
    deadfreight: Number(row.deadfreight ?? 0),
    jettyMuat: String(row.jetty_muat),
    jettyBongkar: String(row.jetty_bongkar),
    kesediaanKapalMulai: toIsoDateOnly(row.kesediaan_kapal_mulai),
    kesediaanKapalSelesai: toIsoDateOnly(row.kesediaan_kapal_selesai),
    posisiKapal: String(row.posisi_kapal ?? ""),
    totalHariMuatBongkar: String(row.total_hari_muat_bongkar ?? ""),
    dendaDemurrage: Number(row.denda_demurrage),
    namaPenandatangan: String(row.nama_penandatangan),
    jabatan: String(row.jabatan),
    kapal,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: String(row.created_at),
  };
}

async function listKapalByAgreementIds(
  pool: Pool,
  ids: number[]
): Promise<Map<number, SpalKapalPair[]>> {
  const byId = new Map<number, SpalKapalPair[]>();
  if (ids.length === 0) return byId;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT spal_agreement_id, tugboat, barge FROM spal_kapal
     WHERE spal_agreement_id IN (?) ORDER BY id ASC`,
    [ids]
  );
  for (const row of rows) {
    const agreementId = Number(row.spal_agreement_id);
    const list = byId.get(agreementId) ?? [];
    list.push({ tugboat: String(row.tugboat), barge: String(row.barge) });
    byId.set(agreementId, list);
  }
  return byId;
}

export interface SpalListFilters {
  dari?: string;
  sampai?: string;
  customer?: string;
  page?: number;
  perPage?: number;
}

export const SPAL_PAGE_SIZES = [10, 20, 50, 100] as const;
const DEFAULT_PER_PAGE = 10;

export async function listSpalAgreements(
  pool: Pool,
  filters: SpalListFilters
): Promise<PageResult<SpalAgreement> & { perPage: number }> {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.dari) {
    conditions.push("tanggal >= ?");
    params.push(filters.dari);
  }
  if (filters.sampai) {
    conditions.push("tanggal <= ?");
    params.push(filters.sampai);
  }
  if (filters.customer) {
    conditions.push("nama_pt LIKE ?");
    params.push(`%${filters.customer}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const perPage = SPAL_PAGE_SIZES.includes(
    filters.perPage as (typeof SPAL_PAGE_SIZES)[number]
  )
    ? filters.perPage!
    : DEFAULT_PER_PAGE;

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM spal_agreements ${where}`,
    params
  );
  const totalRows = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const offset = (page - 1) * perPage;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM spal_agreements ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  );
  const kapalById = await listKapalByAgreementIds(
    pool,
    rows.map((row) => Number(row.id))
  );

  return {
    pageData: rows.map((row) =>
      rowToAgreement(row, kapalById.get(Number(row.id)) ?? [])
    ),
    page,
    totalPages,
    totalRows,
    perPage,
  };
}

export interface SpalUpdateInput {
  operator?: string;
  kodeCustomer?: string;
  namaPt?: string;
  alamat?: string;
  uangTambang?: number;
  deadfreight?: number;
  jettyMuat?: string;
  jettyBongkar?: string;
  kesediaanKapalMulai?: string;
  kesediaanKapalSelesai?: string;
  posisiKapal?: string;
  totalHariMuatBongkar?: string;
  dendaDemurrage?: number;
  namaPenandatangan?: string;
  jabatan?: string;
  kapal?: SpalKapalPair[];
}

/** Table-cell edits. `kodeCustomer` isn't a stored column (same as create) —
 * when the caller passes it, the nomor is regenerated against the new
 * customer combo so it stays consistent with the row it's displayed on. */
export async function updateSpalAgreement(
  pool: Pool,
  id: number,
  input: SpalUpdateInput
): Promise<ActionResult> {
  const existing = await getSpalAgreementById(pool, id);
  if (!existing) return { ok: false, error: "Data SPAL tidak ditemukan." };

  const operator = input.operator ?? existing.operator;
  if (!SPAL_OPERATORS.includes(operator as SpalOperator)) {
    return { ok: false, error: "Operator wajib SJN atau SNP." };
  }

  const merged: SpalAgreementInput = {
    operator,
    namaPt: input.namaPt ?? existing.namaPt,
    alamat: input.alamat ?? existing.alamat,
    uangTambang: input.uangTambang ?? existing.uangTambang,
    deadfreight: input.deadfreight ?? existing.deadfreight,
    jettyMuat: input.jettyMuat ?? existing.jettyMuat,
    jettyBongkar: input.jettyBongkar ?? existing.jettyBongkar,
    kesediaanKapalMulai: input.kesediaanKapalMulai ?? existing.kesediaanKapalMulai,
    kesediaanKapalSelesai: input.kesediaanKapalSelesai ?? existing.kesediaanKapalSelesai,
    posisiKapal: input.posisiKapal ?? existing.posisiKapal,
    totalHariMuatBongkar: input.totalHariMuatBongkar ?? existing.totalHariMuatBongkar,
    dendaDemurrage: input.dendaDemurrage ?? existing.dendaDemurrage,
    namaPenandatangan: input.namaPenandatangan ?? existing.namaPenandatangan,
    jabatan: input.jabatan ?? existing.jabatan,
    kapal: input.kapal ?? existing.kapal,
  };

  const error = validateAgreementFields(merged);
  if (error) return { ok: false, error };

  const nomor =
    input.kodeCustomer && input.kodeCustomer !== ""
      ? await nextSpalNomor(
          pool,
          merged.operator,
          input.kodeCustomer,
          new Date().toISOString().slice(0, 10),
          id
        )
      : existing.nomor;

  await pool.query(
    `UPDATE spal_agreements SET
       operator = ?, nomor = ?, nama_pt = ?, alamat = ?, uang_tambang = ?, deadfreight = ?, jetty_muat = ?, jetty_bongkar = ?,
       kesediaan_kapal_mulai = ?, kesediaan_kapal_selesai = ?, posisi_kapal = ?,
       total_hari_muat_bongkar = ?, denda_demurrage = ?, nama_penandatangan = ?, jabatan = ?
     WHERE id = ?`,
    [
      merged.operator,
      nomor,
      merged.namaPt,
      merged.alamat,
      merged.uangTambang,
      merged.operator === "SNP" ? merged.deadfreight : null,
      merged.jettyMuat,
      merged.jettyBongkar,
      merged.kesediaanKapalMulai,
      merged.kesediaanKapalSelesai,
      merged.posisiKapal,
      merged.totalHariMuatBongkar,
      merged.dendaDemurrage,
      merged.namaPenandatangan,
      merged.jabatan,
      id,
    ]
  );

  if (input.kapal) {
    await pool.query(`DELETE FROM spal_kapal WHERE spal_agreement_id = ?`, [id]);
    for (const pair of merged.kapal) {
      await pool.query(
        `INSERT INTO spal_kapal (spal_agreement_id, tugboat, barge) VALUES (?, ?, ?)`,
        [id, pair.tugboat, pair.barge]
      );
    }
  }

  return { ok: true, id };
}

export async function deleteSpalAgreement(
  pool: Pool,
  id: number
): Promise<ActionResult> {
  const [result] = await pool.query(
    "DELETE FROM spal_agreements WHERE id = ?",
    [id]
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "Data SPAL tidak ditemukan." };
  }
  return { ok: true, id };
}

export async function getSpalAgreementById(
  pool: Pool,
  id: number
): Promise<SpalAgreement | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM spal_agreements WHERE id = ?",
    [id]
  );
  if (!rows[0]) return null;
  const kapalById = await listKapalByAgreementIds(pool, [id]);
  return rowToAgreement(rows[0], kapalById.get(id) ?? []);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Dot-grouped thousands, no decimals (e.g. 1500000000 -> "1.500.000.000").
 * Hand-rolled rather than toLocaleString("id-ID") — same reasoning as
 * formatRupiah in bi-kurs.ts: Node builds without full-icu silently fall
 * back to a different grouping, which would corrupt a signed legal amount. */
export function formatRupiahAmount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Splits the template run containing `%%ALAMAT%%` into one run per address
 * line, joined by `<w:br/>` elements, reusing that run's original `<w:rPr>`
 * formatting — a plain string.replace can't render line breaks in Word. */
function injectAlamatRuns(documentXml: string, alamat: string): string {
  // The inner lookahead stops the lazy scan from backtracking past a
  // `</w:rPr>` it doesn't like and swallowing a neighboring run/paragraph
  // in search of a later one — without it this can match clear across
  // paragraph boundaries when a preceding run also opens with `<w:rPr>`.
  const runPattern =
    /<w:r>(<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*?<\/w:rPr>)?<w:t[^>]*>%%ALAMAT%%<\/w:t><\/w:r>/;
  const match = runPattern.exec(documentXml);
  if (!match) return documentXml;

  const rPr = match[1] ?? "";
  const lines = alamat.split(/\r?\n/).filter((line) => line.trim() !== "");
  const runs = lines
    .map((line) => `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`)
    .join(`<w:r>${rPr}<w:br/></w:r>`);

  return documentXml.replace(match[0], runs);
}

/** Splits the template run containing `%%NAMA_DATA_KAPAL%%` into one run per
 * tugboat/barge pair, reusing that run's original `<w:rPr>` formatting —
 * same technique as injectAlamatRuns. A single pair renders as plain text;
 * two or more render as a bulleted list, one bullet per pair. */
function injectKapalRuns(documentXml: string, kapal: SpalKapalPair[]): string {
  const runPattern =
    /<w:r>(<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*?<\/w:rPr>)?<w:t[^>]*>%%NAMA_DATA_KAPAL%%<\/w:t><\/w:r>/;
  const match = runPattern.exec(documentXml);
  if (!match) return documentXml;

  const rPr = match[1] ?? "";
  const bullet = kapal.length > 1 ? "• " : "";
  const lines = kapal.map((pair) => `${bullet}${pair.tugboat} / ${pair.barge}`);
  const runs = lines
    .map((line) => `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`)
    .join(`<w:r>${rPr}<w:br/></w:r>`);

  return documentXml.replace(match[0], runs);
}

export function buildSpalDocx(agreement: SpalAgreement): Buffer {
  const templatePath =
    TEMPLATE_PATHS[agreement.operator as SpalOperator] ??
    TEMPLATE_PATHS.SJN;
  const templateBuffer = readFileSync(templatePath);
  const zip = new PizZip(templateBuffer);
  let xml = zip.file("word/document.xml")!.asText();

  xml = injectAlamatRuns(xml, agreement.alamat);
  xml = injectKapalRuns(xml, agreement.kapal);

  const demurrageClause =
    agreement.dendaDemurrage > 0
      ? `Rp. ${formatRupiahAmount(
          agreement.dendaDemurrage
        )} / Hari Pro Rata (${terbilang(
          Math.round(agreement.dendaDemurrage)
        )} Rupiah Per Hari Pro Rata) Exclude PPN, Include PPH pasal 15 (1,2%)`
      : "Tidak ada";

  const replacements: Record<string, string> = {
    "%%NOMOR%%": agreement.nomor,
    "%%TANGGAL%%": formatTanggalID(new Date().toISOString().slice(0, 10)),
    "%%NAMA_PT%%": agreement.namaPt,
    "%%UANG_TAMBANG%%": formatRupiahAmount(agreement.uangTambang),
    "%%UANG_TAMBANG_TERBILANG%%": `${terbilang(
      Math.round(agreement.uangTambang)
    )} Rupiah Per Metrik Ton`,
    "%%DEADFREIGHT%%": `${formatRupiahAmount(agreement.deadfreight)} MT`,
    "%%JETTY_MUAT%%": agreement.jettyMuat,
    "%%JETTY_BONGKAR%%": agreement.jettyBongkar,
    "%%KESEDIAAN_KAPAL%%": formatTanggalRangeID(
      agreement.kesediaanKapalMulai,
      agreement.kesediaanKapalSelesai
    ),
    "%%POSISI_KAPAL%%": agreement.posisiKapal,
    "%%TOTAL_HARI_MUAT_BONGKAR%%": agreement.totalHariMuatBongkar,
    "%%DEMURRAGE_CLAUSE%%": demurrageClause,
    "%%PENANDATANGAN%%": agreement.namaPenandatangan,
    "%%JABATAN%%": agreement.jabatan,
  };

  for (const [token, value] of Object.entries(replacements)) {
    xml = xml.split(token).join(escapeXml(value));
  }

  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export function buildSpalFilename(agreement: SpalAgreement): string {
  const safeNomor = agreement.nomor.replace(/[^a-zA-Z0-9-]+/g, "_");
  return `${agreement.operator}-SPAL-${safeNomor}.docx`;
}
