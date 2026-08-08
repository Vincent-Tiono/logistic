import type { Pool, RowDataPacket } from "mysql2/promise";

export interface SiBargesByVesselRow extends RowDataPacket {
  id: number;
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
  vessel_pkk: string | null;
  vessel_rkbm: string | null;
  stowageplan_mt: number | null;
  shipper_laytime: number | null;
  operation_id: number | null;
  arrival_jetty: string | null;
  commence_loading: string | null;
  completed_loading: string | null;
  departure_jetty: string | null;
  arrival_anchorage: string | null;
  mooring: string | null;
  commence_discharging: string | null;
  completed_discharging: string | null;
  clear_pass: string | null;
  qty_ds: number | null;
  flf: string | null;
  operation_status: string | null;
  operation_data: string | null;
  operation_remarks: string | null;
  operation_created_by: string | null;
  operation_created_at: string | null;
  operation_updated_at: string | null;
}

export interface AllOperationsRow extends RowDataPacket {
  id: number;
  no_pk: string;
  buyer: string;
  mothervessel: string;
  jetty_code: string;
  shipper_code: string;
  tugboat: string;
  barge: string;
  barge_seq: number;
  laycan_start: string | null;
  laycan_end: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  vessel_pkk: string | null;
  vessel_rkbm: string | null;
  stowageplan_mt: number | null;
  earliest_laycan_start: string | null;
  shipper_laytime: number | null;
  operation_data: string | null;
  operation_remarks: string | null;
}

export interface VesselPeriodRow extends RowDataPacket {
  no_pk: string;
  mothervessel: string;
  earliest_laycan_start: string | null;
  laycan_year: number | null;
  laycan_month: number | null;
}

interface SortableRow {
  id: number;
  no_pk: string;
  mothervessel: string;
  barge_seq: number;
  earliest_laycan_start?: string | null;
  operation_data: string | null;
}

interface VesselDefaultableRow {
  operation_data: string | null;
  vessel_pkk?: string | null;
  vessel_rkbm?: string | null;
  shipper_laytime?: number | string | null;
}

