import mysql from "mysql2/promise";

const pools = new Map<string, mysql.Pool>();

/**
 * Same env vars as config/database.php (DB_HOST/DB_PORT/DB_USER/DB_PASS)
 * so both apps can run against the same MySQL instance during the migration.
 */
export function dbPool(database: string): mysql.Pool {
  const existing = pools.get(database);
  if (existing) return existing;

  const password = process.env.DB_PASS;
  if (!password) {
    throw new Error(
      "DB_PASS belum diatur. Jalankan server dengan environment variable DB_USER dan DB_PASS."
    );
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "logistic_app",
    password,
    database,
    charset: "utf8mb4_general_ci",
    waitForConnections: true,
    connectionLimit: 10,
  });

  pools.set(database, pool);
  return pool;
}
