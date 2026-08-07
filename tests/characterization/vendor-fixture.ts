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

export interface VendorSeed {
  vendor: string;
  shipper?: string | null;
  freight?: number | null;
  tonnage?: number | null;
  penalty?: string | null;
  discount?: number | null;
  contract?: string | null;
  laytime?: number | null;
  ltc_rate?: number | null;
}

/** Seeds a disposable vendor row directly, bypassing the app under test. Returns the auto-increment id. */
export async function seedVendorRow(seed: VendorSeed): Promise<number> {
  const p = pool();
  const [result] = await p.query<mysql.ResultSetHeader>(
    `INSERT INTO vendor (vendor, shipper, freight, tonnage, penalty, discount, contract, laytime, ltc_rate)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      seed.vendor,
      seed.shipper ?? null,
      seed.freight ?? null,
      seed.tonnage ?? null,
      seed.penalty ?? null,
      seed.discount ?? null,
      seed.contract ?? null,
      seed.laytime ?? null,
      seed.ltc_rate ?? null,
    ]
  );
  await p.end();
  return result.insertId;
}

export async function deleteVendorRow(id: number): Promise<void> {
  if (!id) return;
  const p = pool();
  await p.query("DELETE FROM vendor WHERE id = ?", [id]);
  await p.end();
}

export async function deleteVendorRowsByName(vendor: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM vendor WHERE vendor = ?", [vendor]);
  await p.end();
}

export async function countVendorRows(): Promise<number> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM vendor"
  );
  await p.end();
  return Number(rows[0]?.c ?? 0);
}
