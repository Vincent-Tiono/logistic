import type { Pool, RowDataPacket } from "mysql2/promise";

export type ActionResult =
  | { ok: true; msg: string }
  | { ok: false; msg: string };

export interface VesselRow {
  no_pk: string;
  no_si_vessel: string;
  buyer: string;
  mothervessel: string;
  anchorage: string | null;
  term: string | null;
  laycan_start: string | null;
  laycan_end: string | null;
  ta_vessel: string | null;
  pkk: string | null;
  rkbm: string | null;
  single_mt: string;
  blending_mt: string;
  stowageplan_mt: string;
  loading_rate_kontrak: string;
  created_at: string;
}

export interface VesselInput {
  no_pk: string;
  no_si_vessel: string;
  buyer: string;
  mothervessel: string;
  anchorage: string;
  term: string;
  laycan_start: string;
  laycan_end: string;
  ta_vessel: string;
  pkk: string;
  rkbm: string;
  single_mt: string;
  blending_mt: string;
  stowageplan_mt: string;
  loading_rate_kontrak: string;
}

const ANCHORAGES = ["MUARA BERAU", "MUARA JAWA", "PRIMA ANCHORAGE"];
const TERMS = ["FOB", "FAS", "CIF"];

function clean(s: string | undefined): string {
  return (s ?? "").trim();
}

function cleanAnchorage(s: string | undefined): string {
  const value = clean(s).toUpperCase();
  return ANCHORAGES.includes(value) ? value : "";
}

function cleanTerm(s: string | undefined): string {
  const value = clean(s).toUpperCase();
  return TERMS.includes(value) ? value : "";
}

function toDate(s: string | undefined): string | null {
  const v = clean(s);
  if (v === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const ts = Date.parse(v);
  if (!Number.isNaN(ts)) return new Date(ts).toISOString().slice(0, 10);
  return null;
}

function toDateTime(s: string | undefined): string | null {
  const v = clean(s);
  if (v === "") return null;

  const m = v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/);
  if (m) return `${m[1]} ${m[2]}${m[3] ?? ":00"}`;

  const ts = Date.parse(v);
  if (!Number.isNaN(ts)) {
    return new Date(ts).toISOString().slice(0, 19).replace("T", " ");
  }
  return null;
}

function toDecimal(s: string | undefined): number {
  const v = clean(s);
  if (v === "" || v === "-") return 0;
  const stripped = v.replace(/[, ]/g, "");
  const n = Number(stripped);
  return stripped !== "" && Number.isFinite(n) ? n : 0;
}

