import type { Pool, RowDataPacket } from "mysql2/promise";
import { decodeOperationData } from "./tlu-operation.service.js";

export interface CoalBargingByVesselRow extends RowDataPacket {
  id: number;
  sibarges_id: number;
  rc_row_id: number | null;
  row_type: "base" | "rc";
  is_rc_clone: number;
  no_pk: string;
  no_si_vessel: string;
  buyer: string;
  mothervessel: string;
  si_type: string;
  month_num: number;
  year_num: number;
  barge_seq: number;
  si_barges: string;
  tugboat: string;
  barge: string;
  anchorage: string | null;
  term: string | null;
  qty_plan: number;
  laycan_start: string | null;
  laycan_end: string | null;
  jetty_code: string;
  jetty_name: string | null;
  shipper_code: string;
  shipper_name: string | null;
  record_status: string;
  remarks: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  operation_id: number | null;
  operation_data: unknown;
  operation_remarks: string | null;
  operation_created_by: string | null;
  operation_created_at: string | null;
  operation_updated_at: string | null;
}

export interface UnusedRcOptionRow {
  rc_row_id: number;
  target_sibarges_id: number;
  target_barge_seq: number;
  row_type: "rc";
  sibarges_id: number;
  no_pk: string;
  buyer: string;
  mothervessel: string;
  jetty_code: string;
  jetty_name: string | null;
  tugboat: string;
  barge: string;
  anchorage: string;
  laycan_start: string | null;
  laycan_end: string | null;
  operation_data: unknown;
  operation_remarks: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}

export interface CoalBargingExportRow extends RowDataPacket {
  id: number;
  no_pk: string;
  buyer: string;
  mothervessel: string;
  jetty_code: string;
  tugboat: string;
  barge: string;
  anchorage: string | null;
  barge_seq: number;
  laycan_start: string | null;
  laycan_end: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  earliest_laycan_start: string | null;
  source_no_pk: string;
  source_mothervessel: string;
  source_sibarges_id: number;
  row_type: "base" | "rc";
  is_rc_clone: number;
  rc_row_id: number;
  operation_data: unknown;
  operation_remarks: string | null;
}

export interface VesselExportGroup {
  no_pk: string;
  mothervessel: string;
  earliest_laycan_start: string | null;
  rows: CoalBargingExportRow[];
}

/** Ordinal string comparison, matching PHP's byte-order strcmp(). */
function strcmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const DELETED_ROWS_JOIN =
  "LEFT JOIN `datacoalbarging`.`coal_barge_deleted_rows` hidden ON hidden.sibarges_id = s.id";

/**
 * Port of seedCoalBargingFromTlu() (Operation/9coalbarging.php:87-104):
 * insert-only sync of any `databarging`.`barge_operations` row that has no
 * corresponding `coal_barge_operations` row yet. Legacy runs this
 * unconditionally on every request (before any action dispatch); the route
 * handler does the same here, since a startup-only seed would miss TLU rows
 * written (or test-fixture rows seeded) after the Node process started.
 */
export async function seedCoalBargingFromTlu(coalPool: Pool): Promise<void> {
  await coalPool.query(`
    INSERT INTO coal_barge_operations (sibarges_id, operation_data, remarks, created_by, created_at, updated_at)
    SELECT
      tlu.sibarges_id, tlu.operation_data, tlu.remarks, tlu.created_by, tlu.created_at, tlu.updated_at
    FROM \`databarging\`.\`barge_operations\` tlu
    LEFT JOIN coal_barge_operations coal ON coal.sibarges_id = tlu.sibarges_id
    WHERE coal.sibarges_id IS NULL
  `);
}

/**
 * Port of the `si_barges_by_vessel` AJAX action
 * (Operation/9coalbarging.php:1567-1671): base sibarges rows for the vessel
 * UNIONed with their "used" RC-clone rows, both excluding
 * coal_barge_deleted_rows tombstones. Base rows' operation_data prefers
 * Coal Barging's own copy over TLU's (COALESCE(coal, tlu)); RC rows' no_pk/
 * buyer/mothervessel can be overridden by the RC row's own operation_data,
 * falling back to the source sibarges row. Cross-database via fully
 * qualified `datacoalbarging`.`table` names against the databarging pool —
 * same single-connection cross-schema join the legacy PHP and TLU's own
 * queries already rely on.
 */
