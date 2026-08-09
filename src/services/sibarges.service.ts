import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { addDaysYmd, parseDateAny, romanMonth } from "../lib/date.js";
import { buildCsvLine, detectCsvDelimiter, parseCsv } from "../lib/csv-parser.js";

export type ActionResult =
  | { ok: true; msg: string }
  | { ok: false; msg: string };

export interface SibargesRow {
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
  term: string | null;
  anchorage: string | null;
  qty_plan: number;
  laycan_start: string | null;
  laycan_end: string | null;
  jetty_code: string;
  jetty_name: string | null;
  shipper_code: string;
  shipper_name: string | null;
  record_status: string;
  remarks: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}

interface VesselRow extends RowDataPacket {
  no_pk: string;
  no_si_vessel: string;
  buyer: string;
  mothervessel: string;
  anchorage: string | null;
  term: string | null;
}

export interface ListQuery {
  q?: string;
  filter_month?: string;
  filter_no_pk?: string;
  filter_discarded?: string;
  sort_by?: string;
  sort_dir?: string;
}

export interface CreateInput {
  no_pk?: string;
  si_type?: string;
  tugboat?: string;
  barge?: string;
  qty_plan?: string;
  jetty_code?: string;
  shipper_code?: string;
  laycan_start?: string;
  laycan_end?: string;
  record_status?: string;
  remarks?: string;
}

export interface UpdateInput {
  id?: string;
  tugboat?: string;
  barge?: string;
  term?: string;
  anchorage?: string;
  qty_plan?: string;
  jetty_code?: string;
  shipper_code?: string;
  laycan_start?: string;
  record_status?: string;
  remarks?: string;
}

const SI_TYPES = ["SJN", "SNP"];
const RECORD_STATUSES_WRITABLE = ["ACT", "CANCEL"];
const ANCHORAGES = ["MUARA BERAU", "MUARA JAWA", "PRIMA ANCHORAGE"];
const TERMS = ["FOB", "FAS", "CIF"];

const LIST_SORT_COLUMNS = [
  "si_barges",
  "no_pk",
  "buyer",
  "mothervessel",
  "tugboat",
  "barge",
  "anchorage",
  "qty_plan",
  "jetty_code",
  "shipper_code",
  "record_status",
  "laycan_start",
  "laycan_end",
  "created_at",
];

function clean(s: string | undefined): string {
  return (s ?? "").trim();
}

