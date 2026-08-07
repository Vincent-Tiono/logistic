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

export interface FlfSeed {
  floating_crane: string;
  vendor_flf: string;
  pbm: string;
  anchorage: string;
}

/** Seeds a disposable flf row directly, bypassing the app under test. */
export async function seedFlfRow(seed: FlfSeed): Promise<void> {
  const p = pool();
  await p.query(
    "INSERT INTO flf (floating_crane, vendor_flf, pbm, anchorage) VALUES (?,?,?,?)",
    [seed.floating_crane, seed.vendor_flf, seed.pbm, seed.anchorage]
  );
  await p.end();
}

export async function deleteFlfRow(floatingCrane: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM flf WHERE floating_crane = ?", [floatingCrane]);
  await p.end();
}

export async function countFlfRows(): Promise<number> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM flf"
  );
  await p.end();
  return Number(rows[0]?.c ?? 0);
}
