import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";
import type { Pool, RowDataPacket } from "mysql2/promise";
import PDFDocument from "pdfkit";
import { addDaysYmd } from "../lib/date.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");
const LOGO_DIR = path.join(projectRoot, "assets", "img", "logo");

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PDF_ROW_COLUMNS = `
  id, no_pk, no_si_vessel, buyer, mothervessel,
  si_type, month_num, year_num, barge_seq, si_barges,
  tugboat, barge,
  COALESCE(
    NULLIF(anchorage, ''),
    (
      SELECT s2.anchorage
      FROM sibarges s2
      WHERE s2.no_pk = sibarges.no_pk
        AND NULLIF(s2.anchorage, '') IS NOT NULL
      ORDER BY s2.id DESC
      LIMIT 1
    )
  ) AS anchorage,
  qty_plan,
  jetty_code, jetty_name,
  shipper_code, shipper_name,
  laycan_start, laycan_end,
  record_status, remarks,
  created_by, created_at, updated_at
`;

export interface SibargesPdfRow extends RowDataPacket {
  id: number;
  no_pk: string;
  no_si_vessel: string;
  buyer: string;
  mothervessel: string;
  si_type: string;
  month_num: number;
  year_num: number;
  barge_seq: number;
  si_barges: string;
  tugboat: string;
  barge: string;
  anchorage: string | null;
  qty_plan: number;
  jetty_code: string;
  jetty_name: string | null;
  shipper_code: string;
  shipper_name: string | null;
  laycan_start: string | null;
  laycan_end: string | null;
  record_status: string;
  remarks: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}

export async function fetchPdfRow(pool: Pool, id: number): Promise<SibargesPdfRow | null> {
  const [rows] = await pool.query<SibargesPdfRow[]>(
    {
      sql: `SELECT ${PDF_ROW_COLUMNS} FROM sibarges WHERE id=? LIMIT 1`,
      dateStrings: true,
    },
    [id]
  );
  return rows[0] ?? null;
}

export async function fetchPdfRows(pool: Pool, ids: number[]): Promise<SibargesPdfRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await pool.query<SibargesPdfRow[]>(
    {
      sql: `SELECT ${PDF_ROW_COLUMNS} FROM sibarges WHERE id IN (${placeholders}) ORDER BY id ASC`,
      dateStrings: true,
    },
    ids
  );
  return rows;
}

function formatPdfDateDmy(ymd: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd ?? "").trim());
  if (!m) return "";
  return `${m[3]} ${m[2]} ${m[1].slice(2)}`;
}

function formatPdfDocumentDate(ymd: string | null): string {
  const trimmed = (ymd ?? "").trim();
  if (trimmed === "") return "";
  const prev = addDaysYmd(trimmed, -1);
  const m = prev ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(prev) : null;
  if (!m) return "";
  const day = m[3];
  const month = MONTH_ABBR[Number(m[2]) - 1] ?? "";
  const year = m[1];
  return `${day} ${month} ${year}`.toUpperCase();
}