function cleanCode(s: string | undefined): string {
  return clean(s).toUpperCase();
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

function monthYearFromYmd(ymd: string): { month: number; year: number } {
  const [year, month] = ymd.split("-").map(Number);
  return { month, year };
}

export async function listSibarges(
  pool: Pool,
  query: ListQuery
): Promise<SibargesRow[]> {
  const q = clean(query.q);
  const filterMonth = clean(query.filter_month);
  const filterNoPk = clean(query.filter_no_pk);
  const filterDiscarded = clean(query.filter_discarded) || "hide";
  let sortDir = (clean(query.sort_dir) || "DESC").toUpperCase();
  if (sortDir !== "ASC" && sortDir !== "DESC") sortDir = "DESC";
  let sortBy = clean(query.sort_by) || "created_at";
  if (!LIST_SORT_COLUMNS.includes(sortBy)) sortBy = "created_at";

  let sql = `SELECT
      id, no_pk, no_si_vessel, buyer, mothervessel,
      si_type, month_num, year_num, barge_seq, si_barges,
      tugboat, barge, term, anchorage, qty_plan,
      jetty_code, jetty_name,
      shipper_code, shipper_name,
      laycan_start, laycan_end,
      record_status, remarks,
      created_by, created_at, updated_at
    FROM sibarges`;

  const params: (string | number)[] = [];
  const where: string[] = [];

  if (q !== "") {
    where.push(`(
      si_barges LIKE ? OR
      no_pk LIKE ? OR
      no_si_vessel LIKE ? OR
      buyer LIKE ? OR
      mothervessel LIKE ? OR
      tugboat LIKE ? OR
      barge LIKE ? OR
      jetty_code LIKE ? OR
      shipper_code LIKE ? OR
      record_status LIKE ?
    )`);
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like, like, like, like);
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(filterMonth);
  if (monthMatch) {
    where.push("year_num = ? AND month_num = ?");
    params.push(Number(monthMatch[1]), Number(monthMatch[2]));
  }

  if (filterNoPk !== "") {
    where.push("no_pk = ?");
    params.push(filterNoPk);
  }

  if (filterDiscarded === "only") {
    where.push("record_status = 'DISCARD'");
  } else if (filterDiscarded !== "all") {
    where.push("record_status <> 'DISCARD'");
  }

  if (where.length > 0) {
    sql += " WHERE " + where.join(" AND ");
  }

  sql += ` ORDER BY ${sortBy} ${sortDir}, id DESC LIMIT 800`;

  const [rows] = await pool.query<(SibargesRow & RowDataPacket)[]>(
    { sql, dateStrings: true },
    params
  );
  return rows;
}

export async function getVessel(
  pool: Pool,
  noPkRaw: string
): Promise<{ ok: true; data: VesselRow } | { ok: false; msg: string }> {
  const no_pk = clean(noPkRaw);
  if (no_pk === "") return { ok: false, msg: "no_pk kosong" };

  const [rows] = await pool.query<VesselRow[]>(
    "SELECT no_pk, no_si_vessel, buyer, mothervessel, anchorage, term FROM vessel WHERE no_pk=? LIMIT 1",
    [no_pk]
  );
  const row = rows[0];
  if (!row) {
    return { ok: false, msg: `Vessel tidak ditemukan untuk no_pk: ${no_pk}` };
  }
  return { ok: true, data: row };
}

export async function listVesselTypeahead(
  pool: Pool,
  q: string
): Promise<{ no_pk: string; mothervessel: string }[]> {
  const kw = clean(q);
  let sql = "SELECT no_pk, mothervessel FROM vessel WHERE no_pk IS NOT NULL AND no_pk<>''";
  const params: string[] = [];
  if (kw !== "") {
    sql += " AND (no_pk LIKE ? OR mothervessel LIKE ? OR buyer LIKE ? OR no_si_vessel LIKE ?)";
    const like = `%${kw}%`;
    params.push(like, like, like, like);
  }
  sql += " ORDER BY no_pk DESC LIMIT 60";

  const [rows] = await pool.query<
    ({ no_pk: string; mothervessel: string } & RowDataPacket)[]
  >(sql, params);
  return rows;
}

async function listDistinctFromBarges(
  pool: Pool,
  column: "tugboat" | "barge",
  q: string
): Promise<string[]> {
  const kw = clean(q);
  let sql = `SELECT DISTINCT ${column} AS v FROM barges WHERE ${column} IS NOT NULL AND ${column}<>''`;
  const params: string[] = [];
  if (kw !== "") {
    sql += ` AND ${column} LIKE ?`;
    params.push(`%${kw}%`);
  }
  sql += ` ORDER BY ${column} ASC LIMIT 60`;

  const [rows] = await pool.query<({ v: string } & RowDataPacket)[]>(sql, params);
  return rows.map((r) => r.v);
}

export async function listTugTypeahead(pool: Pool, q: string): Promise<string[]> {
  return listDistinctFromBarges(pool, "tugboat", q);
}

export async function listBargeTypeahead(pool: Pool, q: string): Promise<string[]> {
  return listDistinctFromBarges(pool, "barge", q);
}

async function fkGuardJetty(
  pool: Pool | PoolConnection,
  jettyCode: string
): Promise<{ ok: true; name: string | null } | { ok: false; msg: string }> {
  const [rows] = await pool.query<({ jetty: string; nama_panjang: string } & RowDataPacket)[]>(
    "SELECT jetty, nama_panjang FROM jetty WHERE jetty=? LIMIT 1",
    [jettyCode]
  );
  const row = rows[0];
  if (!row) {
    return { ok: false, msg: `Jetty code tidak valid: '${jettyCode}'` };
  }
  return { ok: true, name: row.nama_panjang ?? null };
}

async function fkGuardShipper(
  pool: Pool | PoolConnection,
  shipperCode: string
): Promise<{ ok: true; name: string | null } | { ok: false; msg: string }> {
  const [rows] = await pool.query<({ shipper: string; nama_lengkap: string } & RowDataPacket)[]>(
    "SELECT shipper, nama_lengkap FROM shipper WHERE shipper=? LIMIT 1",
    [shipperCode]
  );
  const row = rows[0];
  if (!row) {
    return { ok: false, msg: `Shipper code tidak valid: '${shipperCode}'` };
  }
  return { ok: true, name: row.nama_lengkap ?? null };
}

async function maxBargeSeq(pool: Pool | PoolConnection, noPk: string): Promise<number> {
  const [rows] = await pool.query<({ mx: number } & RowDataPacket)[]>(
    "SELECT COALESCE(MAX(barge_seq),0) AS mx FROM sibarges WHERE no_pk=? AND record_status <> 'DISCARD'",
    [noPk]
  );
  return Number(rows[0]?.mx ?? 0);
}

async function nextBargeSeq(pool: Pool | PoolConnection, noPk: string): Promise<number> {
  return (await maxBargeSeq(pool, noPk)) + 1;
}

export async function createSibarges(
  pool: Pool,
  input: CreateInput,
  createdBy: string
): Promise<ActionResult> {
  const no_pk = clean(input.no_pk);
  const si_type = cleanCode(input.si_type ?? "SJN");
  const tugboat = clean(input.tugboat);
  const barge = clean(input.barge);
  const qty_plan = toDecimal(input.qty_plan);
  const jetty_code = cleanCode(input.jetty_code);
  const shipper_code = cleanCode(input.shipper_code);

  const laycan_start = parseDateAny(input.laycan_start);
  let laycan_end = parseDateAny(input.laycan_end);
  if (laycan_start) {
    laycan_end = addDaysYmd(laycan_start, 1);
  }

  let record_status = (clean(input.record_status) || "ACT").toUpperCase();
  if (!RECORD_STATUSES_WRITABLE.includes(record_status)) record_status = "ACT";

  const remarks = clean(input.remarks);

  if (no_pk === "") return { ok: false, msg: "No PK wajib diisi." };
  if (!SI_TYPES.includes(si_type)) {
    return { ok: false, msg: "SI Type harus SJN atau SNP." };
  }
  if (tugboat === "" || barge === "") {
    return { ok: false, msg: "Tugboat dan Barge wajib diisi." };
  }
  if (jetty_code === "") return { ok: false, msg: "Jetty wajib dipilih." };
  if (shipper_code === "") return { ok: false, msg: "Shipper wajib dipilih." };
  if (!laycan_start) return { ok: false, msg: "Laycan Start tidak valid." };
  if (!laycan_end) return { ok: false, msg: "Laycan End tidak valid." };

  const jettyGuard = await fkGuardJetty(pool, jetty_code);
  if (!jettyGuard.ok) return { ok: false, msg: jettyGuard.msg };

  const shipperGuard = await fkGuardShipper(pool, shipper_code);
  if (!shipperGuard.ok) return { ok: false, msg: shipperGuard.msg };

  const vessel = await getVessel(pool, no_pk);
  if (!vessel.ok) {
    return { ok: false, msg: `Data vessel tidak ditemukan untuk no_pk: ${no_pk}` };
  }
  const v = vessel.data;
  const anchorage = clean(v.anchorage ?? "");
  const term = cleanCode(v.term ?? "");
  if (!ANCHORAGES.includes(anchorage)) {
    return {
      ok: false,
      msg: "Anchorage vessel belum diisi atau tidak valid. Update Anchorage di halaman Vessel terlebih dahulu.",
    };
  }
  if (!TERMS.includes(term)) {
    return {
      ok: false,
      msg: "Term vessel belum diisi atau tidak valid. Update Term di halaman Vessel terlebih dahulu.",
    };
  }

  const { month, year } = monthYearFromYmd(laycan_start);
  const roman = romanMonth(month);
  const barge_seq = await nextBargeSeq(pool, no_pk);
  const si_barges = `SI-${si_type}/${roman}/${year}/${v.no_si_vessel}/${barge_seq}`;

  await pool.query(
    `INSERT INTO sibarges (
        no_pk, no_si_vessel, buyer, mothervessel,
        si_type, month_num, year_num, barge_seq, si_barges,
        tugboat, barge, term, anchorage, qty_plan,
        laycan_start, laycan_end,
        jetty_code, jetty_name,
        shipper_code, shipper_name,
        record_status, remarks,
        created_by
      ) VALUES (?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?, ?,?, ?,?, ?,?, ?)`,
    [
      no_pk,
      v.no_si_vessel,
      v.buyer,
      v.mothervessel,
      si_type,
      month,
      year,
      barge_seq,
      si_barges,
      tugboat,
      barge,
      term,
      anchorage,
      qty_plan,
      laycan_start,
      laycan_end,
      jetty_code,
      jettyGuard.name,
      shipper_code,
      shipperGuard.name,
      record_status,
      remarks,
      createdBy,
    ]
  );

  return { ok: true, msg: `SI Barges berhasil dibuat: ${si_barges}` };
}

export async function updateSibarges(
  pool: Pool,
  input: UpdateInput
): Promise<ActionResult> {
  const id = Number(input.id);
  if (!(id > 0)) return { ok: false, msg: "ID tidak valid." };

  const tugboat = clean(input.tugboat);
  const barge = clean(input.barge);
  const term = cleanCode(input.term);
  const anchorage = clean(input.anchorage);
  const qty_plan = toDecimal(input.qty_plan);
  const jetty_code = cleanCode(input.jetty_code);
  const shipper_code = cleanCode(input.shipper_code);

  const laycan_start = parseDateAny(input.laycan_start);
  const laycan_end = laycan_start ? addDaysYmd(laycan_start, 1) : null;

  let record_status = (clean(input.record_status) || "ACT").toUpperCase();
  if (!RECORD_STATUSES_WRITABLE.includes(record_status)) record_status = "ACT";

  const remarks = clean(input.remarks);

  const [statusRows] = await pool.query<({ record_status: string } & RowDataPacket)[]>(
    "SELECT record_status FROM sibarges WHERE id=? LIMIT 1",
    [id]
  );
  const current = statusRows[0];
  if (!current) return { ok: false, msg: "Data SI Barges tidak ditemukan." };
  if (current.record_status === "DISCARD") {
    return {
      ok: false,
      msg: "SI Barges status DISCARD tidak bisa diubah kembali ke ACT/CANCEL.",
    };
  }

  if (tugboat === "" || barge === "") {
    return { ok: false, msg: "Tugboat/Barge wajib diisi." };
  }
  if (!TERMS.includes(term)) return { ok: false, msg: "Term wajib dipilih." };
  if (!ANCHORAGES.includes(anchorage)) {
    return { ok: false, msg: "Anchorage wajib dipilih." };
  }
  if (jetty_code === "") return { ok: false, msg: "Jetty wajib diisi." };
  if (shipper_code === "") return { ok: false, msg: "Shipper wajib diisi." };
  if (!laycan_start) {
    return {
      ok: false,
      msg: "Laycan Start tidak valid. (pakai YYYY-MM-DD atau 16/Dec/25)",
    };
  }
  if (!laycan_end) return { ok: false, msg: "Laycan End tidak valid." };

  const jettyGuard = await fkGuardJetty(pool, jetty_code);
  if (!jettyGuard.ok) return { ok: false, msg: jettyGuard.msg };

  const shipperGuard = await fkGuardShipper(pool, shipper_code);
  if (!shipperGuard.ok) return { ok: false, msg: shipperGuard.msg };

  const { month, year } = monthYearFromYmd(laycan_start);

  await pool.query(
    `UPDATE sibarges SET
      tugboat=?, barge=?, term=?, anchorage=?, qty_plan=?,
        laycan_start=?, laycan_end=?,
        month_num=?, year_num=?,
        jetty_code=?, jetty_name=?,
        shipper_code=?, shipper_name=?,
        record_status=?, remarks=?
      WHERE id=?`,
    [
      tugboat,
      barge,
      term,
      anchorage,
      qty_plan,
      laycan_start,
      laycan_end,
      month,
      year,
      jetty_code,
      jettyGuard.name,
      shipper_code,
      shipperGuard.name,
      record_status,
      remarks,
      id,
    ]
  );

  return { ok: true, msg: "Data SI Barges berhasil diupdate." };
}

interface RenumberRow extends RowDataPacket {
  id: number;
  no_si_vessel: string;
  si_type: string;
  month_num: number;
  year_num: number;
  barge_seq: number;
  si_barges: string;
}

async function renumber(
  conn: PoolConnection,
  whereColumn: "no_pk" | "mothervessel",
  whereValue: string
): Promise<number> {
  const [rows] = await conn.query<RenumberRow[]>(
    `SELECT id, no_si_vessel, si_type, month_num, year_num, barge_seq, si_barges
     FROM sibarges
     WHERE ${whereColumn}=? AND record_status <> 'DISCARD'
     ORDER BY barge_seq ASC, id ASC
     FOR UPDATE`,
    [whereValue]
  );

  let renumbered = 0;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const newSeq = index + 1;
    const siType = cleanCode(row.si_type);
    const roman = romanMonth(row.month_num);
    const year = row.year_num;
    const noSiVessel = clean(row.no_si_vessel);
    if (siType === "" || roman === "" || !(year > 0) || noSiVessel === "") {
      throw new Error("Data SI Barges tidak lengkap saat merapikan nomor urut.");
    }

    const newSiBarges = `SI-${siType}/${roman}/${year}/${noSiVessel}/${newSeq}`;
    if (row.barge_seq === newSeq && row.si_barges === newSiBarges) continue;

    await conn.query("UPDATE sibarges SET barge_seq=?, si_barges=? WHERE id=?", [
      newSeq,
      newSiBarges,
      row.id,
    ]);
    renumbered++;
  }

  return renumbered;
}

