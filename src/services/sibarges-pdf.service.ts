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
  shipper.pt AS shipper_pt,
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
  shipper_pt: string | null;
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
      sql: `SELECT ${PDF_ROW_COLUMNS} FROM sibarges LEFT JOIN shipper ON shipper.shipper = sibarges.shipper_code WHERE sibarges.id=? LIMIT 1`,
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
      sql: `SELECT ${PDF_ROW_COLUMNS} FROM sibarges LEFT JOIN shipper ON shipper.shipper = sibarges.shipper_code WHERE sibarges.id IN (${placeholders}) ORDER BY sibarges.id ASC`,
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
      value: `${row.shipper_pt ?? ""} ${row.shipper_name ?? ""}`.replace(/\s+/g, " ").trim(),
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

const SHIPPING_DOCUMENTS: Array<{ text: string; indent?: boolean }> = [
  {
    text: '1. Bill of Lading "Clean on Board" (3 Original + 7 Copy Non Negotiable) Marked Freight Payable',
  },
  { text: "2. Cargo Manifest (3 Original + 7 Copy Non Negotiable)" },
  { text: "3. IIA Certificates ( ASTM Standard )" },
  {
    text: "a. Certificate of Sampling and Analysis (COA); issued by SURVEYOR (1 Original + 7 Copy)",
    indent: true,
  },
  {
    text: "b. Certificate of Weight (COW); issued by SURVEYOR (1 Original + 7 Copy)",
    indent: true,
  },
  {
    text: "c. Draft Survey Report (DSR); issued by SURVEYOR (1 Original + 7 Copy)",
    indent: true,
  },
  {
    text: "d. Certificate of Hold Cleanliness ; issued by SURVEYOR (1 Original + 7 Copy)",
    indent: true,
  },
  {
    text: "e. Certificate of Origin; issued by SURVEYOR (1 Original + 7 Copy)",
    indent: true,
  },
  {
    text: "4. Certificate of Origin (COO); issued by Chamber of Commerce (1 Original + 1 Triplicate + 7 Copy NonNegotiable)",
  },
];

/** Renders a "Shipping Instruction" letter PDF for one sibarges row.
 * Reimplements Operation/7sibarges.php's outputSimplePdf() layout using
 * pdfkit rather than porting its hand-rolled byte-level PDF writer. */
export function renderSibargesPdf(row: SibargesPdfRow): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.margins.right;
    const rightEdge = pageWidth - marginRight;

    const fields = new Map(getSibargesPdfFields(row).map((f) => [f.label, f.value]));

    const { file, width: logoWidth } = logoFileFor((row.si_type ?? "").toUpperCase());
    try {
      const logoPath = path.join(LOGO_DIR, file);
      const { width: srcWidth, height: srcHeight } = (
        doc as unknown as { openImage(src: string): { width: number; height: number } }
      ).openImage(logoPath);
      const logoHeight = (srcHeight / srcWidth) * logoWidth;
      doc.image(logoPath, rightEdge - logoWidth, doc.page.margins.top, { width: logoWidth });
      doc.y = doc.page.margins.top + logoHeight;
    } catch {
      // logo missing/unreadable: continue without it
    }

    const siNo = (fields.get("SI Barges") ?? "").trim();
    const date = (fields.get("Document Date") ?? "").trim();
    const shipper = (fields.get("Shipper") ?? "").trim() || "[Shipper]";
    const portOfLoading = (fields.get("Port of Loading") ?? "").trim() || "[Port of Loading]";
    const portOfDischarge =
      (fields.get("Port of Discharge") ?? "").trim() || "[Port of Discharge]";
    const bargeNomination =
      (fields.get("Barge Nomination") ?? "").trim() || "[Barge Nomination]";
    const laycan = (fields.get("Laycan") ?? "").trim() || "[Laycan]";
    const estLoadingDate = (fields.get("Est. Loading Date") ?? "").trim() || "00 00 00 - 00 00 00";
    const quantity = (fields.get("Quantity") ?? "").trim() || "[Quantity]";

    doc.moveDown(1.5);
    doc.font("Helvetica-Bold").fontSize(18).text("SHIPPING INSTRUCTION", marginLeft, doc.y, {
      width: rightEdge - marginLeft,
      align: "center",
    });

    doc.moveDown(2);
    doc.fontSize(9);
    const labelWidth = 150;
    const valueX = marginLeft + labelWidth + 12;
    const valueWidth = rightEdge - valueX;

    const addRow = (label: string, value: string) => {
      const y = doc.y;
      doc.font("Helvetica").text(label, marginLeft, y, { width: labelWidth, lineBreak: false });
      doc.text(":", marginLeft + labelWidth, y, { lineBreak: false });
      doc.text(value || " ", valueX, y, { width: valueWidth });
      doc.moveDown(0.5);
    };

    addRow("Date", date || "[Date]");
    addRow("No.", siNo || "[No.]");

    doc.moveDown(0.5);
    doc.text("Dear Sir / Madam,", marginLeft, doc.y, { width: rightEdge - marginLeft });
    doc.text("Please find our shipment detail as follows :", marginLeft, doc.y, {
      width: rightEdge - marginLeft,
    });

    doc.moveDown(1);
    const items: Array<[string, string]> = [
      ["1. Shipper", shipper],
      ["2. Consignee", "TO ORDER"],
      ["3. Notify Party", "TO ORDER"],
      ["4. Port of Loading", portOfLoading],
      ["5. Port of Discharge", portOfDischarge],
      ["6. Barge Nomination", bargeNomination],
      ["7. Laycan", laycan],
      ["8. Est. Loading Date", estLoadingDate],
      ["9. Description of Goods", "INDONESIAN STEAM COAL IN BULK"],
      ["10. Quantity", quantity],
      ["11. Term of Delivery", "Transhipment"],
      ["12. Type of Vessel", ""],
    ];
    for (const [label, value] of items) {
      addRow(label, value);
    }

    doc.moveDown(0.5);
    doc.text("Shipping documents :", marginLeft, doc.y, { width: rightEdge - marginLeft });
    doc.moveDown(0.3);
    doc.fontSize(8.2);
    for (const line of SHIPPING_DOCUMENTS) {
      const x = line.indent ? marginLeft + 18 : marginLeft;
      doc.text(line.text, x, doc.y, { width: rightEdge - x });
      doc.moveDown(0.6);
    }

    doc.moveDown(1.5);
    doc.fontSize(9);
    doc.text("Please use appropriately.", marginLeft, doc.y, { width: rightEdge - marginLeft });

    doc.moveDown(4);
    doc.text("Yours Faithfully,", marginLeft, doc.y, { width: rightEdge - marginLeft });
    doc.text("Admin", marginLeft, doc.y, { width: rightEdge - marginLeft });

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
