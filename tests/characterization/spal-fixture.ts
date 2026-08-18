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

export async function deleteSpalAgreementByNomor(nomor: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM spal_agreements WHERE nomor = ?", [nomor]);
  await p.end();
}

export async function readSpalAgreementByNomor(
  nomor: string
): Promise<{ id: number; nama_pt: string; uang_tambang: number } | null> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT id, nama_pt, uang_tambang FROM spal_agreements WHERE nomor = ?",
    [nomor]
  );
  await p.end();
  const row = rows[0];
  return row
    ? {
        id: Number(row.id),
        nama_pt: String(row.nama_pt),
        uang_tambang: Number(row.uang_tambang),
      }
    : null;
}