async function renumberByNoPk(conn: PoolConnection, noPk: string): Promise<number> {
  return renumber(conn, "no_pk", noPk);
}

async function renumberByMotherVessel(
  conn: PoolConnection,
  motherVessel: string
): Promise<number> {
  if (clean(motherVessel) === "") return 0;
  return renumber(conn, "mothervessel", motherVessel);
}

interface CurrentSibargesRow extends RowDataPacket {
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
  term: string | null;
  anchorage: string | null;
  qty_plan: number;
  laycan_start: string | null;
  laycan_end: string | null;
  jetty_code: string;
  jetty_name: string | null;
  shipper_code: string;
  shipper_name: string | null;
  record_status: string;
  remarks: string | null;
}

export async function changeVessel(
  pool: Pool,
  idRaw: string,
  targetNoPkRaw: string,
  createdBy: string
): Promise<ActionResult> {
  const id = Number(idRaw);
  const target_no_pk = clean(targetNoPkRaw);
  if (!(id > 0)) return { ok: false, msg: "ID tidak valid." };
  if (target_no_pk === "") return { ok: false, msg: "Vessel wajib dipilih." };

  const conn = await pool.getConnection();
  try {
    const [currentRows] = await conn.query<CurrentSibargesRow[]>(
      {
        sql: `SELECT
          id, no_pk, no_si_vessel, buyer, mothervessel,
          si_type, month_num, year_num, barge_seq, si_barges,
          tugboat, barge, term, anchorage, qty_plan,
          laycan_start, laycan_end,
          jetty_code, jetty_name,
          shipper_code, shipper_name,
          record_status, remarks
        FROM sibarges
        WHERE id=? LIMIT 1`,
        dateStrings: true,
      },
      [id]
    );
    const current = currentRows[0];
    if (!current) return { ok: false, msg: "Data SI Barges tidak ditemukan." };
    if (current.record_status === "DISCARD") {
      return {
        ok: false,
        msg: "SI Barges yang sudah DISCARD tidak bisa dipindahkan lagi.",
      };
    }
    if (target_no_pk === current.no_pk) {
      return { ok: false, msg: "Pilih vessel yang berbeda dari vessel saat ini." };
    }

    const [targetRows] = await conn.query<VesselRow[]>(
      "SELECT no_pk, no_si_vessel, buyer, mothervessel, anchorage, term FROM vessel WHERE no_pk=? LIMIT 1",
      [target_no_pk]
    );
    const target = targetRows[0];
    if (!target) {
      return {
        ok: false,
        msg: `Data vessel tidak ditemukan untuk no_pk: ${target_no_pk}`,
      };
    }

    const new_seq = await nextBargeSeq(conn, target_no_pk);

    const si_type = cleanCode(current.si_type ?? "SJN");
    const month_num = current.month_num ?? 0;
    const year_num = current.year_num ?? 0;
    const roman = romanMonth(month_num);
    if (si_type === "" || roman === "" || !(year_num > 0)) {
      return {
        ok: false,
        msg: "Data SI Barges lama tidak lengkap untuk generate nomor SI baru.",
      };
    }

    const new_si_barges = `SI-${si_type}/${roman}/${year_num}/${target.no_si_vessel}/${new_seq}`;
    const target_anchorage = clean(target.anchorage ?? "");
    const target_term = cleanCode(target.term ?? "");
    const new_term = target_term === "" ? current.term : target_term;
    const new_anchorage = target_anchorage === "" ? current.anchorage : target_anchorage;
    const new_record_status = current.record_status === "CANCEL" ? "CANCEL" : "ACT";

    await conn.beginTransaction();
    try {
      await conn.query(
        `INSERT INTO sibarges (
            no_pk, no_si_vessel, buyer, mothervessel,
            si_type, month_num, year_num, barge_seq, si_barges,
            tugboat, barge, term, anchorage, qty_plan,
            laycan_start, laycan_end,
            jetty_code, jetty_name,
            shipper_code, shipper_name,
            record_status, remarks,
            created_by
          ) VALUES (?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?, ?,?, ?,?, ?,?, ?)`,
        [
          target.no_pk,
          target.no_si_vessel,
          target.buyer,
          target.mothervessel,
          si_type,
          month_num,
          year_num,
          new_seq,
          new_si_barges,
          current.tugboat,
          current.barge,
          new_term,
          new_anchorage,
          current.qty_plan,
          current.laycan_start,
          current.laycan_end,
          current.jetty_code,
          current.jetty_name,
          current.shipper_code,
          current.shipper_name,
          new_record_status,
          current.remarks,
          createdBy,
        ]
      );

      await conn.query("UPDATE sibarges SET record_status=? WHERE id=?", [
        "DISCARD",
        id,
      ]);

      const renumbered = await renumberByNoPk(conn, current.no_pk);

      await conn.commit();
      const renumberMsg =
        renumbered > 0 ? ` ${renumbered} nomor SI berikutnya sudah dirapikan.` : "";
      return {
        ok: true,
        msg: `Vessel berhasil diubah. Original SI disimpan sebagai DISCARD. SI Barges baru: ${new_si_barges}.${renumberMsg}`,
      };
    } catch (e) {
      await conn.rollback();
      return {
        ok: false,
        msg: `Gagal change vessel: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  } finally {
    conn.release();
  }
}

export async function deleteSibarges(pool: Pool, idRaw: string): Promise<ActionResult> {
  const id = Number(idRaw);
  if (!(id > 0)) return { ok: false, msg: "ID tidak valid." };

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query<({ mothervessel: string } & RowDataPacket)[]>(
      "SELECT mothervessel FROM sibarges WHERE id=? LIMIT 1",
      [id]
    );
    const row = rows[0];
    if (!row) return { ok: false, msg: "Data SI Barges tidak ditemukan." };
    const mothervessel = row.mothervessel ?? "";

    await conn.beginTransaction();
    try {
      await conn.query("DELETE FROM sibarges WHERE id=?", [id]);
      await renumberByMotherVessel(conn, mothervessel);
      await conn.commit();
      return { ok: true, msg: "Data SI Barges berhasil dihapus." };
    } catch (e) {
      await conn.rollback();
      return {
        ok: false,
        msg: `Gagal hapus data: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  } finally {
    conn.release();
  }
}

export async function deleteAllSibarges(pool: Pool): Promise<ActionResult> {
  await pool.query("DELETE FROM sibarges");
  return { ok: true, msg: "Semua data SI Barges berhasil dihapus." };
}

export interface ImportResult {
  ok: boolean;
  msg: string;
  partial?: boolean;
  inserted?: number;
  errors?: number;
}

export const IMPORT_REQUIRED_COLUMNS = [
  "no_pk",
  "si_type",
  "tugboat",
  "barge",
  "anchorage",
  "qty_plan",
  "jetty_code",
  "shipper_code",
  "laycan_start",
  "laycan_end",
  "record_status",
  "remarks",
];

/** Port of the `?download=sibarges_template` handler (Operation/7sibarges.php:672-688). */
export function buildSibargesTemplateCsv(): { filename: string; csv: string } {
  const lines = [
    buildCsvLine(IMPORT_REQUIRED_COLUMNS),
    buildCsvLine([
      "G.25-052", "SJN", "TB. PRIMA STAR 16", "BG. TAURUS 11", "MUARA BERAU",
      "9000", "CAM", "MHU", "2025-12-16", "2025-12-17", "ACT", "Plan awal",
    ]),
  ];
  return { filename: "sibarges_template.csv", csv: lines.join("\n") + "\n" };
}

export async function importSibargesCsv(
  pool: Pool,
  csvText: string,
  createdBy: string
): Promise<ImportResult> {
  const firstLineEnd = csvText.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? csvText : csvText.slice(0, firstLineEnd);
  const delimiter = detectCsvDelimiter(firstLine);

  const rows = parseCsv(csvText, delimiter);
  const header = rows[0];
  if (!header || header.length === 0) {
    return { ok: false, msg: "CSV kosong / header tidak ditemukan." };
  }

  const normalizedHeader = header.map((h) => h.replace(/^\uFEFF/, "").trim().toLowerCase());
  const missing = IMPORT_REQUIRED_COLUMNS.filter((col) => !normalizedHeader.includes(col));
  if (missing.length > 0) {
    return {
      ok: false,
      msg: `Header CSV salah. Kolom hilang: ${missing.join(", ")}\nWajib ada kolom: ${IMPORT_REQUIRED_COLUMNS.join(", ")}`,
    };
  }

  const colIndex = new Map(normalizedHeader.map((h, i) => [h, i]));
  const cell = (row: string[], col: string) => row[colIndex.get(col) ?? -1] ?? "";

  let inserted = 0;
  let errors = 0;
  const errorDetails: string[] = [];
  const seqCache = new Map<string, number>();

  function addImportError(rowNumber: number, reason: string) {
    errors++;
    if (errorDetails.length < 10) {
      errorDetails.push(`Baris ${rowNumber}: ${reason}`);
    }
  }

  let rowNumber = 1;
  for (const row of rows.slice(1)) {
    rowNumber++;
    const hasValue = row.some((c) => clean(c) !== "");
    if (!hasValue) continue;

    const no_pk = clean(cell(row, "no_pk"));
    const si_type = cleanCode(cell(row, "si_type") || "SJN");
    const tugboat = clean(cell(row, "tugboat"));
    const barge = clean(cell(row, "barge"));
    const anchorage = clean(cell(row, "anchorage"));
    const qty_plan = toDecimal(cell(row, "qty_plan"));
    const jetty_code = cleanCode(cell(row, "jetty_code"));
    const shipper_code = cleanCode(cell(row, "shipper_code"));

    const laycan_start = parseDateAny(cell(row, "laycan_start"));
    const laycan_end = laycan_start ? addDaysYmd(laycan_start, 1) : null;

    let record_status = (clean(cell(row, "record_status")) || "ACT").toUpperCase();
    if (!RECORD_STATUSES_WRITABLE.includes(record_status)) record_status = "ACT";

    const remarks = clean(cell(row, "remarks"));

    const rowErrors: string[] = [];
    if (no_pk === "") rowErrors.push("no_pk kosong");
    if (!SI_TYPES.includes(si_type)) rowErrors.push("si_type harus SJN atau SNP");
    if (tugboat === "") rowErrors.push("tugboat kosong");
    if (barge === "") rowErrors.push("barge kosong");
    if (!ANCHORAGES.includes(anchorage)) rowErrors.push("anchorage tidak valid");
    if (!laycan_start || !laycan_end) rowErrors.push("laycan_start tidak valid");
    if (jetty_code === "") rowErrors.push("jetty_code kosong");
    if (shipper_code === "") rowErrors.push("shipper_code kosong");
    if (rowErrors.length > 0) {
      addImportError(rowNumber, rowErrors.join("; "));
      continue;
    }

    const vessel = await getVessel(pool, no_pk);
    if (!vessel.ok) {
      addImportError(rowNumber, `Data vessel tidak ditemukan untuk no_pk ${no_pk}`);
      continue;
    }
    const v = vessel.data;

    const jettyGuard = await fkGuardJetty(pool, jetty_code);
    if (!jettyGuard.ok) {
      addImportError(rowNumber, `Jetty tidak ditemukan untuk kode ${jetty_code}`);
      continue;
    }

    const shipperGuard = await fkGuardShipper(pool, shipper_code);
    if (!shipperGuard.ok) {
      addImportError(rowNumber, `Shipper tidak ditemukan untuk kode ${shipper_code}`);
      continue;
    }

    const term = cleanCode(v.term ?? "");
    if (!TERMS.includes(term)) {
      addImportError(rowNumber, `Term vessel tidak valid untuk no_pk ${no_pk}`);
      continue;
    }

    const { month, year } = monthYearFromYmd(laycan_start as string);
    const roman = romanMonth(month);

    if (!seqCache.has(no_pk)) {
      seqCache.set(no_pk, await maxBargeSeq(pool, no_pk));
    }
    const barge_seq = (seqCache.get(no_pk) ?? 0) + 1;
    seqCache.set(no_pk, barge_seq);

    const si_barges = `SI-${si_type}/${roman}/${year}/${v.no_si_vessel}/${barge_seq}`;

    try {
      await pool.query(
        `INSERT INTO sibarges (
            no_pk, no_si_vessel, buyer, mothervessel,
            si_type, month_num, year_num, barge_seq, si_barges,
            tugboat, barge, term, anchorage, qty_plan,
            laycan_start, laycan_end,
            jetty_code, jetty_name,
            shipper_code, shipper_name,
            record_status, remarks, created_by
          ) VALUES (?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?, ?,?, ?,?, ?,?,?)`,
        [
          no_pk,
          v.no_si_vessel,
          v.buyer,
          v.mothervessel,
          si_type,
          month,
          year,
          barge_seq,
          si_barges,
          tugboat,
          barge,
          term,
          anchorage,
          qty_plan,
          laycan_start,
          laycan_end,
          jetty_code,
          jettyGuard.name,
          shipper_code,
          shipperGuard.name,
          record_status,
          remarks,
          createdBy,
        ]
      );
      inserted++;
    } catch (e) {
      addImportError(rowNumber, e instanceof Error ? e.message : "Insert gagal");
    }
  }

  let msg = `Import selesai. Inserted: ${inserted}, Error: ${errors}`;
  if (errorDetails.length > 0) msg += "\n" + errorDetails.join("\n");

  return { ok: true, partial: errors > 0, inserted, errors, msg };
}
