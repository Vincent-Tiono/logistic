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

export interface BargesSeed {
  tugboat: string;
  barge: string;
  vendor?: string | null;
  kontrak?: string | null;
  muatan?: number | null;
  penalty?: string | null;
}

/** Seeds a disposable barges row directly, bypassing the app under test. Returns the auto-increment id. */
export async function seedBargesRow(seed: BargesSeed): Promise<number> {
  const p = pool();
  const [result] = await p.query<mysql.ResultSetHeader>(
    `INSERT INTO barges (tugboat, barge, vendor, kontrak, muatan, penalty)
     VALUES (?,?,?,?,?,?)`,
    [
      seed.tugboat,
      seed.barge,
      seed.vendor ?? null,
      seed.kontrak ?? null,
      seed.muatan ?? null,
      seed.penalty ?? null,
    ]
  );
  await p.end();
  return result.insertId;
}

export async function deleteBargesRow(id: number): Promise<void> {
  if (!id) return;
  const p = pool();
  await p.query("DELETE FROM barges WHERE id = ?", [id]);
  await p.end();
}

export async function deleteBargesRowsByTugboat(tugboat: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM barges WHERE tugboat = ?", [tugboat]);
  await p.end();
}

export async function countBargesRows(): Promise<number> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM barges"
  );
  await p.end();
  return Number(rows[0]?.c ?? 0);
}
