import mysql from "mysql2/promise";

function pool() {
  return mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER ?? "logistic_app",
    password: process.env.DB_PASS ?? "user123",
    database: "databasemlp",
  });
}

/** Seeds a disposable plaintext-password user, bypassing the app under test. */
export async function seedLegacyUser(
  username: string,
  password: string,
  jabatan: string,
  divisi: string
): Promise<void> {
  const p = pool();
  await p.query(
    "INSERT INTO usermlp (username, password, jabatan, divisi) VALUES (?,?,?,?)",
    [username, password, jabatan, divisi]
  );
  await p.end();
}

export async function deleteUserRow(username: string): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM usermlp WHERE username = ?", [username]);
  await p.end();
}

export async function readPassword(username: string): Promise<string | null> {
  const p = pool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT password FROM usermlp WHERE username = ?",
    [username]
  );
  await p.end();
  return (rows[0]?.password as string | undefined) ?? null;
}
