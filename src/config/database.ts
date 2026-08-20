import mysql from "mysql2/promise";
import { DEFAULT_FUEL_KURS_RATES } from "../services/fuel-kurs.service.js";

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
 * Ports Operation/9coalbarging.php's ensureCoalBargingDatabase() (lines
 * 19-85): creates the `datacoalbarging` database and its 3 tables if they
 * don't exist yet. Unlike the other ensure*(pool) helpers, this can't take a
 * Pool bound to a database name — `datacoalbarging` itself might not exist
 * yet, so it opens its own connection with no default database selected
 * (mirroring the legacy `new mysqli($host, $user, $password, '', $port)`),
 * same as it does. Called once at startup, before any dbPool("datacoalbarging")
 * query runs.
 */
export async function ensureCoalBargingDatabase(): Promise<void> {
  const password = process.env.DB_PASS;
  if (!password) {
    throw new Error(
      "DB_PASS belum diatur. Jalankan server dengan environment variable DB_USER dan DB_PASS."
    );
  }

  const connectionConfig = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "logistic_app",
    password,
    charset: "utf8mb4_general_ci",
  };

  const serverConnection = await mysql.createConnection(connectionConfig);
  try {
    await serverConnection.query(
      "CREATE DATABASE IF NOT EXISTS `datacoalbarging` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
  } finally {
    await serverConnection.end();
  }

  const connection = await mysql.createConnection({
    ...connectionConfig,
    database: "datacoalbarging",
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coal_barge_operations (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        sibarges_id bigint unsigned NOT NULL,
        operation_data json DEFAULT NULL,
        remarks text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        created_by varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_coal_barge_operations_sibarges (sibarges_id),
        KEY idx_coal_barge_operations_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS coal_barge_rc_rows (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        source_sibarges_id bigint unsigned NOT NULL,
        usage_status enum('used','unused') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'used',
        operation_data json DEFAULT NULL,
        remarks text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        created_by varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_coal_barge_rc_usage_status (usage_status),
        KEY idx_coal_barge_rc_source_sibarges (source_sibarges_id),
        KEY idx_coal_barge_rc_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [statusColumns] = await connection.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM coal_barge_rc_rows LIKE 'usage_status'"
    );
    if (statusColumns.length === 0) {
      await connection.query(`
        ALTER TABLE coal_barge_rc_rows
        ADD COLUMN usage_status enum('used','unused') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'used' AFTER source_sibarges_id,
        ADD KEY idx_coal_barge_rc_usage_status (usage_status)
      `);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS coal_barge_deleted_rows (
        sibarges_id bigint unsigned NOT NULL,
        deleted_by varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        deleted_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (sibarges_id),
        KEY idx_coal_barge_deleted_at (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } finally {
    await connection.end();
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

/**
 * Ports VM&FAT/3fuel.php's ensure_fuel_table(): creates `fuel` and
 * `fuel_rates` if missing, and self-heals the `ici3` column PHP added
 * lazily after the original `fuel` table shipped. PHP re-checks this on
 * every request (guarded by a static flag per-request); called once at
 * startup here instead, same as the other ensure*() helpers.
 */
export async function ensureFuelTables(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fuel (
      bulan_tahun VARCHAR(10) NOT NULL,
      periode TINYINT NOT NULL,
      pertamina DECIMAL(15,2) NOT NULL DEFAULT 0,
      ici3 DECIMAL(15,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (bulan_tahun, periode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [dbRows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT DATABASE() AS db_name"
  );
  const database = String(dbRows[0]?.db_name ?? "");
  if (database) {
    const [columns] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'fuel' AND COLUMN_NAME = 'ici3'`,
      [database]
    );
    if (columns.length === 0) {
      await pool.query(
        "ALTER TABLE fuel ADD COLUMN ici3 DECIMAL(15,2) NOT NULL DEFAULT 0"
      );
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fuel_rates (
      bulan_tahun VARCHAR(10) NOT NULL,
      ppn_rate DECIMAL(6,3) NOT NULL DEFAULT 11,
      pbbkb_rate DECIMAL(6,3) NOT NULL DEFAULT 7.5,
      pph22_rate DECIMAL(6,3) NOT NULL DEFAULT 0.3,
      PRIMARY KEY (bulan_tahun)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  if (database) {
    const [fuelRatesColumns] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'fuel_rates' AND COLUMN_NAME IN ('tahun', 'bulan_tahun')`,
      [database]
    );
    const fuelRatesColumnNames = new Set(
      fuelRatesColumns.map((c) => String(c.COLUMN_NAME))
    );
    // Pre-migration installs had `fuel_rates` keyed by `tahun` (one rate per
    // whole year). Migrate each existing row to an explicit override anchored
    // at Jan of that year, then re-key the table by `bulan_tahun` so rates can
    // carry forward month-to-month. `tahun` is left in place as an inert
    // leftover column rather than dropped.
    if (
      fuelRatesColumnNames.has("tahun") &&
      !fuelRatesColumnNames.has("bulan_tahun")
    ) {
      await pool.query(
        "ALTER TABLE fuel_rates ADD COLUMN bulan_tahun VARCHAR(10) NULL AFTER tahun"
      );
      await pool.query(
        "UPDATE fuel_rates SET bulan_tahun = CONCAT('Jan-', RIGHT(tahun, 2)) WHERE bulan_tahun IS NULL"
      );
      await pool.query(
        "ALTER TABLE fuel_rates MODIFY bulan_tahun VARCHAR(10) NOT NULL, MODIFY tahun SMALLINT NULL, DROP PRIMARY KEY, ADD PRIMARY KEY (bulan_tahun)"
      );
    }
  }
}

/**
 * Creates the single-row `fuel_kurs_rates` table backing the Freight
 * MHU/CAM, R/F Base Parameter, and Tolerance tables on the Fuel & Kurs
 * page, seeded with all-zero values if the row doesn't exist yet.
 */
export async function ensureFuelKursTables(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fuel_kurs_rates (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      rates_json JSON NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(
    "INSERT IGNORE INTO fuel_kurs_rates (id, rates_json) VALUES (1, ?)",
    [JSON.stringify(DEFAULT_FUEL_KURS_RATES)]
  );
}

/**
 * Creates `jisdor_rates`, a local cache of every Jisdor (BI) row the app has
 * ever successfully fetched. The /jisdor page upserts into this on every
 * successful live fetch and falls back to reading from it when bi.go.id is
 * unreachable, so previously-seen dates stay visible during an outage
 * instead of the page going blank.
 */
export async function ensureJisdorTable(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jisdor_rates (
      mts VARCHAR(10) NOT NULL,
      tanggal DATE NOT NULL,
      kurs DECIMAL(15,4) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (mts, tanggal)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * Creates `kurs_tengah_rates`, the Kurs Tengah counterpart to
 * `jisdor_rates` — see ensureJisdorTable for the outage-fallback rationale.
 * `tengah` isn't stored since it's a pure derivation of jual/beli.
 */
export async function ensureKursTengahTable(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kurs_tengah_rates (
      mts VARCHAR(10) NOT NULL,
      tanggal DATE NOT NULL,
      jual DECIMAL(15,4) NOT NULL,
      beli DECIMAL(15,4) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (mts, tanggal)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * Creates `spal_agreements`, storing the field values behind each generated
 * SJN (Surat Perjanjian Angkutan Laut) docx — the docx itself is regenerated
 * from the template on every download rather than stored as a blob. Records
 * are append-only (no update/delete route) since each row is a signed
 * agreement.
 */
export async function ensureSpalTable(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS spal_agreements (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      operator VARCHAR(10) NOT NULL DEFAULT 'MHU',
      nomor VARCHAR(150) NOT NULL,
      tanggal DATE NOT NULL,
      nama_pt VARCHAR(255) NOT NULL,
      alamat TEXT NOT NULL,
      uang_tambang DECIMAL(15,2) NOT NULL,
      deadfreight DECIMAL(15,2) DEFAULT NULL,
      jetty_muat VARCHAR(255) NOT NULL,
      jetty_bongkar VARCHAR(255) NOT NULL,
      kesediaan_kapal_mulai DATE DEFAULT NULL,
      kesediaan_kapal_selesai DATE DEFAULT NULL,
      posisi_kapal VARCHAR(255) NOT NULL DEFAULT '',
      total_hari_muat_bongkar VARCHAR(50) NOT NULL DEFAULT '',
      denda_demurrage DECIMAL(15,2) NOT NULL DEFAULT 35000000,
      nama_penandatangan VARCHAR(255) NOT NULL,
      jabatan VARCHAR(150) NOT NULL,
      created_by VARCHAR(150) DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_nomor (nomor),
      INDEX idx_tanggal (tanggal),
      INDEX idx_nama_pt (nama_pt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [dbRows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT DATABASE() AS db_name"
  );
  const database = String(dbRows[0]?.db_name ?? "");
  if (database) {
    const [indexes] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT INDEX_NAME
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'spal_agreements' AND INDEX_NAME = 'uniq_nomor'`,
      [database]
    );
    if (indexes.length === 0) {
      await pool.query(
        "ALTER TABLE spal_agreements ADD UNIQUE KEY uniq_nomor (nomor)"
      );
    }

    const [operatorColumns] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'spal_agreements' AND COLUMN_NAME = 'operator'`,
      [database]
    );
    if (operatorColumns.length === 0) {
      await pool.query(
        "ALTER TABLE spal_agreements ADD COLUMN operator VARCHAR(10) NOT NULL DEFAULT 'MHU' AFTER id"
      );
    }

    const [kesediaanColumns] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'spal_agreements' AND COLUMN_NAME = 'kesediaan_kapal_mulai'`,
      [database]
    );
    if (kesediaanColumns.length === 0) {
      await pool.query(
        "ALTER TABLE spal_agreements ADD COLUMN kesediaan_kapal_mulai DATE DEFAULT NULL AFTER jetty_bongkar, ADD COLUMN kesediaan_kapal_selesai DATE DEFAULT NULL AFTER kesediaan_kapal_mulai"
      );
    }

    const [posisiColumns] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'spal_agreements' AND COLUMN_NAME = 'posisi_kapal'`,
      [database]
    );
    if (posisiColumns.length === 0) {
      await pool.query(
        "ALTER TABLE spal_agreements ADD COLUMN posisi_kapal VARCHAR(255) NOT NULL DEFAULT '' AFTER kesediaan_kapal_selesai, ADD COLUMN total_hari_muat_bongkar VARCHAR(50) NOT NULL DEFAULT '' AFTER posisi_kapal"
      );
    }

    const [deadfreightColumns] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'spal_agreements' AND COLUMN_NAME = 'deadfreight'`,
      [database]
    );
    if (deadfreightColumns.length === 0) {
      await pool.query(
        "ALTER TABLE spal_agreements ADD COLUMN deadfreight DECIMAL(15,2) DEFAULT NULL AFTER uang_tambang"
      );
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS spal_kapal (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      spal_agreement_id INT UNSIGNED NOT NULL,
      tugboat VARCHAR(255) NOT NULL,
      barge VARCHAR(255) NOT NULL,
      INDEX idx_spal_kapal_agreement (spal_agreement_id),
      CONSTRAINT fk_spal_kapal_agreement FOREIGN KEY (spal_agreement_id)
        REFERENCES spal_agreements (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