export async function listCoalBargingByVessel(
  pool: Pool,
  noPk: string
): Promise<CoalBargingByVesselRow[]> {
  const [rows] = await pool.query<CoalBargingByVesselRow[]>(
    {
      sql: `SELECT * FROM (
          SELECT
            s.id AS id, s.id AS sibarges_id, NULL AS rc_row_id,
            'base' AS row_type, 0 AS is_rc_clone,
            s.no_pk, s.no_si_vessel, s.buyer, s.mothervessel,
            s.si_type, s.month_num, s.year_num, s.barge_seq, s.si_barges,
            s.tugboat, s.barge, s.anchorage, s.term, s.qty_plan,
            s.laycan_start, s.laycan_end,
            s.jetty_code, s.jetty_name,
            s.shipper_code, s.shipper_name,
            s.record_status, s.remarks,
            s.created_by, s.created_at, s.updated_at,
            coal.id AS operation_id,
            COALESCE(coal.operation_data, tlu.operation_data) AS operation_data,
            COALESCE(coal.remarks, tlu.remarks) AS operation_remarks,
            COALESCE(coal.created_by, tlu.created_by) AS operation_created_by,
            COALESCE(coal.created_at, tlu.created_at) AS operation_created_at,
            COALESCE(coal.updated_at, tlu.updated_at) AS operation_updated_at
          FROM sibarges s
          LEFT JOIN barge_operations tlu ON tlu.sibarges_id = s.id
          LEFT JOIN \`datacoalbarging\`.\`coal_barge_operations\` coal ON coal.sibarges_id = s.id
          ${DELETED_ROWS_JOIN}
          WHERE s.no_pk = ?
            AND s.record_status = 'ACT'
            AND hidden.sibarges_id IS NULL

          UNION ALL

          SELECT
            s.id AS id, s.id AS sibarges_id, rc.id AS rc_row_id,
            'rc' AS row_type, 1 AS is_rc_clone,
            COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rc.operation_data, '$.no_pk')), ''), s.no_pk) AS no_pk,
            s.no_si_vessel,
            COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rc.operation_data, '$.buyer')), ''), s.buyer) AS buyer,
            COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rc.operation_data, '$.mothervessel')), ''), s.mothervessel) AS mothervessel,
            s.si_type, s.month_num, s.year_num, s.barge_seq, s.si_barges,
            s.tugboat, s.barge, s.anchorage, s.term, s.qty_plan,
            s.laycan_start, s.laycan_end,
            s.jetty_code, s.jetty_name,
            s.shipper_code, s.shipper_name,
            s.record_status, s.remarks,
            s.created_by, s.created_at, s.updated_at,
            rc.id AS operation_id,
            rc.operation_data AS operation_data,
            rc.remarks AS operation_remarks,
            rc.created_by AS operation_created_by,
            rc.created_at AS operation_created_at,
            rc.updated_at AS operation_updated_at
          FROM sibarges s
          INNER JOIN \`datacoalbarging\`.\`coal_barge_rc_rows\` rc ON rc.source_sibarges_id = s.id
          ${DELETED_ROWS_JOIN}
          WHERE s.no_pk = ?
            AND s.record_status = 'ACT'
            AND rc.usage_status = 'used'
            AND hidden.sibarges_id IS NULL
        ) coal_rows
        ORDER BY barge_seq ASC, sibarges_id ASC, is_rc_clone DESC, rc_row_id ASC`,
      dateStrings: true,
    },
    [noPk, noPk]
  );

  return rows;
}

/**
 * Port of the `unused_rc_options` AJAX action
 * (Operation/9coalbarging.php:1405-1474): RC rows still marked 'unused',
 * matched to every active barge under the selected vessel that shares the
 * RC row's original source tugboat — insertion candidates for the
 * (out-of-scope, write) input_rc_row action. Unlike listCoalBargingByVessel's
 * rc branch, no_pk/buyer/mothervessel come only from the RC row's own
 * operation_data, with no sibarges fallback; anchorage is always ''.
 */
