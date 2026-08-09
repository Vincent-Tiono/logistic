import type { Pool, RowDataPacket } from "mysql2/promise";
import { buildCsvLine, parseCsv } from "../lib/csv-parser.js";

export type ActionResult =
  | { ok: true; msg: string }
  | { ok: false; msg: string };

export interface JettyRow {
  jetty: string;
  nama_panjang: string;
}

export interface JettyInput {
  jetty: string;
  nama_panjang: string;
}

function clean(s: string | undefined): string {
  return (s ?? "").trim();
}

export async function listJetties(
  pool: Pool,
  keyword: string
): Promise<JettyRow[]> {
  const kw = clean(keyword);
  let sql = `SELECT jetty, nama_panjang FROM jetty`;
  const params: string[] = [];

  if (kw !== "") {
    sql += " WHERE jetty LIKE ? OR nama_panjang LIKE ?";
    const like = `%${kw}%`;
    params.push(like, like);
  }
  sql += " ORDER BY jetty ASC LIMIT 500";

  const [rows] = await pool.query<(JettyRow & RowDataPacket)[]>(sql, params);
  return rows;
}

export async function createJetty(
  pool: Pool,
  input: JettyInput
): Promise<ActionResult> {
  const jetty = clean(input.jetty).toUpperCase();
  const nama_panjang = clean(input.nama_panjang);

  if (!jetty || !nama_panjang) {
    return {
      ok: false,
      msg: "Jetty & Nama Panjang wajib diisi.",
    };
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM jetty WHERE jetty=?",
    [jetty]
  );
  if (Number(existing[0]?.c ?? 0) > 0) {
    return { ok: false, msg: "Kode Jetty sudah ada (harus unik)." };
  }

  await pool.query(
    "INSERT INTO jetty (jetty, nama_panjang) VALUES (?,?)",
    [jetty, nama_panjang]
  );

  return { ok: true, msg: "Data jetty berhasil ditambah." };
}

export async function updateJetty(
  pool: Pool,
  input: JettyInput
): Promise<ActionResult> {
  const jetty = clean(input.jetty).toUpperCase();
  const nama_panjang = clean(input.nama_panjang);

  if (!jetty || !nama_panjang) {
    return { ok: false, msg: "Data update tidak valid." };
  }

  await pool.query("UPDATE jetty SET nama_panjang=? WHERE jetty=?", [
    nama_panjang,
    jetty,
  ]);

  return { ok: true, msg: "Data jetty berhasil diupdate." };
}

export async function deleteJetty(
  pool: Pool,
  jettyCode: string
): Promise<ActionResult> {
  const jetty = clean(jettyCode).toUpperCase();
  if (!jetty) {
    return { ok: false, msg: "Kode Jetty kosong." };
  }

  await pool.query("DELETE FROM jetty WHERE jetty=?", [jetty]);
  return { ok: true, msg: "Data jetty berhasil dihapus." };
}

export async function deleteAllJetties(pool: Pool): Promise<ActionResult> {
  await pool.query("DELETE FROM jetty");
  return { ok: true, msg: "Semua data jetty berhasil dihapus." };
}

export const IMPORT_REQUIRED_COLUMNS = ["jetty", "nama_panjang"];

/** Port of the `?download=jetty_template` handler (Operation/5jetty.php:20-32). */
export function buildJettyTemplateCsv(): { filename: string; csv: string } {
  const lines = [
    buildCsvLine(IMPORT_REQUIRED_COLUMNS),
    buildCsvLine(["ABK", "JETTY PT ANUGERAH BARA KALTIM, EAST KALIMANTAN, INDONESIA"]),
  ];
  return { filename: "jetty_template.csv", csv: lines.join("\n") + "\n" };
}

export async function importJettyCsv(
  pool: Pool,
  csvText: string
): Promise<ActionResult> {
  const rows = parseCsv(csvText);
  const header = rows[0];
  if (!header || header.length === 0) {
    return { ok: false, msg: "CSV kosong / header tidak ditemukan." };
  }

  const normalizedHeader = header.map((h) => h.trim().toLowerCase());
  for (const col of IMPORT_REQUIRED_COLUMNS) {
    if (!normalizedHeader.includes(col)) {
      return {
        ok: false,
        msg: "Header CSV salah. Wajib ada kolom: jetty, nama_panjang",
      };
    }
  }

  const colIndex = new Map(normalizedHeader.map((h, i) => [h, i]));
  const cell = (row: string[], col: string) =>
    row[colIndex.get(col) ?? -1] ?? "";

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows.slice(1)) {
    if (row.length === 1 && row[0] === "") continue; // trailing blank line

    const jetty = clean(cell(row, "jetty")).toUpperCase();
    const nama_panjang = clean(cell(row, "nama_panjang"));

    if (!jetty || !nama_panjang) {
      errors++;
      continue;
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM jetty WHERE jetty=?",
      [jetty]
    );
    if (Number(existing[0]?.c ?? 0) > 0) {
      skipped++;
      continue;
    }

    try {
      await pool.query(
        "INSERT INTO jetty (jetty, nama_panjang) VALUES (?,?)",
        [jetty, nama_panjang]
      );
      inserted++;
    } catch {
      errors++;
    }
  }

  return {
    ok: true,
    msg: `Import selesai. Inserted: ${inserted}, Skipped (duplicate): ${skipped}, Error: ${errors}`,
  };
}