/** Ports buildSibargesPdfFilename() from Operation/7sibarges.php:613-628. */
export function buildSibargesPdfFilename(row: SibargesPdfRow): string {
  const siBarges = (row.si_barges ?? "").trim();
  const segments = siBarges.split("/");
  let n = (segments[segments.length - 1] ?? "").trim();
  if (n === "") n = String(row.id ?? "");

  const tugboat = (row.tugboat ?? "").trim();
  const barge = (row.barge ?? "").trim();
  const mothervessel = (row.mothervessel ?? "").trim();

  let name = `${n}. SI ${tugboat} ${barge} - ${mothervessel}`;
  name = name.replace(/[\\/:*?"<>|]+/g, "_");
  name = name.replace(/\s+/g, " ");

  return name.trim() + ".pdf";
}

export interface PdfField {
  label: string;
  value: string;
}

/** Ports getSibargesPdfFields() from Operation/7sibarges.php:630-669. */
export function getSibargesPdfFields(row: SibargesPdfRow): PdfField[] {
  const anchorage = (row.anchorage ?? "").trim();
  const mothervessel = (row.mothervessel ?? "").trim();
  const tugboat = (row.tugboat ?? "").trim();
  const barge = (row.barge ?? "").trim();
  const portOfDischarge = `${anchorage}, EAST KALIMANTAN, TRANSHIPMENT TO ${mothervessel} OR SUBS`.trim();
  const bargeNomination = `${tugboat} / ${barge}`.trim();
  const laycanStart = formatPdfDateDmy(row.laycan_start);
  const laycanEnd = formatPdfDateDmy(row.laycan_end);
  const laycan = `${laycanStart} - ${laycanEnd}`.trim();
  const documentDate = formatPdfDocumentDate(row.laycan_start);
  const qty = Number(row.qty_plan ?? 0);
  const qtyText =
    qty > 0 ? `${qty.toLocaleString("en-US", { maximumFractionDigits: 0 })} MT +/- 10%` : "";

  return [
    { label: "SI Barges", value: row.si_barges ?? "" },
    { label: "Document Date", value: documentDate },
    { label: "No PK", value: row.no_pk ?? "" },
    { label: "No SI Vessel", value: row.no_si_vessel ?? "" },
    { label: "Buyer", value: row.buyer ?? "" },
    { label: "Mother Vessel", value: row.mothervessel ?? "" },
    { label: "SI Type", value: row.si_type ?? "" },
    { label: "Tugboat", value: row.tugboat ?? "" },
    { label: "Barge", value: row.barge ?? "" },
    { label: "Qty Plan", value: String(row.qty_plan ?? "") },
    { label: "Quantity", value: qtyText },
    { label: "Jetty", value: `${row.jetty_code ?? ""} - ${row.jetty_name ?? ""}`.trim() },
    { label: "Port of Loading", value: (row.jetty_name || row.jetty_code || "").trim() },
    { label: "Port of Discharge", value: portOfDischarge },
    { label: "Barge Nomination", value: bargeNomination },
    { label: "Laycan", value: laycan },
    {
      label: "Shipper",
      value: (row.shipper_name ?? "").replace(/\s+/g, " ").trim(),
    },
    { label: "Laycan Start", value: row.laycan_start ?? "" },
    { label: "Laycan End", value: row.laycan_end ?? "" },
    { label: "Status", value: row.record_status ?? "" },
    { label: "Remarks", value: row.remarks ?? "" },
    { label: "Created By", value: row.created_by ?? "" },
    { label: "Created At", value: row.created_at ?? "" },
  ];
}

function logoFileFor(siType: string): { file: string; width: number } {
  return siType === "SNP"
    ? { file: "snp.png", width: 160 }
    : { file: "sjn.png", width: 210 };
}

/** Renders a "Shipping Instruction" PDF for one sibarges row. Reimplements
 * the field layout of Operation/7sibarges.php's outputSimplePdf() using
 * pdfkit rather than porting its hand-rolled byte-level PDF writer. */
export function renderSibargesPdf(row: SibargesPdfRow): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { file, width } = logoFileFor(row.si_type);
    try {
      doc.image(path.join(LOGO_DIR, file), { width });
    } catch {
      // logo missing/unreadable: continue without it
    }

    doc.moveDown();
    doc.fontSize(14).text("SI Barges Detail", { underline: true });
    doc.moveDown();

    doc.fontSize(10);
    for (const field of getSibargesPdfFields(row)) {
      doc.font("Helvetica-Bold").text(`${field.label}: `, { continued: true });
      doc.font("Helvetica").text(field.value || "-");
    }

    doc.end();
  });
}

/** Bundles multiple rows' PDFs into a single ZIP under "All SI/", suffixing
 * colliding filenames, mirroring Operation/7sibarges.php:738-823. */
export async function renderSibargesZip(rows: SibargesPdfRow[]): Promise<Buffer> {
  const archive = archiver("zip");
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });

  const usedNames = new Map<string, number>();
  for (const row of rows) {
    const pdfBytes = await renderSibargesPdf(row);
    let name = buildSibargesPdfFilename(row);
    const count = usedNames.get(name);
    if (count !== undefined) {
      const next = count + 1;
      usedNames.set(name, next);
      name = name.replace(/\.pdf$/, "") + `_${next}.pdf`;
    } else {
      usedNames.set(name, 1);
    }
    archive.append(pdfBytes, { name: `All SI/${name}` });
  }

  await archive.finalize();
  return done;
}