function decodeOperationData(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Ordinal string comparison, matching PHP's byte-order strcmp(). */
function strcmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Port of Operation/8tluoperation.php's decodeOperationDataWithVesselDefaults()
 * (lines 349-388): decodes operation_data and merges in defaults that aren't
 * already saved on the row — pkk/rkbm from the vessel, laytime from the
 * shipper, ltc_rate from the barge vendor (one extra query, only when a
 * barge_vendor is set and ltc_rate isn't already saved).
 */
export async function decodeOperationDataWithVesselDefaults(
  row: VesselDefaultableRow,
  pool?: Pool
): Promise<Record<string, unknown>> {
  const data = decodeOperationData(row.operation_data);

  for (const field of ["pkk", "rkbm"] as const) {
    if (String(data[field] ?? "").trim() !== "") continue;

    const vesselDate = String(
      (field === "pkk" ? row.vessel_pkk : row.vessel_rkbm) ?? ""
    ).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(vesselDate)) {
      data[field] = `${vesselDate} 00:00`;
    }
  }

  if (String(data.laytime ?? "").trim() === "") {
    const shipperLaytime = String(row.shipper_laytime ?? "").trim();
    if (shipperLaytime !== "") {
      data.laytime = shipperLaytime;
    }
  }

  if (pool && String(data.ltc_rate ?? "").trim() === "") {
    const bargeVendor = String(data.barge_vendor ?? "").trim();
    if (bargeVendor !== "") {
      const [vendorRows] = await pool.query<RowDataPacket[]>(
        "SELECT ltc_rate FROM vendor WHERE vendor = ? LIMIT 1",
        [bargeVendor]
      );
      const ltcRate = vendorRows[0]?.ltc_rate;
      if (ltcRate !== null && ltcRate !== undefined) {
        data.ltc_rate = ltcRate;
      }
    }
  }

  return data;
}

/**
 * Port of withDecodedOperationData(): applies the vessel defaults above and
 * re-encodes operation_data back into a JSON string, matching the shape the
 * browser expects to re-parse and run assets/js/cycle-time.mjs over.
 */
export async function withDecodedOperationData<T extends VesselDefaultableRow>(
  row: T,
  pool?: Pool
): Promise<T> {
  const operationData = await decodeOperationDataWithVesselDefaults(row, pool);
  const hasData = Object.keys(operationData).length > 0;
  return {
    ...row,
    operation_data: hasData ? JSON.stringify(operationData) : null,
  };
}

/**
 * Port of compareTluExportRows() (lines 403-431): sorts by earliest laycan
 * start, then vessel (no_pk + mothervessel), then discharge_sequence (read
 * from the row's still-raw operation_data), then barge_seq, then id.
 */
export function compareTluOperationRows(
  left: SortableRow,
  right: SortableRow
): number {
  const periodCompare = strcmp(
    String(left.earliest_laycan_start ?? ""),
    String(right.earliest_laycan_start ?? "")
  );
  if (periodCompare !== 0) return periodCompare;

  const vesselCompare = strcmp(
    `${left.no_pk ?? ""}\0${left.mothervessel ?? ""}`,
    `${right.no_pk ?? ""}\0${right.mothervessel ?? ""}`
  );
  if (vesselCompare !== 0) return vesselCompare;

  const leftData = decodeOperationData(left.operation_data);
  const rightData = decodeOperationData(right.operation_data);
  const leftSequence = String(leftData.discharge_sequence ?? "").trim();
  const rightSequence = String(rightData.discharge_sequence ?? "").trim();
  if (leftSequence === "" && rightSequence !== "") return 1;
  if (leftSequence !== "" && rightSequence === "") return -1;
  if (leftSequence !== "" && rightSequence !== "") {
    const sequenceCompare = Number(leftSequence) - Number(rightSequence);
    if (sequenceCompare !== 0) return sequenceCompare;
  }

  const bargeSequenceCompare = Number(left.barge_seq) - Number(right.barge_seq);
  return bargeSequenceCompare !== 0
    ? bargeSequenceCompare
    : Number(left.id) - Number(right.id);
}

/**
 * Port of the `si_barges_by_vessel` AJAX action (8tluoperation.php:1029-1091).
 * Feeds the per-vessel Cycle Time timeline view — the browser sorts the
 * result with the same discharge-sequence ordering and runs
 * computeCycleTimeFields()/getFieldValue() (assets/js/cycle-time.mjs) over
 * each row (ADR-0001: no cycle-time formula is ported to server code).
 */
export async function listSiBargesByVessel(
  pool: Pool,
  noPk: string
): Promise<SiBargesByVesselRow[]> {
  const [rows] = await pool.query<SiBargesByVesselRow[]>(
    {
      sql: `SELECT
          s.id, s.no_pk, s.no_si_vessel, s.buyer, s.mothervessel,
          s.si_type, s.month_num, s.year_num, s.barge_seq, s.si_barges,
          s.tugboat, s.barge, s.anchorage, s.term, s.qty_plan,
          s.laycan_start, s.laycan_end,
          s.jetty_code, s.jetty_name,
          s.shipper_code, s.shipper_name,
          s.record_status, s.remarks,
          s.created_by, s.created_at, s.updated_at,
          v.pkk AS vessel_pkk,
          v.rkbm AS vessel_rkbm,
          v.stowageplan_mt,
          sh.laytime AS shipper_laytime,
          o.id AS operation_id,
          o.arrival_jetty,
          o.commence_loading,
          o.completed_loading,
          o.departure_jetty,
          o.arrival_anchorage,
          o.mooring,
          o.commence_discharging,
          o.completed_discharging,
          o.clear_pass,
          o.qty_ds,
          o.flf,
          o.operation_status,
          o.operation_data,
          o.remarks AS operation_remarks,
          o.created_by AS operation_created_by,
          o.created_at AS operation_created_at,
          o.updated_at AS operation_updated_at
        FROM sibarges s
        INNER JOIN vessel v ON v.no_pk = s.no_pk
        LEFT JOIN barge_operations o ON o.sibarges_id = s.id
        LEFT JOIN shipper sh ON sh.shipper = s.shipper_code
        WHERE s.no_pk = ?
          AND s.record_status = 'ACT'
        ORDER BY s.barge_seq ASC, s.id ASC`,
      dateStrings: true,
    },
    [noPk]
  );

  return Promise.all(rows.map((row) => withDecodedOperationData(row, pool)));
}

/**
 * Port of the landing-page "All Years / All Vessels" query
 * (8tluoperation.php:1153-1185). Every active vessel's rows, sorted with
 * compareTluOperationRows and decoded with vessel defaults, ready for the
 * browser to group by vessel and run computeCycleTimeFields() over.
 */
export async function listAllActiveOperations(
  pool: Pool
): Promise<AllOperationsRow[]> {
  const [rows] = await pool.query<AllOperationsRow[]>({
    sql: `SELECT
        s.id, s.no_pk, s.buyer, s.mothervessel, s.jetty_code, s.shipper_code,
        s.tugboat, s.barge, s.barge_seq, s.laycan_start, s.laycan_end,
        s.created_by, s.created_at, s.updated_at,
        v.pkk AS vessel_pkk, v.rkbm AS vessel_rkbm, v.stowageplan_mt,
        p.earliest_laycan_start,
        sh.laytime AS shipper_laytime,
        o.operation_data, o.remarks AS operation_remarks
      FROM sibarges s
      INNER JOIN (
        SELECT no_pk, mothervessel, MIN(laycan_start) AS earliest_laycan_start
        FROM sibarges
        WHERE no_pk <> ''
          AND mothervessel <> ''
          AND record_status = 'ACT'
        GROUP BY no_pk, mothervessel
        HAVING MIN(laycan_start) IS NOT NULL
      ) p ON p.no_pk = s.no_pk AND p.mothervessel = s.mothervessel
      INNER JOIN vessel v ON v.no_pk = s.no_pk
      LEFT JOIN barge_operations o ON o.sibarges_id = s.id
      LEFT JOIN shipper sh ON sh.shipper = s.shipper_code
      WHERE s.record_status = 'ACT'`,
    dateStrings: true,
  });

  rows.sort(compareTluOperationRows);
  return Promise.all(rows.map((row) => withDecodedOperationData(row, pool)));
}

/**
 * Port of the Year/Month/Mother-Vessel dropdown query
 * (8tluoperation.php:1131-1151): each active vessel assigned to the period
 * of its earliest active SI Barges laycan start.
 */
export async function listVesselPeriods(
  pool: Pool
): Promise<VesselPeriodRow[]> {
  const [rows] = await pool.query<VesselPeriodRow[]>({
    sql: `SELECT
        no_pk,
        mothervessel,
        MIN(laycan_start) AS earliest_laycan_start,
        YEAR(MIN(laycan_start)) AS laycan_year,
        MONTH(MIN(laycan_start)) AS laycan_month
      FROM sibarges
      WHERE no_pk <> ''
        AND mothervessel <> ''
        AND record_status = 'ACT'
      GROUP BY no_pk, mothervessel
      HAVING earliest_laycan_start IS NOT NULL
      ORDER BY earliest_laycan_start ASC, mothervessel ASC, no_pk ASC`,
    dateStrings: true,
  });

  return rows;
}
