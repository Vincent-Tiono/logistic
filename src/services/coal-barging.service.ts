import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { detectCsvDelimiter, parseCsv } from "../lib/csv-parser.js";
import {
  RESTRICTED_FLOATING_CRANES,
  TLU_DATETIME_FIELDS,
  formatOperationNumber,
  normalizeOperationDateTime,
  parseOperationDateTimeValue,
  parseOperationNumber,
} from "../lib/operation-fields.js";
import { decodeOperationData, validateFlfChoice } from "./tlu-operation.service.js";

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

/* ===================== write actions (issue #14) ===================== */
//
// `pool` below is always the `databarging` connection, `coalPool` the
// `datacoalbarging` one — matching legacy's per-statement choice of
// $koneksi vs $coalKoneksi (9coalbarging.php:734-1564), with a
// fully-qualified cross-database reference to whichever database that
// statement's connection isn't already scoped to.

/**
 * Port of TLU_OPERATION_FIELDS as redeclared in 9coalbarging.php:115-142 —
 * NOT the same field set as TLU Operation's own TLU_OPERATION_FIELDS
 * (src/lib/operation-fields.ts): adds status_act_rc/status_act_act_rc/
 * date_jetty, drops barge_vendor and every cycle-time field (Coal Barging
 * has no Cycle Time tab).
 */
export const COAL_BARGING_OPERATION_FIELDS: readonly string[] = [
  "status_act_rc",
  "status_act_act_rc",
  "qty",
  "qty_disc",
  "rc",
  "qty_actual",
  "pbm_vendor",
  "floating_crane",
  "arrival_jetty",
  "date_jetty",
  "start_loading",
  "completed_loading",
  "lhv",
  "spog_zona_2",
  "pkk",
  "rkbm",
  "sts_spb",
  "start_mooring",
  "end_mooring",
  "mooring_place_1",
  "clear_pass",
  "start_mooring_clear_pass",
  "cast_off_mooring_clear_pass",
  "mooring_place_2",
  "ta_barges_actual",
  "ta_mv",
  "ta_flf",
  "cargo_readiness_actual",
  "start_disch",
  "completed_disch",
  "discharge_sequence",
  "back_to_jetty",
];

/** Port of TLU_CSV_COLUMNS as redeclared in 9coalbarging.php:172-211 — no
 * barge_vendor column (unlike TLU Operation's own CSV shape). */
export const COAL_BARGING_CSV_COLUMNS: readonly string[] = [
  "si_barges",
  "no_pk",
  "buyer",
  "mother_vessel",
  "jetty",
  "tugboat",
  "barge",
  "qty",
  "qty_disc",
  "rc",
  "qty_actual",
  "pbm_vendor",
  "floating_crane",
  "laycan_start",
  "laycan_end",
  "arrival_jetty",
  "start_loading",
  "completed_loading",
  "lhv",
  "spog_zona_2",
  "pkk",
  "rkbm",
  "sts_spb",
  "start_mooring",
  "end_mooring",
  "mooring_place_1",
  "clear_pass",
  "start_mooring_clear_pass",
  "cast_off_mooring_clear_pass",
  "mooring_place_2",
  "ta_barges_actual",
  "ta_mv",
  "ta_flf",
  "cargo_readiness_actual",
  "start_disch",
  "completed_disch",
  "discharge_sequence",
  "back_to_jetty",
  "remarks",
];

/** Port of RC_UNUSED_STRIP_FIELDS (9coalbarging.php:317-332): fields cleared
 * off an RC row's operation_data whenever it goes back to 'unused' —
 * they're reattached from whichever barge the RC is next input onto
 * (see inputCoalBargingRcRow). */
const RC_UNUSED_STRIP_FIELDS: readonly string[] = [
  "no_pk",
  "buyer",
  "mothervessel",
  "pbm_vendor",
  "floating_crane",
  "start_disch",
  "completed_disch",
];

function stripRcUnusedFields(operationData: Record<string, unknown>): Record<string, unknown> {
  const result = { ...operationData };
  for (const field of RC_UNUSED_STRIP_FIELDS) {
    delete result[field];
  }
  return result;
}

/** Port of operationNumberValue (9coalbarging.php:248-251): silently returns
 * null on blank/non-numeric input instead of erroring, unlike
 * parseOperationNumber. Used only by createCoalBargingRcRow's qty_disc/
 * qty_actual derivation. */
