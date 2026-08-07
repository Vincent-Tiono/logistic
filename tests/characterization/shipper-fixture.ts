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

export interface ShipperSeed {
  shipper: string;
  pt: string;
  nama_lengkap: string;
  laytime?: number | null;
}

/** Seeds a disposable shipper row directly, bypassing the app under test. */
export async function seedShipperRow(seed: ShipperSeed): Promise<void> {
  const p = pool();
  await p.query(
    "INSERT INTO shipper (shipper, pt, nama_lengkap, laytime) VALUES (?,?,?,?)",
    [seed.shipper, seed.pt, seed.nama_lengkap, seed.laytime ?? null]
  );
  await p.end();
}

export async function deleteShipperRow(shipper: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM shipper WHERE shipper = ?", [shipper]);
  await p.end();
}

export async function countShipperRows(): Promise<number> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM shipper"
  );
  await p.end();
  return Number(rows[0]?.c ?? 0);
}
