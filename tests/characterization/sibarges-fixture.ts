import mysql from "mysql2/promise";

function pool() {
  return mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER ?? "logistic_app",
    password: process.env.DB_PASS ?? "user123",
    database: "databarging",
  });
}

export interface SibargesSeed {
  no_pk: string;
  no_si_vessel: string;
  buyer: string;
  mothervessel: string;
  si_type?: string;
  month_num?: number;
  year_num?: number;
  barge_seq?: number;
  si_barges?: string;
  tugboat?: string;
  barge?: string;
  term?: string | null;
  anchorage?: string | null;
  qty_plan?: number;
  laycan_start?: string | null;
  laycan_end?: string | null;
  jetty_code: string;
  jetty_name?: string | null;
  shipper_code: string;
  shipper_name?: string | null;
  record_status?: string;
  remarks?: string | null;
  created_by?: string;
}

/** Seeds a disposable sibarges row directly, bypassing the app under test.
 * Returns the auto-increment id (surrogate PK, unlike Jetty/Shipper/FLF). */
export async function seedSibargesRow(seed: SibargesSeed): Promise<number> {
  const p = pool();
  const si_type = seed.si_type ?? "SJN";
  const month_num = seed.month_num ?? 1;
  const year_num = seed.year_num ?? 2025;
  const barge_seq = seed.barge_seq ?? 1;
  const si_barges =
    seed.si_barges ?? `SI-${si_type}/I/${year_num}/${seed.no_si_vessel}/${barge_seq}`;

  const [result] = await p.query<mysql.ResultSetHeader>(
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
      seed.no_pk,
      seed.no_si_vessel,
      seed.buyer,
      seed.mothervessel,
      si_type,
      month_num,
      year_num,
      barge_seq,
      si_barges,
      seed.tugboat ?? "TB. TEST",
      seed.barge ?? "BG. TEST",
      seed.term ?? "FOB",
      seed.anchorage ?? "MUARA BERAU",
      seed.qty_plan ?? 1000,
      seed.laycan_start ?? "2025-01-01",
      seed.laycan_end ?? "2025-01-02",
      seed.jetty_code,
      seed.jetty_name ?? null,
      seed.shipper_code,
      seed.shipper_name ?? null,
      seed.record_status ?? "ACT",
      seed.remarks ?? null,
      seed.created_by ?? "test",
    ]
  );
  await p.end();
  return result.insertId;
}

export async function deleteSibargesRow(id: number): Promise<void> {
  if (!id) return;
  const p = pool();
  await p.query("DELETE FROM sibarges WHERE id = ?", [id]);
  await p.end();
}

export async function deleteSibargesRowsByNoPk(no_pk: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM sibarges WHERE no_pk = ?", [no_pk]);
  await p.end();
}

export async function getSibargesRow(
  id: number
): Promise<mysql.RowDataPacket | null> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT * FROM sibarges WHERE id = ?",
    [id]
  );
  await p.end();
  return rows[0] ?? null;
}

export async function countSibargesRows(): Promise<number> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM sibarges"
  );
  await p.end();
  return Number(rows[0]?.c ?? 0);
}