function operationNumberValue(value: unknown): number | null {
  const normalized = String(value ?? "").replace(/[, ]/g, "").trim();
  return normalized !== "" && !Number.isNaN(Number(normalized)) ? Number(normalized) : null;
}

export type CoalBargingSaveResult =
  | { ok: true; msg: string; data: Record<string, unknown> }
  | { ok: false; msg: string };

/**
 * Port of the save_operation_data AJAX action (9coalbarging.php:734-890).
 * Unlike TLU's saveOperationData, this does NOT merge onto a baseline row —
 * operation_data is rebuilt from scratch out of submittedData every call, so
 * a field omitted from submittedData is dropped even if it was previously
 * saved. row_type 'rc' additionally rebuilds no_pk/buyer/mothervessel (base
 * rows never touch those three).
 */
export async function saveCoalBargingOperationData(
  pool: Pool,
  coalPool: Pool,
  payload: {
    row_type?: unknown;
    sibarges_id?: unknown;
    rc_row_id?: unknown;
    data?: Record<string, unknown>;
  },
  createdBy: string
): Promise<CoalBargingSaveResult> {
  const rowType = payload.row_type === "rc" ? "rc" : "base";
  const sibargesId = Number(payload.sibarges_id);
  const rcRowId = Number(payload.rc_row_id);

  if (rowType === "rc") {
    if (!(Number.isInteger(rcRowId) && rcRowId > 0)) {
      return { ok: false, msg: "Data RC tidak valid." };
    }
  } else if (!(Number.isInteger(sibargesId) && sibargesId > 0)) {
    return { ok: false, msg: "Data barge tidak valid." };
  }

  const submittedData = payload.data ?? {};
  const operationRemarks = String(submittedData.operation_remarks ?? "").trim();
  const operationData: Record<string, unknown> = {};

  for (const field of COAL_BARGING_OPERATION_FIELDS) {
    const value = String(submittedData[field] ?? "").trim();
    if (value !== "") operationData[field] = value;
  }

  if (rowType === "rc") {
    for (const field of ["no_pk", "buyer", "mothervessel"] as const) {
      const value = String(submittedData[field] ?? "").trim();
      if (value === "") delete operationData[field];
      else operationData[field] = value;
    }
  }

  const qtyDiscResult = parseOperationNumber(submittedData.qty_disc, "QTY DISC");
  if (!qtyDiscResult.ok) return { ok: false, msg: qtyDiscResult.msg };
  const rcResult = parseOperationNumber(submittedData.rc, "RC");
  if (!rcResult.ok) return { ok: false, msg: rcResult.msg };
  const qtyActualResult = parseOperationNumber(submittedData.qty_actual, "QTY Laut");
  if (!qtyActualResult.ok) return { ok: false, msg: qtyActualResult.msg };
  if (qtyActualResult.value === null) {
    delete operationData.qty_actual;
  } else {
    operationData.qty_actual = formatOperationNumber(qtyActualResult.value);
  }

  for (const [field, label] of Object.entries(TLU_DATETIME_FIELDS)) {
    const normalized = normalizeOperationDateTime(submittedData[field], label);
    if (!normalized.ok) return { ok: false, msg: normalized.msg };
    if (normalized.value === "") delete operationData[field];
    else operationData[field] = normalized.value;
  }

  const pbmError = await validateFlfChoice(
    pool,
    "vendor_flf",
    String(operationData.pbm_vendor ?? ""),
    "PBM Vendor"
  );
  if (pbmError) return { ok: false, msg: pbmError };
  const floatingError = await validateFlfChoice(
    pool,
    "floating_crane",
    String(operationData.floating_crane ?? ""),
    "Floating Crane"
  );
  if (floatingError) return { ok: false, msg: floatingError };

  const selectedVendor = String(operationData.pbm_vendor ?? "");
  const forcedFloatingCrane = RESTRICTED_FLOATING_CRANES[selectedVendor];
  if (forcedFloatingCrane) {
    operationData.floating_crane = forcedFloatingCrane;
  } else if (
    Object.values(RESTRICTED_FLOATING_CRANES).includes(String(operationData.floating_crane ?? ""))
  ) {
    return {
      ok: false,
      msg: "STV KTM hanya untuk vendor KTM dan STV MAESTRO hanya untuk vendor MLS.",
    };
  }

  let noPk: string;
  if (rowType === "rc") {
    const [rows] = await coalPool.query<RowDataPacket[]>(
      `SELECT rc.id, rc.source_sibarges_id AS sibarges_id, s.no_pk
       FROM coal_barge_rc_rows rc
       INNER JOIN \`databarging\`.\`sibarges\` s ON s.id = rc.source_sibarges_id
       WHERE rc.id = ? AND s.record_status = 'ACT'
       LIMIT 1`,
      [rcRowId]
    );
    if (!rows[0]) return { ok: false, msg: "Data RC tidak ditemukan." };
    noPk = String(rows[0].no_pk);
  } else {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, no_pk FROM sibarges WHERE id = ? AND record_status = 'ACT'",
      [sibargesId]
    );
    if (!rows[0]) return { ok: false, msg: "Data barge tidak ditemukan." };
    noPk = String(rows[0].no_pk);
  }

  const sequenceRaw = String(submittedData.discharge_sequence ?? "").trim();
  if (sequenceRaw !== "") {
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) + (
           SELECT COUNT(*)
           FROM \`datacoalbarging\`.\`coal_barge_rc_rows\` rc
           INNER JOIN sibarges s2 ON s2.id = rc.source_sibarges_id
           WHERE s2.no_pk = ? AND s2.record_status = 'ACT' AND rc.usage_status = 'used'
         ) AS max_sequence
       FROM sibarges
       WHERE no_pk = ? AND record_status = 'ACT'`,
      [noPk, noPk]
    );
    const maxSequence = Number(countRows[0]?.max_sequence ?? 0);
    const sequenceNumber = Number(sequenceRaw);
    if (!/^\d+$/.test(sequenceRaw) || sequenceNumber < 1 || sequenceNumber > maxSequence) {
      return { ok: false, msg: `Discharge Sequence harus antara 1 dan ${maxSequence}.` };
    }
    operationData.discharge_sequence = String(sequenceNumber);
  }

  const operationJson = JSON.stringify(operationData);
  if (rowType === "rc") {
    await coalPool.query(
      "UPDATE coal_barge_rc_rows SET operation_data = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [operationJson, operationRemarks, rcRowId]
    );
  } else {
    await coalPool.query(
      `INSERT INTO coal_barge_operations (sibarges_id, operation_data, remarks, created_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         operation_data = VALUES(operation_data),
         remarks = VALUES(remarks),
         updated_at = CURRENT_TIMESTAMP`,
      [sibargesId, operationJson, operationRemarks, createdBy]
    );
  }

  return {
    ok: true,
    msg: "Data operasi berhasil disimpan.",
    data: { ...operationData, operation_remarks: operationRemarks },
  };
}

