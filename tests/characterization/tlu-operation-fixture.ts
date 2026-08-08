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

export interface BargeOperationSeed {
  sibarges_id: number;
  operation_status?: string;
  operation_data?: Record<string, unknown>;
  remarks?: string | null;
  created_by?: string;
}

/** Seeds a disposable barge_operations row directly, bypassing the app under test. */
export async function seedBargeOperationRow(
  seed: BargeOperationSeed
): Promise<number> {
  const p = pool();
  const [result] = await p.query<mysql.ResultSetHeader>(
    `INSERT INTO barge_operations (
        sibarges_id, operation_status, operation_data, remarks, created_by
      ) VALUES (?,?,?,?,?)`,
    [
      seed.sibarges_id,
      seed.operation_status ?? "DRAFT",
      seed.operation_data ? JSON.stringify(seed.operation_data) : null,
      seed.remarks ?? null,
      seed.created_by ?? "test",
    ]
  );
  await p.end();
  return result.insertId;
}

export async function deleteBargeOperationRow(id: number): Promise<void> {
  if (!id) return;
  const p = pool();
  await p.query("DELETE FROM barge_operations WHERE id = ?", [id]);
  await p.end();
}

export interface BargeOperationRow {
  operation_data: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Reads the raw persisted barge_operations row directly, bypassing the
 * vessel-defaults-merging si_barges_by_vessel read path — used by tests that
 * need to inspect exactly what was written (partial-merge, upsert, remarks
 * routing). */
export async function getBargeOperationRow(
  sibargesId: number
): Promise<BargeOperationRow | null> {
  const p = pool();
  const [rows] = await p.query<(BargeOperationRow & mysql.RowDataPacket)[]>(
    "SELECT operation_data, remarks, created_by, created_at, updated_at FROM barge_operations WHERE sibarges_id = ?",
    [sibargesId]
  );
  await p.end();
  return rows[0] ?? null;
}

export async function deleteBargeOperationRowsBySibargesId(
  sibargesId: number
): Promise<void> {
  const p = pool();
  await p.query("DELETE FROM barge_operations WHERE sibarges_id = ?", [
    sibargesId,
  ]);
  await p.end();
}
