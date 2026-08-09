import type { Pool, RowDataPacket } from "mysql2/promise";
import { buildCsvLine, parseCsv } from "../lib/csv-parser.js";

export type ActionResult =
  | { ok: true; msg: string }
  | { ok: false; msg: string };

export interface VendorRow {
  id: number;
  vendor: string;
  shipper: string | null;
  freight: number | null;
  tonnage: number | null;
  penalty: string | null;
  discount: number | null;
  contract: string | null;
  laytime: number | null;
  ltc_rate: number | null;
}

export interface VendorInput {
  id: string;
  vendor: string;
  shipper: string;
  freight: string;
  tonnage: string;
  penalty: string;
  discount: string;
  contract: string;
  laytime: string;
  ltc_rate: string;
}

const ALLOWED_SORT = [
  "vendor",
  "shipper",
  "freight",
  "tonnage",
  "penalty",
  "discount",
  "contract",
  "laytime",
  "ltc_rate",
];

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

function computeFreight(shipper: string): number {
  switch (clean(shipper).toUpperCase()) {
    case "MHU":
      return 51500;
    case "CAM":
      return 85000;
    default:
      return 0;
  }
}

function computeContract(shipper: string): string {
  switch (clean(shipper).toUpperCase()) {
    case "MHU":
      return "3";
    case "CAM":
      return "2";
    default:
      return "";
  }
}

function computeLtcRate(
  freight: number,
  tonnage: number,
  contract: string
): number {
  const contractNum = contract === "" ? 0 : Number(contract);
  const c = Number.isFinite(contractNum) ? contractNum : 0;
  return Math.round((freight * tonnage * c) / 30);
}

function normalizePenalty(s: string | undefined): string | null {
  const v = clean(s).toUpperCase();
  return v === "DF" || v === "CQD" ? v : null;
}

async function getShipperLaytime(
  pool: Pool,
  shipper: string
): Promise<number> {
  const code = clean(shipper).toUpperCase();
  if (code === "") return 0;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT laytime FROM shipper WHERE shipper=?",
    [code]
  );
  const laytime = rows[0]?.laytime;
  return laytime !== undefined && laytime !== null ? Number(laytime) : 0;
}

interface ResolvedDefaults {
  freight: number;
  contract: string;
  laytime: number;
  ltc_rate: number;
}

async function resolveDefaults(
  pool: Pool,
  input: Pick<
    VendorInput,
    "shipper" | "freight" | "contract" | "laytime" | "ltc_rate" | "tonnage"
  >
): Promise<ResolvedDefaults> {
  const shipper = clean(input.shipper);
  const tonnage = toDecimal(input.tonnage);

  const freightRaw = clean(input.freight);
  const freight = freightRaw !== "" ? toDecimal(freightRaw) : computeFreight(shipper);

  const contractRaw = clean(input.contract);
  const contract = contractRaw !== "" ? contractRaw : computeContract(shipper);

  const laytimeRaw = clean(input.laytime);
  const laytime =
    laytimeRaw !== ""
      ? toDecimal(laytimeRaw)
      : (await getShipperLaytime(pool, shipper)) || 0;

  const ltcRateRaw = clean(input.ltc_rate);
  const ltc_rate =
    ltcRateRaw !== ""
      ? toDecimal(ltcRateRaw)
      : computeLtcRate(freight, tonnage, contract);

  return { freight, contract, laytime, ltc_rate };
}

export async function listVendors(
  pool: Pool,
  keyword: string,
  sort: string | undefined,
  dir: string | undefined
): Promise<VendorRow[]> {
  const kw = clean(keyword);
  const sortCol = ALLOWED_SORT.includes(sort ?? "") ? (sort as string) : "vendor";
  const sortDir = (dir ?? "").toUpperCase() === "DESC" ? "DESC" : "ASC";

  let sql = `SELECT id, vendor, shipper, freight, tonnage, penalty, discount, contract, laytime, ltc_rate FROM vendor`;
  const params: string[] = [];

  if (kw !== "") {
    sql += " WHERE vendor LIKE ? OR shipper LIKE ? OR contract LIKE ?";
    const like = `%${kw}%`;
    params.push(like, like, like);
  }
  sql += ` ORDER BY ${sortCol} ${sortDir}, vendor ASC, id DESC LIMIT 500`;

  const [rows] = await pool.query<(VendorRow & RowDataPacket)[]>(sql, params);
  return rows;
}

