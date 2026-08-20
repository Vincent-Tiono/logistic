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

export async function deleteSpalAgreementsByNamaPt(namaPt: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM spal_agreements WHERE nama_pt = ?", [namaPt]);
  await p.end();
}

export interface SpalAgreementRow {
  id: number;
  nomor: string;
  nama_pt: string;
  uang_tambang: number;
  denda_demurrage: number;
}

export async function readSpalAgreementsByNamaPt(
  namaPt: string
): Promise<SpalAgreementRow[]> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT id, nomor, nama_pt, uang_tambang, denda_demurrage FROM spal_agreements WHERE nama_pt = ? ORDER BY id ASC",
    [namaPt]
  );
  await p.end();
  return rows.map((row) => ({
    id: Number(row.id),
    nomor: String(row.nomor),
    nama_pt: String(row.nama_pt),
    uang_tambang: Number(row.uang_tambang),
    denda_demurrage: Number(row.denda_demurrage),
  }));
}