export async function listUnusedRcOptions(
  pool: Pool,
  noPk: string
): Promise<UnusedRcOptionRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    {
      sql: `SELECT
          rc.id AS rc_row_id,
          target.id AS target_sibarges_id,
          target.barge_seq AS target_barge_seq,
          target.jetty_code,
          target.jetty_name,
          target.tugboat AS target_tugboat,
          target.barge AS target_barge,
          target.laycan_start,
          target.laycan_end,
          rc.operation_data,
          rc.remarks AS operation_remarks,
          rc.created_by,
          rc.created_at,
          rc.updated_at
        FROM \`datacoalbarging\`.\`coal_barge_rc_rows\` rc
        INNER JOIN sibarges source
          ON source.id = rc.source_sibarges_id
          AND source.record_status = 'ACT'
        INNER JOIN sibarges target
          ON target.tugboat = source.tugboat
          AND target.no_pk = ?
          AND target.record_status = 'ACT'
        LEFT JOIN \`datacoalbarging\`.\`coal_barge_deleted_rows\` hidden
          ON hidden.sibarges_id = target.id
        WHERE rc.usage_status = 'unused'
          AND hidden.sibarges_id IS NULL
        ORDER BY target.barge_seq ASC, rc.created_at ASC, rc.id ASC`,
      dateStrings: true,
    },
    [noPk]
  );

  return rows.map((row): UnusedRcOptionRow => {
    const operationData = decodeOperationData(row.operation_data);
    return {
      rc_row_id: Number(row.rc_row_id),
      target_sibarges_id: Number(row.target_sibarges_id),
      target_barge_seq: Number(row.target_barge_seq),
      row_type: "rc",
      sibarges_id: Number(row.target_sibarges_id),
      no_pk: String(operationData.no_pk ?? ""),
      buyer: String(operationData.buyer ?? ""),
      mothervessel: String(operationData.mothervessel ?? ""),
      jetty_code: String(row.jetty_code ?? ""),
      jetty_name: row.jetty_name ?? null,
      tugboat: String(row.target_tugboat ?? ""),
      barge: String(row.target_barge ?? ""),
      anchorage: "",
      laycan_start: row.laycan_start ?? null,
      laycan_end: row.laycan_end ?? null,
      operation_data: row.operation_data ?? null,
      operation_remarks: row.operation_remarks ?? null,
      created_by: String(row.created_by ?? ""),
      created_at: String(row.created_at ?? ""),
      updated_at: row.updated_at ?? null,
    };
  });
}

const PERIOD_JOIN = `
  INNER JOIN (
    SELECT no_pk, mothervessel, MIN(laycan_start) AS earliest_laycan_start
    FROM sibarges
    WHERE no_pk <> ''
      AND mothervessel <> ''
      AND record_status = 'ACT'
    GROUP BY no_pk, mothervessel
    HAVING MIN(laycan_start) IS NOT NULL
  ) p ON p.no_pk = s.no_pk AND p.mothervessel = s.mothervessel
`;

/**
 * Port of coalBargingExportSql('') (Operation/9coalbarging.php:497-552),
 * scoped to every active vessel: the same base/rc UNION ALL shape as
 * listCoalBargingByVessel, but backing the "All Years / All Vessels"
 * landing table instead of a single vessel.
 */
export async function listAllCoalBargingRows(
  pool: Pool
): Promise<CoalBargingExportRow[]> {
  const [rows] = await pool.query<CoalBargingExportRow[]>({
    sql: `SELECT
        s.id, s.no_pk, s.buyer, s.mothervessel, s.jetty_code,
        s.tugboat, s.barge, s.anchorage, s.barge_seq, s.laycan_start, s.laycan_end,
        s.created_by, s.created_at, s.updated_at,
        p.earliest_laycan_start,
        s.no_pk AS source_no_pk, s.mothervessel AS source_mothervessel,
        s.id AS source_sibarges_id, 'base' AS row_type, 0 AS is_rc_clone, 0 AS rc_row_id,
        COALESCE(coal.operation_data, tlu.operation_data) AS operation_data,
        COALESCE(coal.remarks, tlu.remarks) AS operation_remarks
      FROM sibarges s
      ${PERIOD_JOIN}
      LEFT JOIN barge_operations tlu ON tlu.sibarges_id = s.id
      LEFT JOIN \`datacoalbarging\`.\`coal_barge_operations\` coal ON coal.sibarges_id = s.id
      ${DELETED_ROWS_JOIN}
      WHERE s.record_status = 'ACT'
        AND hidden.sibarges_id IS NULL

      UNION ALL

      SELECT
        s.id,
        COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rc.operation_data, '$.no_pk')), ''), s.no_pk) AS no_pk,
        COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rc.operation_data, '$.buyer')), ''), s.buyer) AS buyer,
        COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rc.operation_data, '$.mothervessel')), ''), s.mothervessel) AS mothervessel,
        s.jetty_code, s.tugboat, s.barge, s.anchorage, s.barge_seq, s.laycan_start, s.laycan_end,
        s.created_by, s.created_at, s.updated_at,
        p.earliest_laycan_start,
        s.no_pk AS source_no_pk, s.mothervessel AS source_mothervessel,
        s.id AS source_sibarges_id, 'rc' AS row_type, 1 AS is_rc_clone, rc.id AS rc_row_id,
        rc.operation_data AS operation_data,
        rc.remarks AS operation_remarks
      FROM sibarges s
      ${PERIOD_JOIN}
      INNER JOIN \`datacoalbarging\`.\`coal_barge_rc_rows\` rc
        ON rc.source_sibarges_id = s.id AND rc.usage_status = 'used'
      ${DELETED_ROWS_JOIN}
      WHERE s.record_status = 'ACT'
        AND hidden.sibarges_id IS NULL`,
    dateStrings: true,
  });

  return rows;
}