export type CoalBargingCreateRcResult =
  | { ok: true; rc_row_id: number; data: Record<string, unknown>; msg: string }
  | { ok: false; msg: string };

/**
 * Port of the create_rc_row AJAX action (9coalbarging.php:893-1000):
 * derives a new 'unused' RC row from a base barge's current operation_data
 * (qty_disc/qty_actual recomputed as the jetty-vs-disc/laut delta, status
 * forced to RC/ACT&RC, then stripRcUnusedFields), while also re-saving the
 * source row itself with status_act_act_rc forced to 'ACT&RC'. Both writes
 * are one transaction, matching legacy's begin_transaction/commit.
 */
export async function createCoalBargingRcRow(
  pool: Pool,
  coalPool: Pool,
  payload: {
    sibarges_id?: unknown;
    data?: Record<string, unknown>;
    operation_data?: unknown;
    operation_remarks?: unknown;
  },
  createdBy: string
): Promise<CoalBargingCreateRcResult> {
  const sibargesId = Number(payload.sibarges_id);
  if (!(Number.isInteger(sibargesId) && sibargesId > 0)) {
    return { ok: false, msg: "Data barge tidak valid." };
  }

  const [sourceRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       s.id, s.no_pk, s.buyer, s.mothervessel,
       COALESCE(coal.operation_data, tlu.operation_data) AS operation_data,
       COALESCE(coal.remarks, tlu.remarks) AS operation_remarks
     FROM sibarges s
     LEFT JOIN barge_operations tlu ON tlu.sibarges_id = s.id
     LEFT JOIN \`datacoalbarging\`.\`coal_barge_operations\` coal ON coal.sibarges_id = s.id
     WHERE s.id = ? AND s.record_status = 'ACT'
     LIMIT 1`,
    [sibargesId]
  );
  const source = sourceRows[0];
  if (!source) return { ok: false, msg: "Data barge tidak ditemukan." };

  const submittedData: Record<string, unknown> =
    payload.data && typeof payload.data === "object"
      ? payload.data
      : decodeOperationData(payload.operation_data);

  const operationData: Record<string, unknown> = {};
  for (const field of COAL_BARGING_OPERATION_FIELDS) {
    const value = String(submittedData[field] ?? "").trim();
    if (value !== "") operationData[field] = value;
  }
  for (const [field, label] of Object.entries(TLU_DATETIME_FIELDS)) {
    const normalized = normalizeOperationDateTime(submittedData[field], label);
    if (!normalized.ok) return { ok: false, msg: normalized.msg };
    if (normalized.value === "") delete operationData[field];
    else operationData[field] = normalized.value;
  }

  const sourceQtyJetty = operationNumberValue(submittedData.qty);
  const sourceQtyDisc = operationNumberValue(submittedData.qty_disc);
  const sourceQtyLaut = operationNumberValue(submittedData.qty_actual);

  operationData.qty = "0";
  operationData.qty_disc = formatOperationNumber((sourceQtyJetty ?? 0) - (sourceQtyDisc ?? 0));
  operationData.qty_actual = formatOperationNumber((sourceQtyJetty ?? 0) - (sourceQtyLaut ?? 0));
  operationData.status_act_rc = "RC";
  operationData.status_act_act_rc = "ACT&RC";
  const strippedOperationData = stripRcUnusedFields(operationData);

  const remarks = String(payload.operation_remarks ?? "").trim();
  const operationJson = JSON.stringify(strippedOperationData);

  const sourceOperationData = decodeOperationData(source.operation_data);
  sourceOperationData.status_act_act_rc = "ACT&RC";
  const sourceOperationJson = JSON.stringify(sourceOperationData);
  const sourceRemarks = String(source.operation_remarks ?? "").trim();

  const conn = await coalPool.getConnection();
  try {
    await conn.beginTransaction();
    try {
      await conn.query(
        `INSERT INTO coal_barge_operations (sibarges_id, operation_data, remarks, created_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           operation_data = VALUES(operation_data),
           remarks = VALUES(remarks),
           updated_at = CURRENT_TIMESTAMP`,
        [sibargesId, sourceOperationJson, sourceRemarks, createdBy]
      );

      const [insertResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO coal_barge_rc_rows (source_sibarges_id, usage_status, operation_data, remarks, created_by)
         VALUES (?, 'unused', ?, ?, ?)`,
        [sibargesId, operationJson, remarks, createdBy]
      );

      await conn.commit();
      return {
        ok: true,
        rc_row_id: insertResult.insertId,
        data: strippedOperationData,
        msg: "RC berhasil dibuat sebagai unused.",
      };
    } catch (e) {
      await conn.rollback();
      return { ok: false, msg: e instanceof Error ? e.message : String(e) };
    }
  } finally {
    conn.release();
  }
}

export type CoalBargingDeleteResult = { ok: true; msg: string } | { ok: false; msg: string };

/**
 * Port of the delete_coal_barging_row AJAX action (9coalbarging.php:1003-1112).
 * No explicit transaction in legacy (sequential statements) — preserved as-is.
 * row_type 'rc' + delete_scope 'unused': hard-deletes the still-unused RC row.
 * row_type 'rc' (default 'main'): soft-detaches a used RC row back to
 * 'unused', stripping the target-barge-specific fields. row_type 'base':
 * tombstones the barge (coal_barge_deleted_rows) and detaches every RC row
 * that was pointed at it.
 */
export async function deleteCoalBargingRow(
  pool: Pool,
  coalPool: Pool,
  payload: {
    row_type?: unknown;
    sibarges_id?: unknown;
    rc_row_id?: unknown;
    delete_scope?: unknown;
  },
  deletedBy: string
): Promise<CoalBargingDeleteResult> {
  const rowType = payload.row_type === "rc" ? "rc" : "base";
  const sibargesId = Number(payload.sibarges_id);
  const rcRowId = Number(payload.rc_row_id);
  const deleteScope = payload.delete_scope === "unused" ? "unused" : "main";

  if (rowType === "rc") {
    if (!(Number.isInteger(rcRowId) && rcRowId > 0)) {
      return { ok: false, msg: "Data RC tidak valid." };
    }

    if (deleteScope === "unused") {
      const [result] = await coalPool.query<ResultSetHeader>(
        "DELETE FROM coal_barge_rc_rows WHERE id = ? AND usage_status = 'unused'",
        [rcRowId]
      );
      if (result.affectedRows < 1) return { ok: false, msg: "Data RC tidak ditemukan." };
      return { ok: true, msg: "Data RC berhasil dihapus." };
    }

    const [rcRows] = await coalPool.query<RowDataPacket[]>(
      "SELECT operation_data FROM coal_barge_rc_rows WHERE id = ? LIMIT 1",
      [rcRowId]
    );
    const rcRow = rcRows[0];
    if (!rcRow) return { ok: false, msg: "Data RC tidak ditemukan." };

    const strippedOperationData = stripRcUnusedFields(decodeOperationData(rcRow.operation_data));
    const [updateResult] = await coalPool.query<ResultSetHeader>(
      "UPDATE coal_barge_rc_rows SET usage_status = 'unused', operation_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [JSON.stringify(strippedOperationData), rcRowId]
    );
    if (updateResult.affectedRows < 1) return { ok: false, msg: "Data RC tidak ditemukan." };
    return { ok: true, msg: "Data RC berhasil dihapus." };
  }

  if (!(Number.isInteger(sibargesId) && sibargesId > 0)) {
    return { ok: false, msg: "Data barge tidak valid." };
  }

  const [sourceRows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM sibarges WHERE id = ? AND record_status = 'ACT' LIMIT 1",
    [sibargesId]
  );
  if (!sourceRows[0]) return { ok: false, msg: "Data barge tidak ditemukan." };

  await coalPool.query(
    `INSERT INTO coal_barge_deleted_rows (sibarges_id, deleted_by)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE deleted_by = VALUES(deleted_by), deleted_at = CURRENT_TIMESTAMP`,
    [sibargesId, deletedBy]
  );

  const [usedRcRows] = await coalPool.query<RowDataPacket[]>(
    "SELECT id, operation_data FROM coal_barge_rc_rows WHERE source_sibarges_id = ? AND usage_status = 'used'",
    [sibargesId]
  );
  for (const rcRow of usedRcRows) {
    const strippedOperationData = stripRcUnusedFields(decodeOperationData(rcRow.operation_data));
    await coalPool.query(
      "UPDATE coal_barge_rc_rows SET usage_status = 'unused', operation_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [JSON.stringify(strippedOperationData), rcRow.id]
    );
  }

  return { ok: true, msg: "Data berhasil dihapus dari Coal Barging." };
}

export type CoalBargingImportFromTluResult =
  | { ok: true; msg: string; deleted: number; imported: number }
  | { ok: false; msg: string };

/**
 * Port of the import_from_tlu_operation AJAX action (9coalbarging.php:1115-1219):
 * vessel-scoped delete-then-reseed from TLU's barge_operations. One
 * transaction: delete coal_barge_operations for the vessel, reset the
 * vessel's 'used' RC rows back to 'unused', delete the vessel's
 * coal_barge_deleted_rows tombstones, then INSERT...SELECT fresh rows from
 * databarging.barge_operations.
 */
export async function importCoalBargingFromTlu(
  pool: Pool,
  coalPool: Pool,
  noPkRaw: unknown
): Promise<CoalBargingImportFromTluResult> {
  const noPk = String(noPkRaw ?? "").trim();
  if (noPk === "") return { ok: false, msg: "Pilih Mother Vessel terlebih dahulu." };

  const [countRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM sibarges WHERE no_pk = ? AND record_status = 'ACT'",
    [noPk]
  );
  if (Number(countRows[0]?.c ?? 0) === 0) {
    return { ok: false, msg: "Data SI Barges tidak ditemukan untuk vessel ini." };
  }

  const conn = await coalPool.getConnection();
  try {
    await conn.beginTransaction();
    try {
      const [deleteResult] = await conn.query<ResultSetHeader>(
        `DELETE coal
         FROM coal_barge_operations coal
         INNER JOIN \`databarging\`.\`sibarges\` s ON s.id = coal.sibarges_id
         WHERE s.no_pk = ? AND s.record_status = 'ACT'`,
        [noPk]
      );
      let deleted = deleteResult.affectedRows;

      const [rcResult] = await conn.query<ResultSetHeader>(
        `UPDATE coal_barge_rc_rows rc
         INNER JOIN \`databarging\`.\`sibarges\` s ON s.id = rc.source_sibarges_id
         SET rc.usage_status = 'unused', rc.updated_at = CURRENT_TIMESTAMP
         WHERE s.no_pk = ? AND s.record_status = 'ACT' AND rc.usage_status = 'used'`,
        [noPk]
      );
      deleted += rcResult.affectedRows;

      const [hiddenResult] = await conn.query<ResultSetHeader>(
        `DELETE hidden
         FROM coal_barge_deleted_rows hidden
         INNER JOIN \`databarging\`.\`sibarges\` s ON s.id = hidden.sibarges_id
         WHERE s.no_pk = ? AND s.record_status = 'ACT'`,
        [noPk]
      );
      deleted += hiddenResult.affectedRows;

      const [insertResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO coal_barge_operations (sibarges_id, operation_data, remarks, created_by, created_at, updated_at)
         SELECT tlu.sibarges_id, tlu.operation_data, tlu.remarks, tlu.created_by, tlu.created_at, tlu.updated_at
         FROM \`databarging\`.\`barge_operations\` tlu
         INNER JOIN \`databarging\`.\`sibarges\` s ON s.id = tlu.sibarges_id
         WHERE s.no_pk = ? AND s.record_status = 'ACT'`,
        [noPk]
      );
      const imported = insertResult.affectedRows;

      await conn.commit();
      return {
        ok: true,
        msg: `Import from TLU Operation selesai. Deleted: ${deleted}, Imported: ${imported}.`,
        deleted,
        imported,
      };
    } catch (e) {
      await conn.rollback();
      return {
        ok: false,
        msg: `Import from TLU Operation gagal: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  } finally {
    conn.release();
  }
}

export interface CoalBargingImportCsvResult {
  ok: boolean;
  partial: boolean;
  updated: number;
  errors: number;
  msg: string;
}

/**
 * Port of the import_operation_csv AJAX action (9coalbarging.php:1221-1402).
 * Rows match by (si_barges, no_pk) where no_pk is the outer form-selected
 * vessel, not the CSV row's own no_pk column (informational only, like
 * mother_vessel/jetty/tugboat/barge/laycan_*). discharge_sequence's max here
 * is COUNT(active sibarges for the vessel) only — no 'used' RC-row bonus,
 * unlike saveCoalBargingOperationData's max (see module doc comment).
 */
export async function importCoalBargingCsv(
  pool: Pool,
  coalPool: Pool,
  noPkRaw: unknown,
  csvText: string,
  createdBy: string
): Promise<CoalBargingImportCsvResult> {
  const noPk = String(noPkRaw ?? "").trim();
  if (noPk === "") {
    return { ok: false, partial: false, updated: 0, errors: 0, msg: "Pilih Mother Vessel terlebih dahulu." };
  }

  const firstLineEnd = csvText.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? csvText : csvText.slice(0, firstLineEnd);
  const delimiter = detectCsvDelimiter(firstLine);

  const rows = parseCsv(csvText, delimiter);
  const header = rows[0];
  if (!header || header.length === 0) {
    return { ok: false, partial: false, updated: 0, errors: 0, msg: "CSV kosong atau tidak memiliki header." };
  }

  const normalizedHeader = header.map((h) => h.replace(/^﻿/, "").trim().toLowerCase());
  const missing = COAL_BARGING_CSV_COLUMNS.filter((col) => !normalizedHeader.includes(col));
  if (missing.length > 0) {
    return {
      ok: false,
      partial: false,
      updated: 0,
      errors: 0,
      msg: `Kolom CSV hilang: ${missing.join(", ")}`,
    };
  }

  const colIndex = new Map(normalizedHeader.map((h, i) => [h, i]));
  const cell = (row: string[], col: string) => (row[colIndex.get(col) ?? -1] ?? "").trim();

  const [vendorRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT vendor_flf FROM flf WHERE vendor_flf <> ''"
  );
  const vendorOptions = vendorRows.map((r) => String(r.vendor_flf));
  const [floatingRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT floating_crane FROM flf WHERE floating_crane <> ''"
  );
  const floatingOptions = floatingRows.map((r) => String(r.floating_crane));

  const [countRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM sibarges WHERE no_pk = ? AND record_status = 'ACT'",
    [noPk]
  );
  const maxDischargeSequence = Number(countRows[0]?.c ?? 0);

  let updated = 0;
  let errors = 0;
  const errorDetails: string[] = [];
  const seenReferences = new Set<string>();

  function addImportError(rowNumber: number, reasons: string[]) {
    errors++;
    if (errorDetails.length < 10) {
      errorDetails.push(`Baris ${rowNumber}: ${[...new Set(reasons)].join("; ")}`);
    }
  }

  let rowNumber = 1;
  for (const row of rows.slice(1)) {
    rowNumber++;
    if (!row.some((c) => c.trim() !== "")) continue;

    const rowErrors: string[] = [];
    const siBarges = cell(row, "si_barges");

    if (siBarges === "") {
      rowErrors.push("si_barges kosong");
    } else if (seenReferences.has(siBarges)) {
      rowErrors.push("si_barges duplikat dalam file");
    }
    seenReferences.add(siBarges);

    const [matchedRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM sibarges WHERE si_barges = ? AND no_pk = ? AND record_status = 'ACT' LIMIT 1",
      [siBarges, noPk]
    );
    const matched = matchedRows[0];
    if (!matched) rowErrors.push("SI Barges tidak ditemukan pada vessel yang dipilih");

    const operationData: Record<string, unknown> = {};
    for (const field of COAL_BARGING_OPERATION_FIELDS) {
      const value = cell(row, field);
      if (value !== "") operationData[field] = value;
    }

    const qtyDiscRaw = cell(row, "qty_disc");
    const rcRaw = cell(row, "rc");
    const qtyActualRaw = cell(row, "qty_actual");
    const qtyDiscNormalized = qtyDiscRaw.replace(/[, ]/g, "");
    const rcNormalized = rcRaw.replace(/[, ]/g, "");
    const qtyActualNormalized = qtyActualRaw.replace(/[, ]/g, "");
    if (qtyDiscRaw !== "" && (qtyDiscNormalized === "" || Number.isNaN(Number(qtyDiscNormalized)))) {
      rowErrors.push("qty_disc harus angka");
    }
    if (rcRaw !== "" && (rcNormalized === "" || Number.isNaN(Number(rcNormalized)))) {
      rowErrors.push("rc harus angka");
    }
    if (qtyActualRaw !== "" && (qtyActualNormalized === "" || Number.isNaN(Number(qtyActualNormalized)))) {
      rowErrors.push("qty_actual harus angka");
    }
    if (rowErrors.length === 0 && qtyActualRaw !== "") {
      operationData.qty_actual = formatOperationNumber(Number(qtyActualNormalized));
    }

    for (const field of Object.keys(TLU_DATETIME_FIELDS)) {
      const value = cell(row, field);
      const normalized = parseOperationDateTimeValue(value);
      if (normalized === null) {
        rowErrors.push(`${field} tidak valid`);
        delete operationData[field];
      } else if (normalized === "") {
        delete operationData[field];
      } else {
        operationData[field] = normalized;
      }
    }

    const sequence = cell(row, "discharge_sequence");
    if (sequence !== "") {
      const sequenceNumber = Number(sequence);
      if (!/^\d+$/.test(sequence) || sequenceNumber < 1 || sequenceNumber > maxDischargeSequence) {
        rowErrors.push(`discharge_sequence harus antara 1 dan ${maxDischargeSequence}`);
      } else {
        operationData.discharge_sequence = String(sequenceNumber);
      }
    }

    const vendor = String(operationData.pbm_vendor ?? "");
    const floating = String(operationData.floating_crane ?? "");
    if (vendor !== "" && !vendorOptions.includes(vendor)) rowErrors.push("pbm_vendor tidak ada di data FLF");
    if (floating !== "" && !floatingOptions.includes(floating)) {
      rowErrors.push("floating_crane tidak ada di data FLF");
    }
    const forcedFloatingCrane = RESTRICTED_FLOATING_CRANES[vendor];
    if (forcedFloatingCrane) {
      operationData.floating_crane = forcedFloatingCrane;
    } else if (Object.values(RESTRICTED_FLOATING_CRANES).includes(floating)) {
      rowErrors.push("STV KTM hanya untuk KTM dan STV MAESTRO hanya untuk MLS");
    }

    if (rowErrors.length > 0 || !matched) {
      addImportError(rowNumber, rowErrors);
      continue;
    }

    const remarks = cell(row, "remarks");
    const operationJson = JSON.stringify(operationData);
    try {
      await coalPool.query(
        `INSERT INTO coal_barge_operations (sibarges_id, operation_data, remarks, created_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           operation_data = VALUES(operation_data),
           remarks = VALUES(remarks),
           updated_at = CURRENT_TIMESTAMP`,
        [Number(matched.id), operationJson, remarks, createdBy]
      );
      updated++;
    } catch (e) {
      addImportError(rowNumber, [e instanceof Error ? e.message : "Insert gagal"]);
    }
  }

  let msg = `Import selesai. Updated: ${updated}, Error: ${errors}.`;
  if (errorDetails.length > 0) msg += "\n" + errorDetails.join("\n");

  return { ok: updated > 0 || errors === 0, partial: errors > 0, updated, errors, msg };
}

export type CoalBargingInputRcResult = { ok: true; msg: string } | { ok: false; msg: string };

/**
 * Port of the input_rc_row AJAX action (9coalbarging.php:1477-1564): attaches
 * an 'unused' RC row to a chosen target barge sharing the RC's original
 * source tugboat. no_pk/buyer/mothervessel come from the target row
 * unconditionally; pbm_vendor/floating_crane/start_disch/completed_disch are
 * reattached from the target's own current operation_data (the same fields
 * stripRcUnusedFields strips off whenever an RC row goes back to 'unused').
 */
export async function inputCoalBargingRcRow(
  pool: Pool,
  coalPool: Pool,
  payload: { rc_row_id?: unknown; target_sibarges_id?: unknown }
): Promise<CoalBargingInputRcResult> {
  const rcRowId = Number(payload.rc_row_id);
  const targetSibargesId = Number(payload.target_sibarges_id);
  if (
    !(Number.isInteger(rcRowId) && rcRowId > 0) ||
    !(Number.isInteger(targetSibargesId) && targetSibargesId > 0)
  ) {
    return { ok: false, msg: "Pilihan RC tidak valid." };
  }

  const [rcRows] = await coalPool.query<RowDataPacket[]>(
    `SELECT rc.id, rc.operation_data, source.tugboat AS source_tugboat
     FROM coal_barge_rc_rows rc
     INNER JOIN \`databarging\`.\`sibarges\` source ON source.id = rc.source_sibarges_id
     WHERE rc.id = ? AND rc.usage_status = 'unused'
     LIMIT 1`,
    [rcRowId]
  );
  const rcRow = rcRows[0];
  if (!rcRow) return { ok: false, msg: "RC tidak ditemukan atau sudah digunakan." };

  const [targetRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       s.id, s.tugboat, s.no_pk, s.buyer, s.mothervessel, s.anchorage,
       COALESCE(coal.operation_data, tlu.operation_data) AS operation_data
     FROM sibarges s
     LEFT JOIN barge_operations tlu ON tlu.sibarges_id = s.id
     LEFT JOIN \`datacoalbarging\`.\`coal_barge_operations\` coal ON coal.sibarges_id = s.id
     LEFT JOIN \`datacoalbarging\`.\`coal_barge_deleted_rows\` hidden ON hidden.sibarges_id = s.id
     WHERE s.id = ? AND s.record_status = 'ACT' AND hidden.sibarges_id IS NULL
     LIMIT 1`,
    [targetSibargesId]
  );
  const targetRow = targetRows[0];
  if (!targetRow) return { ok: false, msg: "Target TB tidak ditemukan." };
  if (String(targetRow.tugboat) !== String(rcRow.source_tugboat)) {
    return { ok: false, msg: "RC hanya bisa dipakai untuk TB yang sama." };
  }

  const operationData = decodeOperationData(rcRow.operation_data);
  for (const field of ["no_pk", "buyer", "mothervessel"] as const) {
    operationData[field] = String(targetRow[field] ?? "");
  }
  const targetOperationData = decodeOperationData(targetRow.operation_data);
  for (const field of ["pbm_vendor", "floating_crane", "start_disch", "completed_disch"] as const) {
    const targetValue = String(targetOperationData[field] ?? "").trim();
    if (targetValue === "") delete operationData[field];
    else operationData[field] = targetValue;
  }

  const [updateResult] = await coalPool.query<ResultSetHeader>(
    `UPDATE coal_barge_rc_rows
     SET source_sibarges_id = ?, usage_status = 'used', operation_data = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND usage_status = 'unused'`,
    [targetSibargesId, JSON.stringify(operationData), rcRowId]
  );
  if (updateResult.affectedRows < 1) return { ok: false, msg: "RC gagal dipakai." };

  return { ok: true, msg: "RC berhasil dimasukkan." };
}
