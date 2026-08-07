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

/**
 * Ports config/database.php's ensure_vessel_schedule_columns(): the base
 * schema dump declares ta_vessel/pkk/rkbm as `date`, but the app stores full
 * timestamps in them. PHP lazily ALTERs on every request; here it's called
 * once at startup instead since the process (and its pool) is long-lived.
 */
export async function ensureVesselScheduleColumns(
  pool: mysql.Pool
): Promise<void> {
  const [dbRows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT DATABASE() AS db_name"
  );
  const database = String(dbRows[0]?.db_name ?? "");
  if (!database) return;

  const [columns] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME, DATA_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'vessel'
       AND COLUMN_NAME IN ('ta_vessel', 'pkk', 'rkbm')`,
    [database]
  );

  const dataTypes = new Map<string, string>(
    columns.map((c) => [String(c.COLUMN_NAME), String(c.DATA_TYPE)])
  );

  const alterParts: string[] = [];
  if (!dataTypes.has("pkk")) {
    alterParts.push("ADD COLUMN pkk datetime DEFAULT NULL AFTER ta_vessel");
  } else if (dataTypes.get("pkk") === "date") {
    alterParts.push("MODIFY COLUMN pkk datetime DEFAULT NULL");
  }
  if (!dataTypes.has("rkbm")) {
    alterParts.push("ADD COLUMN rkbm datetime DEFAULT NULL AFTER pkk");
  } else if (dataTypes.get("rkbm") === "date") {
    alterParts.push("MODIFY COLUMN rkbm datetime DEFAULT NULL");
  }
  if (dataTypes.get("ta_vessel") === "date") {
    alterParts.push("MODIFY COLUMN ta_vessel datetime DEFAULT NULL");
  }

  if (alterParts.length > 0) {
    await pool.query(`ALTER TABLE vessel ${alterParts.join(", ")}`);
  }
}

/**
 * Ports config/database.php's ensure_shipper_laytime_column(): the base
 * schema dump has no `laytime` column on `shipper`, added lazily by the
 * legacy app. Called once at startup instead of per-request.
 */
export async function ensureShipperLaytimeColumn(
  pool: mysql.Pool
): Promise<void> {
  const [dbRows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT DATABASE() AS db_name"
  );
  const database = String(dbRows[0]?.db_name ?? "");
  if (!database) return;

  const [columns] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'shipper'
       AND COLUMN_NAME = 'laytime'`,
    [database]
  );

  if (columns.length === 0) {
    await pool.query(
      "ALTER TABLE shipper ADD COLUMN laytime DECIMAL(10,2) DEFAULT NULL AFTER nama_lengkap"
    );
  }
}

/**
 * Ports Operation/3vendor.php's `CREATE TABLE IF NOT EXISTS vendor (...)`
 * self-heal. The `vendor` table isn't in the base schema dump at all (it
 * only ever existed via this PHP-embedded DDL), so unlike vessel/shipper
 * there's no evidence of a pre-migration schema to guard against — the
 * legacy `mhu`/`kontrak`/`ltc_day` column-rename ALTERs are intentionally
 * not ported here.
 */
export async function ensureVendorTable(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vendor (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor VARCHAR(150) DEFAULT NULL,
      shipper VARCHAR(150) DEFAULT NULL,
      freight DECIMAL(15,2) DEFAULT NULL,
      tonnage DECIMAL(15,2) DEFAULT NULL,
      penalty VARCHAR(10) DEFAULT NULL,
      discount DECIMAL(15,2) DEFAULT NULL,
      contract VARCHAR(150) DEFAULT NULL,
      lookup VARCHAR(150) DEFAULT NULL,
      laytime DECIMAL(15,2) DEFAULT NULL,
      ltc_rate DECIMAL(15,2) DEFAULT NULL
    )
  `);
}
