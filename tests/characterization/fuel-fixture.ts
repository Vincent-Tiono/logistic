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

export async function deleteFuelRow(
  bulanTahun: string,
  periode: number
): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM fuel WHERE bulan_tahun = ? AND periode = ?", [
    bulanTahun,
    periode,
  ]);
  await p.end();
}

export async function readFuelRow(
  bulanTahun: string,
  periode: number
): Promise<{ pertamina: number; ici3: number } | null> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT pertamina, ici3 FROM fuel WHERE bulan_tahun = ? AND periode = ?",
    [bulanTahun, periode]
  );
  await p.end();
  const row = rows[0];
  return row ? { pertamina: Number(row.pertamina), ici3: Number(row.ici3) } : null;
}

export async function deleteFuelRateRow(bulanTahun: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM fuel_rates WHERE bulan_tahun = ?", [bulanTahun]);
  await p.end();
}

export async function readFuelRateRow(
  bulanTahun: string
): Promise<{ ppn_rate: number; pbbkb_rate: number; pph22_rate: number } | null> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT ppn_rate, pbbkb_rate, pph22_rate FROM fuel_rates WHERE bulan_tahun = ?",
    [bulanTahun]
  );
  await p.end();
  const row = rows[0];
  return row
    ? {
        ppn_rate: Number(row.ppn_rate),
        pbbkb_rate: Number(row.pbbkb_rate),
        pph22_rate: Number(row.pph22_rate),
      }
    : null;
}
