import type { Pool, RowDataPacket } from "mysql2/promise";
import { parseCsv } from "../lib/csv-parser.js";

export type ActionResult =
  | { ok: true; msg: string }
  | { ok: false; msg: string };

export interface BargesRow {
  id: number;
  tugboat: string;
  barge: string;
  vendor: string | null;
  kontrak: string | null;
  muatan: number | null;
  penalty: string | null;
}

export interface BargesInput {
  id: string;
  tugboat: string;
  barge: string;
  vendor: string;
  kontrak: string;
  muatan: string;
  penalty: string;
}

const ALLOWED_SORT = ["tugboat", "barge", "vendor", "kontrak", "muatan", "penalty"];

function clean(s: string | undefined): string {
  return (s ?? "").trim();
}

function toDecimal(s: string | undefined): number {
  const v = clean(s);
  if (v === "" || v === "-") return 0;
  let stripped = v.replace(/[, ]/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(stripped)) {
    stripped = stripped.replace(/\./g, "");
  }
  const n = Number(stripped);
  return stripped !== "" && Number.isFinite(n) ? n : 0;
}

export async function listBarges(
  pool: Pool,
  keyword: string,
  sort: string | undefined,
  dir: string | undefined
): Promise<BargesRow[]> {
  const kw = clean(keyword);
  const sortCol = ALLOWED_SORT.includes(sort ?? "") ? (sort as string) : "tugboat";
  const sortDir = (dir ?? "").toUpperCase() === "DESC" ? "DESC" : "ASC";

  let sql = `SELECT id, tugboat, barge, vendor, kontrak, muatan, penalty FROM barges`;
  const params: string[] = [];

  if (kw !== "") {
    sql += " WHERE tugboat LIKE ? OR barge LIKE ? OR vendor LIKE ? OR kontrak LIKE ? OR penalty LIKE ?";
    const like = `%${kw}%`;
    params.push(like, like, like, like, like);
  }
  sql += ` ORDER BY ${sortCol} ${sortDir}, tugboat ASC, barge ASC, id DESC LIMIT 500`;

  const [rows] = await pool.query<(BargesRow & RowDataPacket)[]>(sql, params);
  return rows;
}

export async function createBarges(
  pool: Pool,
  input: BargesInput
): Promise<ActionResult> {
  const tugboat = clean(input.tugboat);
  const barge = clean(input.barge);
  if (tugboat === "" || barge === "") {
    return { ok: false, msg: "Tugboat dan Barge wajib diisi." };
  }

  const vendor = clean(input.vendor);
  const kontrak = clean(input.kontrak);
  const muatan = toDecimal(input.muatan);
  const penalty = clean(input.penalty);

  await pool.query(
    `INSERT INTO barges (tugboat, barge, vendor, kontrak, muatan, penalty)
     VALUES (?,?,?,?,?,?)`,
    [tugboat, barge, vendor, kontrak, muatan, penalty]
  );

  return { ok: true, msg: "Data barges berhasil ditambah." };
}

export async function updateBarges(
  pool: Pool,
  input: BargesInput
): Promise<ActionResult> {
  const id = Number(input.id);
  const tugboat = clean(input.tugboat);
  const barge = clean(input.barge);
  if (!(id > 0) || tugboat === "" || barge === "") {
    return { ok: false, msg: "Data update tidak valid." };
  }

  const vendor = clean(input.vendor);
  const kontrak = clean(input.kontrak);
  const muatan = toDecimal(input.muatan);
  const penalty = clean(input.penalty);

  await pool.query(
    `UPDATE barges SET tugboat=?, barge=?, vendor=?, kontrak=?, muatan=?, penalty=?
     WHERE id=?`,
    [tugboat, barge, vendor, kontrak, muatan, penalty, id]
  );

  return { ok: true, msg: "Data barges berhasil diupdate." };
}

export async function deleteBarges(
  pool: Pool,
  idRaw: string
): Promise<ActionResult> {
  const id = Number(idRaw);
  if (!(id > 0)) {
    return { ok: false, msg: "ID kosong / tidak valid." };
  }

  await pool.query("DELETE FROM barges WHERE id=?", [id]);
  return { ok: true, msg: "Data barges berhasil dihapus." };
}

export async function deleteAllBarges(pool: Pool): Promise<ActionResult> {
  await pool.query("DELETE FROM barges");
  return { ok: true, msg: "Semua data barges berhasil dihapus." };
}

const IMPORT_REQUIRED_COLUMNS = ["tugboat", "barge", "vendor", "kontrak", "muatan", "penalty"];

export async function importBargesCsv(
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
        msg: `Header CSV salah. Wajib ada kolom: ${IMPORT_REQUIRED_COLUMNS.join(", ")}`,
      };
    }
  }

  const colIndex = new Map(normalizedHeader.map((h, i) => [h, i]));
  const cell = (row: string[], col: string) =>
    row[colIndex.get(col) ?? -1] ?? "";

  let inserted = 0;
  let errors = 0;

  for (const row of rows.slice(1)) {
    if (row.length === 1 && row[0] === "") continue; // trailing blank line

    const tugboat = clean(cell(row, "tugboat"));
    const barge = clean(cell(row, "barge"));
    if (tugboat === "" || barge === "") {
      errors++;
      continue;
    }

    const vendor = clean(cell(row, "vendor"));
    const kontrak = clean(cell(row, "kontrak"));
    const muatan = toDecimal(cell(row, "muatan"));
    const penalty = clean(cell(row, "penalty"));

    try {
      await pool.query(
        `INSERT INTO barges (tugboat, barge, vendor, kontrak, muatan, penalty)
         VALUES (?,?,?,?,?,?)`,
        [tugboat, barge, vendor, kontrak, muatan, penalty]
      );
      inserted++;
    } catch {
      errors++;
    }
  }

  return {
    ok: true,
    msg: `Import selesai. Inserted: ${inserted}, Error: ${errors}`,
  };
}
