import type { Pool, RowDataPacket } from "mysql2/promise";
import { parseCsv } from "../lib/csv-parser.js";

export type ActionResult =
  | { ok: true; msg: string }
  | { ok: false; msg: string };

export interface ShipperRow {
  shipper: string;
  pt: string;
  nama_lengkap: string;
  laytime: number | null;
}

export interface ShipperInput {
  shipper: string;
  pt: string;
  nama_lengkap: string;
  laytime: string;
}

function clean(s: string | undefined): string {
  return (s ?? "").trim();
}

function toNullableFloat(s: string | undefined): number | null {
  const v = clean(s);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function listShippers(
  pool: Pool,
  keyword: string
): Promise<ShipperRow[]> {
  const kw = clean(keyword);
  let sql = `SELECT shipper, pt, nama_lengkap, laytime FROM shipper`;
  const params: string[] = [];

  if (kw !== "") {
    sql += " WHERE shipper LIKE ? OR pt LIKE ? OR nama_lengkap LIKE ?";
    const like = `%${kw}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY shipper ASC LIMIT 500";

  const [rows] = await pool.query<(ShipperRow & RowDataPacket)[]>(
    sql,
    params
  );
  return rows;
}

export async function createShipper(
  pool: Pool,
  input: ShipperInput
): Promise<ActionResult> {
  const shipper = clean(input.shipper).toUpperCase();
  const pt = clean(input.pt);
  const nama_lengkap = clean(input.nama_lengkap);
  const laytime = toNullableFloat(input.laytime);

  if (!shipper || !pt || !nama_lengkap) {
    return {
      ok: false,
      msg: "Shipper, PT, dan Nama Lengkap wajib diisi.",
    };
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM shipper WHERE shipper=?",
    [shipper]
  );
  if (Number(existing[0]?.c ?? 0) > 0) {
    return { ok: false, msg: "Kode Shipper sudah ada (harus unik)." };
  }

  await pool.query(
    "INSERT INTO shipper (shipper, pt, nama_lengkap, laytime) VALUES (?,?,?,?)",
    [shipper, pt, nama_lengkap, laytime]
  );

  return { ok: true, msg: "Data shipper berhasil ditambah." };
}

export async function updateShipper(
  pool: Pool,
  input: ShipperInput
): Promise<ActionResult> {
  const shipper = clean(input.shipper).toUpperCase();
  const pt = clean(input.pt);
  const nama_lengkap = clean(input.nama_lengkap);
  const laytime = toNullableFloat(input.laytime);

  if (!shipper || !pt || !nama_lengkap) {
    return { ok: false, msg: "Data update tidak valid." };
  }

  await pool.query(
    "UPDATE shipper SET pt=?, nama_lengkap=?, laytime=? WHERE shipper=?",
    [pt, nama_lengkap, laytime, shipper]
  );

  return { ok: true, msg: "Data shipper berhasil diupdate." };
}

export async function deleteShipper(
  pool: Pool,
  shipperCode: string
): Promise<ActionResult> {
  const shipper = clean(shipperCode).toUpperCase();
  if (!shipper) {
    return { ok: false, msg: "Kode Shipper kosong." };
  }

  await pool.query("DELETE FROM shipper WHERE shipper=?", [shipper]);
  return { ok: true, msg: "Data shipper berhasil dihapus." };
}

export async function deleteAllShippers(pool: Pool): Promise<ActionResult> {
  await pool.query("DELETE FROM shipper");
  return { ok: true, msg: "Semua data shipper berhasil dihapus." };
}

const IMPORT_REQUIRED_COLUMNS = ["shipper", "pt", "nama_lengkap"];

export async function importShipperCsv(
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
        msg: "Header CSV salah. Wajib ada kolom: shipper, pt, nama_lengkap",
      };
    }
  }

  const colIndex = new Map(normalizedHeader.map((h, i) => [h, i]));
  const hasLaytime = colIndex.has("laytime");
  const cell = (row: string[], col: string) =>
    row[colIndex.get(col) ?? -1] ?? "";

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows.slice(1)) {
    if (row.length === 1 && row[0] === "") continue; // trailing blank line

    const shipper = clean(cell(row, "shipper")).toUpperCase();
    const pt = clean(cell(row, "pt"));
    const nama_lengkap = clean(cell(row, "nama_lengkap"));
    const laytime = hasLaytime ? toNullableFloat(cell(row, "laytime")) : null;

    if (!shipper || !pt || !nama_lengkap) {
      errors++;
      continue;
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM shipper WHERE shipper=?",
      [shipper]
    );
    if (Number(existing[0]?.c ?? 0) > 0) {
      skipped++;
      continue;
    }

    try {
      await pool.query(
        "INSERT INTO shipper (shipper, pt, nama_lengkap, laytime) VALUES (?,?,?,?)",
        [shipper, pt, nama_lengkap, laytime]
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