export async function createVendor(
  pool: Pool,
  input: VendorInput
): Promise<ActionResult> {
  const vendor = clean(input.vendor);
  if (vendor === "") {
    return { ok: false, msg: "Barge Vendor wajib diisi." };
  }

  const shipper = clean(input.shipper);
  const tonnage = toDecimal(input.tonnage);
  const discount = toDecimal(input.discount);
  const penalty = normalizePenalty(input.penalty);
  const { freight, contract, laytime, ltc_rate } = await resolveDefaults(
    pool,
    input
  );

  await pool.query(
    `INSERT INTO vendor (vendor, shipper, freight, tonnage, penalty, discount, contract, laytime, ltc_rate)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [vendor, shipper, freight, tonnage, penalty, discount, contract, laytime, ltc_rate]
  );

  return { ok: true, msg: "Data Barge Vendor berhasil ditambah." };
}

export async function updateVendor(
  pool: Pool,
  input: VendorInput
): Promise<ActionResult> {
  const id = Number(input.id);
  const vendor = clean(input.vendor);
  if (!(id > 0) || vendor === "") {
    return { ok: false, msg: "Data update tidak valid." };
  }

  const shipper = clean(input.shipper);
  const tonnage = toDecimal(input.tonnage);
  const discount = toDecimal(input.discount);
  const penalty = normalizePenalty(input.penalty);
  const { freight, contract, laytime, ltc_rate } = await resolveDefaults(
    pool,
    input
  );

  await pool.query(
    `UPDATE vendor SET vendor=?, shipper=?, freight=?, tonnage=?, penalty=?, discount=?, contract=?, laytime=?, ltc_rate=?
     WHERE id=?`,
    [vendor, shipper, freight, tonnage, penalty, discount, contract, laytime, ltc_rate, id]
  );

  return { ok: true, msg: "Data Barge Vendor berhasil diupdate." };
}

export async function deleteVendor(
  pool: Pool,
  idRaw: string
): Promise<ActionResult> {
  const id = Number(idRaw);
  if (!(id > 0)) {
    return { ok: false, msg: "ID kosong / tidak valid." };
  }

  await pool.query("DELETE FROM vendor WHERE id=?", [id]);
  return { ok: true, msg: "Data Barge Vendor berhasil dihapus." };
}

export async function deleteAllVendors(pool: Pool): Promise<ActionResult> {
  await pool.query("DELETE FROM vendor");
  return { ok: true, msg: "Semua data Barge Vendor berhasil dihapus." };
}

const IMPORT_REQUIRED_COLUMNS = [
  "vendor",
  "shipper",
  "tonnage",
  "penalty",
  "discount",
  "contract",
  "laytime",
  "ltc_rate",
];

/** Port of the `?download=vendor_template` handler (Operation/3vendor.php:94-103).
 * freight is optional in importVendorCsv (see hasFreight below) — resolveDefaults
 * computes it from shipper when blank — but it's still a real column, so it
 * stays in the template. */
export const VENDOR_TEMPLATE_COLUMNS: readonly string[] = [
  "vendor",
  "shipper",
  "freight",
  "tonnage",
  "penalty",
  "discount",
  "contract",
  "laytime",
  "ltc_rate",
];

export function buildVendorTemplateCsv(): { filename: string; csv: string } {
  const lines = [
    buildCsvLine(VENDOR_TEMPLATE_COLUMNS),
    buildCsvLine(["BMC", "MHU", "51500", "8200", "DF", "0", "3", "9", "1500"]),
  ];
  return { filename: "vendor_template.csv", csv: lines.join("\n") + "\n" };
}

export async function importVendorCsv(
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
  const hasFreight = colIndex.has("freight");
  const cell = (row: string[], col: string) =>
    row[colIndex.get(col) ?? -1] ?? "";

  let inserted = 0;
  let errors = 0;

  for (const row of rows.slice(1)) {
    if (row.length === 1 && row[0] === "") continue; // trailing blank line

    const vendor = clean(cell(row, "vendor"));
    if (vendor === "") {
      errors++;
      continue;
    }

    const shipper = clean(cell(row, "shipper"));
    const tonnage = toDecimal(cell(row, "tonnage"));
    const discount = toDecimal(cell(row, "discount"));
    const penalty = normalizePenalty(cell(row, "penalty"));
    const { freight, contract, laytime, ltc_rate } = await resolveDefaults(
      pool,
      {
        shipper,
        freight: hasFreight ? cell(row, "freight") : "",
        contract: cell(row, "contract"),
        laytime: cell(row, "laytime"),
        ltc_rate: cell(row, "ltc_rate"),
        tonnage: cell(row, "tonnage"),
      }
    );

    try {
      await pool.query(
        `INSERT INTO vendor (vendor, shipper, freight, tonnage, penalty, discount, contract, laytime, ltc_rate)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [vendor, shipper, freight, tonnage, penalty, discount, contract, laytime, ltc_rate]
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
