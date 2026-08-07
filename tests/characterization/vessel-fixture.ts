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

export interface VesselSeed {
  no_pk: string;
  no_si_vessel: string;
  buyer: string;
  mothervessel: string;
  anchorage: string;
  term: string;
}

/** Seeds a disposable vessel row directly, bypassing the app under test. */
export async function seedVesselRow(seed: VesselSeed): Promise<void> {
  const p = pool();
  await p.query(
    "INSERT INTO vessel (no_pk, no_si_vessel, buyer, mothervessel, anchorage, term) VALUES (?,?,?,?,?,?)",
    [
      seed.no_pk,
      seed.no_si_vessel,
      seed.buyer,
      seed.mothervessel,
      seed.anchorage,
      seed.term,
    ]
  );
  await p.end();
}

export async function deleteVesselRow(no_pk: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM vessel WHERE no_pk = ?", [no_pk]);
  await p.end();
}

export async function countVesselRows(): Promise<number> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM vessel"
  );
  await p.end();
  return Number(rows[0]?.c ?? 0);
}