/** Minimal RFC4180-ish CSV parser: comma delimiter, double-quote enclosure
 * with "" escaping, tolerant of trailing rows with no newline. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // skip
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function stowageOrSum(rawStowage: string, single: number, blending: number) {
  const stowage = toDecimal(rawStowage);
  return stowage === 0 ? single + blending : stowage;
}

export async function listVessels(
  pool: Pool,
  keyword: string
): Promise<VesselRow[]> {
  const kw = clean(keyword);
  let sql =
    `SELECT no_pk, no_si_vessel, buyer, mothervessel, anchorage, term, laycan_start, laycan_end, ta_vessel, pkk, rkbm,` +
    ` single_mt, blending_mt, stowageplan_mt, loading_rate_kontrak, created_at FROM vessel`;
  const params: string[] = [];

  if (kw !== "") {
    sql +=
      " WHERE no_pk LIKE ? OR no_si_vessel LIKE ? OR buyer LIKE ? OR mothervessel LIKE ? OR anchorage LIKE ? OR term LIKE ?";
    const like = `%${kw}%`;
    params.push(like, like, like, like, like, like);
  }
  sql += " ORDER BY created_at DESC, no_pk DESC LIMIT 500";

  const [rows] = await pool.query<(VesselRow & RowDataPacket)[]>(sql, params);
  return rows;
}

export async function createVessel(
  pool: Pool,
  input: VesselInput
): Promise<ActionResult> {
  const no_pk = clean(input.no_pk);
  const no_si_vessel = clean(input.no_si_vessel);
  const buyer = clean(input.buyer);
  const mothervessel = clean(input.mothervessel);
  const anchorage = cleanAnchorage(input.anchorage);
  const term = cleanTerm(input.term);

  if (
    !no_pk ||
    !no_si_vessel ||
    !buyer ||
    !mothervessel ||
    !anchorage ||
    !term
  ) {
    return {
      ok: false,
      msg: "No. Reff, No SI Vessel, Buyer, MotherVessel, Anchorage, dan Term wajib diisi.",
    };
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM vessel WHERE no_pk=?",
    [no_pk]
  );
  if (Number(existing[0]?.c ?? 0) > 0) {
    return { ok: false, msg: "No. Reff sudah ada. Harus unik." };
  }

  const single = toDecimal(input.single_mt);
  const blending = toDecimal(input.blending_mt);
  const stowage = stowageOrSum(input.stowageplan_mt, single, blending);

  await pool.query(
    `INSERT INTO vessel
      (no_pk, no_si_vessel, buyer, mothervessel, anchorage, term, laycan_start, laycan_end, ta_vessel, pkk, rkbm, single_mt, blending_mt, stowageplan_mt, loading_rate_kontrak)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      no_pk,
      no_si_vessel,
      buyer,
      mothervessel,
      anchorage,
      term,
      toDate(input.laycan_start),
      toDate(input.laycan_end),
      toDateTime(input.ta_vessel),
      toDateTime(input.pkk),
      toDateTime(input.rkbm),
      single,
      blending,
      stowage,
      toDecimal(input.loading_rate_kontrak),
    ]
  );

  return { ok: true, msg: "Data vessel berhasil ditambah." };
}

export async function updateVessel(
  pool: Pool,
  input: VesselInput
): Promise<ActionResult> {
  const no_pk = clean(input.no_pk);
  const no_si_vessel = clean(input.no_si_vessel);
  const buyer = clean(input.buyer);
  const mothervessel = clean(input.mothervessel);
  const anchorage = cleanAnchorage(input.anchorage);
  const term = cleanTerm(input.term);

  if (
    !no_pk ||
    !no_si_vessel ||
    !buyer ||
    !mothervessel ||
    !anchorage ||
    !term
  ) {
    return { ok: false, msg: "Data update tidak valid." };
  }

  const single = toDecimal(input.single_mt);
  const blending = toDecimal(input.blending_mt);
  const stowage = stowageOrSum(input.stowageplan_mt, single, blending);

  await pool.query(
    `UPDATE vessel
     SET no_si_vessel=?, buyer=?, mothervessel=?, anchorage=?, term=?, laycan_start=?, laycan_end=?, ta_vessel=?, pkk=?, rkbm=?,
         single_mt=?, blending_mt=?, stowageplan_mt=?, loading_rate_kontrak=?
     WHERE no_pk=?`,
    [
      no_si_vessel,
      buyer,
      mothervessel,
      anchorage,
      term,
      toDate(input.laycan_start),
      toDate(input.laycan_end),
      toDateTime(input.ta_vessel),
      toDateTime(input.pkk),
      toDateTime(input.rkbm),
      single,
      blending,
      stowage,
      toDecimal(input.loading_rate_kontrak),
      no_pk,
    ]
  );

  return { ok: true, msg: "Data vessel berhasil diupdate." };
}

export async function deleteVessel(
  pool: Pool,
  noPk: string
): Promise<ActionResult> {
  const no_pk = clean(noPk);
  if (!no_pk) {
    return { ok: false, msg: "No. Reff kosong." };
  }

  await pool.query("DELETE FROM vessel WHERE no_pk=?", [no_pk]);
  return { ok: true, msg: "Data vessel berhasil dihapus." };
}

export async function deleteAllVessels(pool: Pool): Promise<ActionResult> {
  await pool.query("DELETE FROM vessel");
  return { ok: true, msg: "Semua data vessel berhasil dihapus." };
}

const IMPORT_REQUIRED_COLUMNS = [
  "no_pk",
  "no_si_vessel",
  "buyer",
  "mothervessel",
  "anchorage",
  "term",
  "laycan_start",
  "laycan_end",
  "ta_vessel",
  "single_mt",
  "blending_mt",
  "stowageplan_mt",
  "loading_rate_kontrak",
];

export async function importVesselCsv(
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
  let skipped = 0;
  let errors = 0;

  for (const row of rows.slice(1)) {
    if (row.length === 1 && row[0] === "") continue; // trailing blank line

    const no_pk = clean(cell(row, "no_pk"));
    const no_si_vessel = clean(cell(row, "no_si_vessel"));
    const buyer = clean(cell(row, "buyer"));
    const mothervessel = clean(cell(row, "mothervessel"));
    const anchorage = cleanAnchorage(cell(row, "anchorage"));
    const term = cleanTerm(cell(row, "term"));

    if (
      !no_pk ||
      !no_si_vessel ||
      !buyer ||
      !mothervessel ||
      !anchorage ||
      !term
    ) {
      errors++;
      continue;
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM vessel WHERE no_pk=?",
      [no_pk]
    );
    if (Number(existing[0]?.c ?? 0) > 0) {
      skipped++;
      continue;
    }

    const single = toDecimal(cell(row, "single_mt"));
    const blending = toDecimal(cell(row, "blending_mt"));
    const stowage = stowageOrSum(cell(row, "stowageplan_mt"), single, blending);

    try {
      await pool.query(
        `INSERT INTO vessel
          (no_pk, no_si_vessel, buyer, mothervessel, anchorage, term, laycan_start, laycan_end, ta_vessel, pkk, rkbm, single_mt, blending_mt, stowageplan_mt, loading_rate_kontrak)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          no_pk,
          no_si_vessel,
          buyer,
          mothervessel,
          anchorage,
          term,
          toDate(cell(row, "laycan_start")),
          toDate(cell(row, "laycan_end")),
          toDateTime(cell(row, "ta_vessel")),
          toDateTime(cell(row, "pkk")),
          toDateTime(cell(row, "rkbm")),
          single,
          blending,
          stowage,
          toDecimal(cell(row, "loading_rate_kontrak")),
        ]
      );
      inserted++;
    } catch {
      errors++;
    }
  }

  return {
    ok: true,
    msg: `Import selesai. Inserted: ${inserted}, Skipped (duplicate No. Reff): ${skipped}, Error: ${errors}`,
  };
}
