import type { Pool, RowDataPacket } from "mysql2/promise";
import { buildCsvLine, parseCsv } from "../lib/csv-parser.js";

export type ActionResult =
  | { ok: true; msg: string }
  | { ok: false; msg: string };

export interface FlfRow {
  floating_crane: string;
  vendor_flf: string;
  pbm: string;
  anchorage: string;
}

export interface FlfInput {
  floating_crane: string;
  vendor_flf: string;
  pbm: string;
  anchorage: string;
}

function clean(s: string | undefined): string {
  return (s ?? "").trim();
}

export async function listFlf(pool: Pool, keyword: string): Promise<FlfRow[]> {
  const kw = clean(keyword);
  let sql = `SELECT floating_crane, vendor_flf, pbm, anchorage FROM flf`;
  const params: string[] = [];

  if (kw !== "") {
    sql +=
      " WHERE floating_crane LIKE ? OR vendor_flf LIKE ? OR pbm LIKE ? OR anchorage LIKE ?";
    const like = `%${kw}%`;
    params.push(like, like, like, like);
  }
  sql += " ORDER BY floating_crane ASC LIMIT 500";

  const [rows] = await pool.query<(FlfRow & RowDataPacket)[]>(sql, params);
  return rows;
}

export async function createFlf(
  pool: Pool,
  input: FlfInput
): Promise<ActionResult> {
  const floating_crane = clean(input.floating_crane).toUpperCase();
  const vendor_flf = clean(input.vendor_flf);
  const pbm = clean(input.pbm);
  const anchorage = clean(input.anchorage);

  if (!floating_crane || !vendor_flf || !pbm || !anchorage) {
    return {
      ok: false,
      msg: "Floating Crane, Vendor, PBM, dan Anchorage wajib diisi.",
    };
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM flf WHERE floating_crane=?",
    [floating_crane]
  );
  if (Number(existing[0]?.c ?? 0) > 0) {
    return { ok: false, msg: "Floating Crane sudah ada (harus unik)." };
  }

  await pool.query(
    "INSERT INTO flf (floating_crane, vendor_flf, pbm, anchorage) VALUES (?,?,?,?)",
    [floating_crane, vendor_flf, pbm, anchorage]
  );

  return { ok: true, msg: "Data FLF berhasil ditambah." };
}

export async function updateFlf(
  pool: Pool,
  input: FlfInput
): Promise<ActionResult> {
  const floating_crane = clean(input.floating_crane).toUpperCase();
  const vendor_flf = clean(input.vendor_flf);
  const pbm = clean(input.pbm);
  const anchorage = clean(input.anchorage);

  if (!floating_crane || !vendor_flf || !pbm || !anchorage) {
    return { ok: false, msg: "Data update tidak valid." };
  }

  await pool.query(
    "UPDATE flf SET vendor_flf=?, pbm=?, anchorage=? WHERE floating_crane=?",
    [vendor_flf, pbm, anchorage, floating_crane]
  );

  return { ok: true, msg: "Data FLF berhasil diupdate." };
}

export async function deleteFlf(
  pool: Pool,
  floatingCrane: string
): Promise<ActionResult> {
  const floating_crane = clean(floatingCrane).toUpperCase();
  if (!floating_crane) {
    return { ok: false, msg: "Floating Crane kosong." };
  }

  await pool.query("DELETE FROM flf WHERE floating_crane=?", [floating_crane]);
  return { ok: true, msg: "Data FLF berhasil dihapus." };
}

export async function deleteAllFlf(pool: Pool): Promise<ActionResult> {
  await pool.query("DELETE FROM flf");
  return { ok: true, msg: "Semua data flf berhasil dihapus." };
}

export const IMPORT_REQUIRED_COLUMNS = [
  "floating_crane",
  "vendor_flf",
  "pbm",
  "anchorage",
];

/** Port of the `?download=flf_template` handler (Operation/6flf.php:20-32). */
export function buildFlfTemplateCsv(): { filename: string; csv: string } {
  const lines = [
    buildCsvLine(IMPORT_REQUIRED_COLUMNS),
    buildCsvLine(["FC RATU DEWATA", "PSS", "FLOATING CRANE", "M.BERAU"]),
  ];
  return { filename: "flf_template.csv", csv: lines.join("\n") + "\n" };
}

export async function importFlfCsv(
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
        msg: "Header CSV salah. Wajib ada kolom: floating_crane, vendor_flf, pbm, anchorage",
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

    const floating_crane = clean(cell(row, "floating_crane")).toUpperCase();
    const vendor_flf = clean(cell(row, "vendor_flf"));
    const pbm = clean(cell(row, "pbm"));
    const anchorage = clean(cell(row, "anchorage"));

    if (!floating_crane || !vendor_flf || !pbm || !anchorage) {
      errors++;
      continue;
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM flf WHERE floating_crane=?",
      [floating_crane]
    );
    if (Number(existing[0]?.c ?? 0) > 0) {
      skipped++;
      continue;
    }

    try {
      await pool.query(
        "INSERT INTO flf (floating_crane, vendor_flf, pbm, anchorage) VALUES (?,?,?,?)",
        [floating_crane, vendor_flf, pbm, anchorage]
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
