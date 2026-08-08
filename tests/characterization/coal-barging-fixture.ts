import mysql from "mysql2/promise";

function pool() {
  return mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER ?? "logistic_app",
    password: process.env.DB_PASS ?? "user123",
    database: "datacoalbarging",
  });
}

export interface CoalBargeOperationSeed {
  sibarges_id: number;
  operation_data?: Record<string, unknown>;
  remarks?: string | null;
  created_by?: string;
}

/** Seeds a disposable coal_barge_operations row directly, bypassing the app
 * under test. */
export async function seedCoalBargeOperationRow(
  seed: CoalBargeOperationSeed
): Promise<number> {
  const p = pool();
  const [result] = await p.query<mysql.ResultSetHeader>(
    `INSERT INTO coal_barge_operations (
        sibarges_id, operation_data, remarks, created_by
      ) VALUES (?,?,?,?)`,
    [
      seed.sibarges_id,
      seed.operation_data ? JSON.stringify(seed.operation_data) : null,
      seed.remarks ?? null,
      seed.created_by ?? "test",
    ]
  );
  await p.end();
  return result.insertId;
}

export interface CoalBargeOperationRow {
  operation_data: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export async function getCoalBargeOperationRow(
  sibargesId: number
): Promise<CoalBargeOperationRow | null> {
  const p = pool();
  const [rows] = await p.query<(CoalBargeOperationRow & mysql.RowDataPacket)[]>(
    "SELECT operation_data, remarks, created_by, created_at, updated_at FROM coal_barge_operations WHERE sibarges_id = ?",
    [sibargesId]
  );
  await p.end();
  return rows[0] ?? null;
}

export async function deleteCoalBargeOperationRow(id: number): Promise<void> {
  if (!id) return;
  const p = pool();
  await p.query("DELETE FROM coal_barge_operations WHERE id = ?", [id]);
  await p.end();
}

export async function deleteCoalBargeOperationRowsBySibargesId(
  sibargesId: number
): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM coal_barge_operations WHERE sibarges_id = ?", [
    sibargesId,
  ]);
  await p.end();
}

export interface CoalBargeRcRowSeed {
  source_sibarges_id: number;
  usage_status?: "used" | "unused";
  operation_data?: Record<string, unknown>;
  remarks?: string | null;
  created_by?: string;
}

/** Seeds a disposable coal_barge_rc_rows row directly, bypassing the app
 * under test. */
export async function seedCoalBargeRcRow(
  seed: CoalBargeRcRowSeed
): Promise<number> {
  const p = pool();
  const [result] = await p.query<mysql.ResultSetHeader>(
    `INSERT INTO coal_barge_rc_rows (
        source_sibarges_id, usage_status, operation_data, remarks, created_by
      ) VALUES (?,?,?,?,?)`,
    [
      seed.source_sibarges_id,
      seed.usage_status ?? "used",
      seed.operation_data ? JSON.stringify(seed.operation_data) : null,
      seed.remarks ?? null,
      seed.created_by ?? "test",
    ]
  );
  await p.end();
  return result.insertId;
}

export async function deleteCoalBargeRcRow(id: number): Promise<void> {
  if (!id) return;
  const p = pool();
  await p.query("DELETE FROM coal_barge_rc_rows WHERE id = ?", [id]);
  await p.end();
}

/** Seeds a disposable coal_barge_deleted_rows tombstone directly, bypassing
 * the app under test. */
export async function seedCoalBargeDeletedRow(
  sibargesId: number,
  deletedBy = "test"
): Promise<void> {
  const p = pool();
  await p.query(
    "INSERT INTO coal_barge_deleted_rows (sibarges_id, deleted_by) VALUES (?, ?)",
    [sibargesId, deletedBy]
  );
  await p.end();
}

export async function deleteCoalBargeDeletedRow(
  sibargesId: number
): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM coal_barge_deleted_rows WHERE sibarges_id = ?", [
    sibargesId,
  ]);
  await p.end();
}
