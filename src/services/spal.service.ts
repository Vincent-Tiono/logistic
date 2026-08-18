import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, RowDataPacket } from "mysql2/promise";
import PizZip from "pizzip";
import { formatTanggalID } from "../lib/bi-kurs.js";
import { terbilang } from "../lib/terbilang.js";
import type { PageResult } from "../lib/bi-kurs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Deliberately outside assets/ — fastifyStatic serves that whole tree
// unauthenticated at /assets/, and this template shouldn't be fetchable
// without the /spal route's divisi gate.
const TEMPLATE_PATH = path.join(
  __dirname,
  "../../templates/spal-sjn-template.docx"
);

export const DEFAULT_DENDA_DEMURRAGE = 35_000_000;

export interface SpalAgreementInput {
  nomor: string;
  tanggal: string;
  namaPt: string;
  alamat: string;
  uangTambang: number;
  jettyMuat: string;
  jettyBongkar: string;
  dendaDemurrage: number;
  namaPenandatangan: string;
  jabatan: string;
  createdBy?: string;
}

export interface SpalAgreement extends SpalAgreementInput {
  id: number;
  createdAt: string;
}

export type ActionResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

function required(value: string, label: string): string | null {
  return value.trim() ? null : `${label} wajib diisi.`;
}

function validate(input: SpalAgreementInput): string | null {
  return (
    required(input.nomor, "Nomor Perjanjian") ??
    required(input.tanggal, "Tanggal") ??
    required(input.namaPt, "Nama PT Customer") ??
    required(input.alamat, "Alamat") ??
    required(input.jettyMuat, "Jetty Muat") ??
    required(input.jettyBongkar, "Jetty Bongkar") ??
    required(input.namaPenandatangan, "Nama Penandatangan") ??
    required(input.jabatan, "Jabatan") ??
    (input.uangTambang > 0 ? null : "Uang Tambang harus lebih dari 0.") ??
    (input.dendaDemurrage > 0
      ? null
      : "Denda Demurrage harus lebih dari 0.")
  );
}

export async function createSpalAgreement(
  pool: Pool,
  input: SpalAgreementInput
): Promise<ActionResult> {
  const error = validate(input);
  if (error) return { ok: false, error };

  try {
    const [result] = await pool.query(
      `INSERT INTO spal_agreements
        (nomor, tanggal, nama_pt, alamat, uang_tambang, jetty_muat, jetty_bongkar, denda_demurrage, nama_penandatangan, jabatan, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.nomor,
        input.tanggal,
        input.namaPt,
        input.alamat,
        input.uangTambang,
        input.jettyMuat,
        input.jettyBongkar,
        input.dendaDemurrage,
        input.namaPenandatangan,
        input.jabatan,
        input.createdBy ?? null,
      ]
    );
    return { ok: true, id: (result as { insertId: number }).insertId };
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return {
        ok: false,
        error: `Nomor Perjanjian "${input.nomor}" sudah digunakan. Gunakan nomor lain.`,
      };
    }
    throw err;
  }
}

function rowToAgreement(row: RowDataPacket): SpalAgreement {
  return {
    id: Number(row.id),
    nomor: String(row.nomor),
    tanggal: String(row.tanggal).slice(0, 10),
    namaPt: String(row.nama_pt),
    alamat: String(row.alamat),
    uangTambang: Number(row.uang_tambang),
    jettyMuat: String(row.jetty_muat),
    jettyBongkar: String(row.jetty_bongkar),
    dendaDemurrage: Number(row.denda_demurrage),
    namaPenandatangan: String(row.nama_penandatangan),
    jabatan: String(row.jabatan),
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: String(row.created_at),
  };
}

export interface SpalListFilters {
  dari?: string;
  sampai?: string;
  customer?: string;
  page?: number;
}

const PER_PAGE = 20;

export async function listSpalAgreements(
  pool: Pool,
  filters: SpalListFilters
): Promise<PageResult<SpalAgreement>> {
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

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM spal_agreements ${where}`,
    params
  );
  const totalRows = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / PER_PAGE));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const offset = (page - 1) * PER_PAGE;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM spal_agreements ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, PER_PAGE, offset]
  );

  return {
    pageData: rows.map(rowToAgreement),
    page,
    totalPages,
    totalRows,
  };
}

export async function getSpalAgreementById(
  pool: Pool,
  id: number
): Promise<SpalAgreement | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM spal_agreements WHERE id = ?",
    [id]
  );
  return rows[0] ? rowToAgreement(rows[0]) : null;
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

export function buildSpalDocx(agreement: SpalAgreement): Buffer {
  const templateBuffer = readFileSync(TEMPLATE_PATH);
  const zip = new PizZip(templateBuffer);
  let xml = zip.file("word/document.xml")!.asText();

  xml = injectAlamatRuns(xml, agreement.alamat);

  const demurrageClause = `Rp. ${formatRupiahAmount(
    agreement.dendaDemurrage
  )} / Hari Pro Rata (${terbilang(
    Math.round(agreement.dendaDemurrage)
  )} Rupiah Per Hari Pro Rata) Exclude PPN, Include PPH pasal 15 (1,2%)`;

  const replacements: Record<string, string> = {
    "%%NOMOR%%": agreement.nomor,
    "%%TANGGAL%%": formatTanggalID(agreement.tanggal),
    "%%NAMA_PT%%": agreement.namaPt,
    "%%UANG_TAMBANG%%": formatRupiahAmount(agreement.uangTambang),
    "%%JETTY_MUAT%%": agreement.jettyMuat,
    "%%JETTY_BONGKAR%%": agreement.jettyBongkar,
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
  return `SJN-SPAL-${safeNomor}.docx`;
}