function dischargeSequenceOf(row: CoalBargingExportRow): number | null {
  const data = decodeOperationData(row.operation_data);
  const sequence = String(data.discharge_sequence ?? "").trim();
  return sequence !== "" ? Number(sequence) : null;
}

/**
 * Port of orderCoalBargingExportRows()'s $compareRows closure
 * (Operation/9coalbarging.php:414-433): discharge_sequence (nulls last) ->
 * barge_seq -> source_sibarges_id -> is_rc_clone -> rc_row_id.
 */
export function compareCoalBargingExportRows(
  left: CoalBargingExportRow,
  right: CoalBargingExportRow
): number {
  const leftSequence = dischargeSequenceOf(left);
  const rightSequence = dischargeSequenceOf(right);
  if (leftSequence === null && rightSequence !== null) return 1;
  if (leftSequence !== null && rightSequence === null) return -1;
  if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence) {
    return leftSequence - rightSequence;
  }

  const bargeSequenceCompare = Number(left.barge_seq) - Number(right.barge_seq);
  if (bargeSequenceCompare !== 0) return bargeSequenceCompare;

  const sourceCompare = Number(left.source_sibarges_id) - Number(right.source_sibarges_id);
  if (sourceCompare !== 0) return sourceCompare;

  const rcCompare = Number(left.is_rc_clone) - Number(right.is_rc_clone);
  if (rcCompare !== 0) return rcCompare;

  return Number(left.rc_row_id) - Number(right.rc_row_id);
}

/**
 * Port of orderCoalBargingExportRows() (Operation/9coalbarging.php:407-492):
 * groups rows by source vessel, orders vessel groups by earliest laycan
 * start (ties broken by vessel key strcmp), and within each group
 * interleaves a base row's "used" RC rows immediately before it. Returns
 * structured groups rather than legacy's flat array with `null`-separator
 * sentinels — the browser renders a separator row between groups itself.
 */
export function groupCoalBargingExportRows(
  rows: CoalBargingExportRow[]
): VesselExportGroup[] {
  const vesselGroups = new Map<
    string,
    { period: string | null; rows: CoalBargingExportRow[] }
  >();
  const vesselOrder: string[] = [];

  for (const row of rows) {
    const vesselKey = `${row.source_no_pk}\0${row.source_mothervessel}`;
    let group = vesselGroups.get(vesselKey);
    if (!group) {
      group = { period: row.earliest_laycan_start, rows: [] };
      vesselGroups.set(vesselKey, group);
      vesselOrder.push(vesselKey);
    }
    group.rows.push(row);
  }

  vesselOrder.sort((left, right) => {
    const periodCompare = strcmp(
      String(vesselGroups.get(left)?.period ?? ""),
      String(vesselGroups.get(right)?.period ?? "")
    );
    return periodCompare !== 0 ? periodCompare : strcmp(left, right);
  });

  return vesselOrder.map((vesselKey) => {
    const group = vesselGroups.get(vesselKey)!;
    const [sourceNoPk, sourceMothervessel] = vesselKey.split("\0");

    const baseRows = group.rows.filter((row) => row.row_type !== "rc");
    const rcRows = group.rows.filter((row) => row.row_type === "rc");
    baseRows.sort(compareCoalBargingExportRows);

    const rcBySource = new Map<number, CoalBargingExportRow[]>();
    for (const rcRow of rcRows) {
      const sourceId = Number(rcRow.source_sibarges_id);
      const list = rcBySource.get(sourceId) ?? [];
      list.push(rcRow);
      rcBySource.set(sourceId, list);
    }
    for (const list of rcBySource.values()) {
      list.sort(compareCoalBargingExportRows);
    }

    const orderedRows: CoalBargingExportRow[] = [];
    const attachedSourceIds = new Set<number>();
    for (const baseRow of baseRows) {
      const sourceId = Number(baseRow.source_sibarges_id);
      const attachedRcRows = rcBySource.get(sourceId);
      if (attachedRcRows) {
        orderedRows.push(...attachedRcRows);
        attachedSourceIds.add(sourceId);
      }
      orderedRows.push(baseRow);
    }
    for (const [sourceId, list] of rcBySource) {
      if (!attachedSourceIds.has(sourceId)) {
        orderedRows.push(...list);
      }
    }

    return {
      no_pk: sourceNoPk,
      mothervessel: sourceMothervessel,
      earliest_laycan_start: group.period,
      rows: orderedRows,
    };
  });
}

/** Backs the `all_vessels` AJAX action: listAllCoalBargingRows + grouping. */
export async function listAllVesselOperations(
  pool: Pool
): Promise<VesselExportGroup[]> {
  const rows = await listAllCoalBargingRows(pool);
  return groupCoalBargingExportRows(rows);
}
