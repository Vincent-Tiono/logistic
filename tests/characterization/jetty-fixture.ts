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

export interface JettySeed {
  jetty: string;
  nama_panjang: string;
}

/** Seeds a disposable jetty row directly, bypassing the app under test. */
export async function seedJettyRow(seed: JettySeed): Promise<void> {
  const p = pool();
  await p.query("INSERT INTO jetty (jetty, nama_panjang) VALUES (?,?)", [
    seed.jetty,
    seed.nama_panjang,
  ]);
  await p.end();
}

export async function deleteJettyRow(jetty: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM jetty WHERE jetty = ?", [jetty]);
  await p.end();
}

export async function countJettyRows(): Promise<number> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM jetty"
  );
  await p.end();
  return Number(rows[0]?.c ?? 0);
}
