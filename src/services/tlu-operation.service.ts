import type { Pool, RowDataPacket } from "mysql2/promise";
import { detectCsvDelimiter, parseCsv } from "../lib/csv-parser.js";
import {
  RESTRICTED_FLOATING_CRANES,
  TLU_CSV_COLUMNS,
  TLU_CYCLE_TIME_FIELDS,
  TLU_CYCLE_TIME_NUMBER_FIELDS,
  TLU_CYCLE_TIME_TRUEFALSE_FIELDS,
  TLU_CYCLE_TIME_YESNO_FIELDS,
  TLU_DATETIME_FIELDS,
  TLU_OPERATION_FIELDS,
  formatOperationNumber,
  normalizeOperationDateTime,
  operationTimelineErrors,
  parseOperationDateTimeValue,
  parseOperationNumber,
} from "../lib/operation-fields.js";

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

export function decodeOperationData(value: unknown): Record<string, unknown> {
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

export interface OperationOptionLists {
  bargeVendorOptions: string[];
  pbmVendorOptions: string[];
  floatingCraneOptions: string[];
}

/**
 * Port of the inline SELECT DISTINCT queries used to populate the
 * barge_vendor/pbm_vendor/floating_crane <select> options at page render
 * (8tluoperation.php ~1119-1127) and to preload import_operation_csv's
 * per-row membership checks (8tluoperation.php:848-856) — one shared query
 * set reused by both call sites.
 */
export async function listOperationOptionLists(
  pool: Pool
): Promise<OperationOptionLists> {
  const [vendorRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT vendor FROM vendor WHERE vendor <> '' ORDER BY vendor ASC"
  );
  const [pbmRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT vendor_flf FROM flf WHERE vendor_flf <> '' ORDER BY vendor_flf ASC"
  );
  const [floatingRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT floating_crane FROM flf WHERE floating_crane <> '' ORDER BY floating_crane ASC"
  );

  return {
    bargeVendorOptions: vendorRows.map((row) => String(row.vendor)),
    pbmVendorOptions: pbmRows.map((row) => String(row.vendor_flf)),
    floatingCraneOptions: floatingRows.map((row) => String(row.floating_crane)),
  };
}

async function validateVendorChoice(
  pool: Pool,
  value: string,
  label: string
): Promise<string | null> {
  if (value === "") return null;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM vendor WHERE vendor = ? LIMIT 1",
    [value]
  );
  return rows.length > 0 ? null : `${label} tidak ditemukan pada data Barge Vendor.`;
}

async function validateFlfChoice(
  pool: Pool,
  column: "vendor_flf" | "floating_crane",
  value: string,
  label: string
): Promise<string | null> {
  if (value === "") return null;
  const sql =
    column === "vendor_flf"
      ? "SELECT 1 FROM flf WHERE vendor_flf = ? LIMIT 1"
      : "SELECT 1 FROM flf WHERE floating_crane = ? LIMIT 1";
  const [rows] = await pool.query<RowDataPacket[]>(sql, [value]);
  return rows.length > 0 ? null : `${label} tidak ditemukan pada data FLF.`;
}

export type OperationSaveResult =
  | { ok: true; msg: string; data: Record<string, unknown> }
  | { ok: false; msg: string };

/**
 * Port of the save_operation_data AJAX action (8tluoperation.php:663-814).
 * Upserts one sibarges row's operation_data JSON blob + remarks into
 * barge_operations, keyed by the uq_barge_operations_sibarges unique
 * constraint. Partial merge: only fields present as keys in submittedData
 * are touched — baseline values for absent keys are left untouched, letting
 * the merged Cycle Time / Input modal save a subset of columns without
 * wiping the rest (see ADR-0001 / issue #11).
 */
export async function saveOperationData(
  pool: Pool,
  sibargesIdRaw: unknown,
  submittedData: Record<string, unknown>,
  createdBy: string
): Promise<OperationSaveResult> {
  const sibargesId = Number(sibargesIdRaw);
  if (!Number.isInteger(sibargesId) || sibargesId <= 0) {
    return { ok: false, msg: "Data barge tidak valid." };
  }

  const [baselineRows] = await pool.query<RowDataPacket[]>(
    "SELECT operation_data, remarks FROM barge_operations WHERE sibarges_id = ?",
    [sibargesId]
  );
  const baselineRow = baselineRows[0];

  const operationRemarks =
    "operation_remarks" in submittedData
      ? String(submittedData.operation_remarks ?? "").trim()
      : String(baselineRow?.remarks ?? "");

  const operationData = decodeOperationData(baselineRow?.operation_data ?? "");

  for (const field of TLU_OPERATION_FIELDS) {
    if (!(field in submittedData)) continue;
    const value = String(submittedData[field] ?? "").trim();
    if (value !== "") {
      operationData[field] = value;
    } else {
      delete operationData[field];
    }
  }

  if ("qty_disc" in submittedData || "rc" in submittedData) {
    const qtyDiscResult = parseOperationNumber(submittedData.qty_disc, "QTY DISC");
    if (!qtyDiscResult.ok) return { ok: false, msg: qtyDiscResult.msg };
    const rcResult = parseOperationNumber(submittedData.rc, "RC");
    if (!rcResult.ok) return { ok: false, msg: rcResult.msg };

    if (qtyDiscResult.value === null && rcResult.value === null) {
      delete operationData.qty_actual;
    } else {
      operationData.qty_actual = formatOperationNumber(
        (qtyDiscResult.value ?? 0) + (rcResult.value ?? 0)
      );
    }
  }

  for (const [field, label] of Object.entries(TLU_DATETIME_FIELDS)) {
    if (!(field in submittedData)) continue;
    const normalized = normalizeOperationDateTime(submittedData[field], label);
    if (!normalized.ok) return { ok: false, msg: normalized.msg };
    if (normalized.value === "") {
      delete operationData[field];
    } else {
      operationData[field] = normalized.value;
    }
  }

  for (const field of TLU_CYCLE_TIME_NUMBER_FIELDS) {
    if (!(field in submittedData)) continue;
    const value = String(submittedData[field] ?? "").trim();
    if (value === "") continue;
    const result = parseOperationNumber(value, TLU_CYCLE_TIME_FIELDS[field]);
    if (!result.ok) return { ok: false, msg: result.msg };
  }

  for (const field of TLU_CYCLE_TIME_YESNO_FIELDS) {
    if (!(field in submittedData)) continue;
    const value = String(submittedData[field] ?? "").trim();
    if (value !== "" && value !== "Yes" && value !== "No") {
      return { ok: false, msg: `${TLU_CYCLE_TIME_FIELDS[field]} harus Yes atau No.` };
    }
  }

  for (const field of TLU_CYCLE_TIME_TRUEFALSE_FIELDS) {
    if (!(field in submittedData)) continue;
    const value = String(submittedData[field] ?? "").trim();
    if (value !== "" && value !== "True" && value !== "False") {
      return { ok: false, msg: `${TLU_CYCLE_TIME_FIELDS[field]} harus True atau False.` };
    }
  }

  const timelineErrors = operationTimelineErrors(operationData);
  if (timelineErrors.length > 0) {
    return { ok: false, msg: timelineErrors.join(". ") + "." };
  }

  const vendorError = await validateVendorChoice(
    pool,
    String(operationData.barge_vendor ?? ""),
    "Barge Vendor"
  );
  if (vendorError) return { ok: false, msg: vendorError };

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

  const [sibargesRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, no_pk FROM sibarges WHERE id = ? AND record_status = 'ACT'",
    [sibargesId]
  );
  const sibargesRow = sibargesRows[0];
  if (!sibargesRow) {
    return { ok: false, msg: "Data barge tidak ditemukan." };
  }

  const sequenceRaw = String(submittedData.discharge_sequence ?? "").trim();
  if (sequenceRaw !== "") {
    const [countRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM sibarges WHERE no_pk = ? AND record_status = 'ACT'",
      [sibargesRow.no_pk]
    );
    const maxSequence = Number(countRows[0]?.c ?? 0);
    const sequenceNumber = Number(sequenceRaw);
    if (!/^\d+$/.test(sequenceRaw) || sequenceNumber < 1 || sequenceNumber > maxSequence) {
      return { ok: false, msg: `Discharge Sequence harus antara 1 dan ${maxSequence}.` };
    }
    operationData.discharge_sequence = String(sequenceNumber);
  }

  const operationJson = JSON.stringify(operationData);
  await pool.query(
    `INSERT INTO barge_operations (sibarges_id, operation_data, remarks, created_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       operation_data = VALUES(operation_data),
       remarks = VALUES(remarks),
       updated_at = CURRENT_TIMESTAMP`,
    [sibargesId, operationJson, operationRemarks, createdBy]
  );

  return {
    ok: true,
    msg: "Data operasi berhasil disimpan.",
    data: { ...operationData, operation_remarks: operationRemarks },
  };
}

export interface ImportOperationResult {
  ok: boolean;
  partial: boolean;
  updated: number;
  errors: number;
  msg: string;
}

/**
 * Port of the import_operation_csv AJAX action (8tluoperation.php:817-1027).
 * Unlike saveOperationData, each CSV row's operation_data wholesale replaces
 * the existing barge_operations row on upsert — no baseline merge, only
 * fields present in that CSV row survive. IT-division gating is the caller's
 * responsibility (route level), matching src/routes/barges.ts's split.
 */
export async function importOperationCsv(
  pool: Pool,
  csvText: string,
  createdBy: string
): Promise<ImportOperationResult> {
  const firstLineEnd = csvText.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? csvText : csvText.slice(0, firstLineEnd);
  const delimiter = detectCsvDelimiter(firstLine);

  const rows = parseCsv(csvText, delimiter);
  const header = rows[0];
  if (!header || header.length === 0) {
    return {
      ok: false,
      partial: false,
      updated: 0,
      errors: 0,
      msg: "CSV kosong atau tidak memiliki header.",
    };
  }

  const normalizedHeader = header.map((h) => h.replace(/^﻿/, "").trim().toLowerCase());
  const missing = TLU_CSV_COLUMNS.filter((col) => !normalizedHeader.includes(col));
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

  const optionLists = await listOperationOptionLists(pool);

  let updated = 0;
  let errors = 0;
  const errorDetails: string[] = [];
  const seenReferences = new Set<string>();
  const maxDischargeSequenceByVessel = new Map<string, number>();

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
    const rowNoPk = cell(row, "no_pk");

    if (rowNoPk === "") rowErrors.push("no_pk kosong");

    const rowKey = `${siBarges}\0${rowNoPk}`;
    if (siBarges === "") {
      rowErrors.push("si_barges kosong");
    } else if (seenReferences.has(rowKey)) {
      rowErrors.push("si_barges duplikat dalam file");
    }
    seenReferences.add(rowKey);

    let matchedId: number | null = null;
    if (siBarges !== "" && rowNoPk !== "") {
      const [matchedRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM sibarges WHERE si_barges = ? AND no_pk = ? AND record_status = 'ACT' LIMIT 1",
        [siBarges, rowNoPk]
      );
      if (matchedRows[0]) {
        matchedId = Number(matchedRows[0].id);
      } else {
        rowErrors.push("SI Barges tidak ditemukan untuk vessel ini");
      }
    }

    const operationData: Record<string, unknown> = {};
    for (const field of TLU_OPERATION_FIELDS) {
      if (field === "qty_actual") continue;
      const value = cell(row, field);
      if (value !== "") operationData[field] = value;
    }

    const qtyDiscRaw = cell(row, "qty_disc");
    const rcRaw = cell(row, "rc");
    const qtyDiscNormalized = qtyDiscRaw.replace(/[, ]/g, "");
    const rcNormalized = rcRaw.replace(/[, ]/g, "");
    if (qtyDiscRaw !== "" && (qtyDiscNormalized === "" || Number.isNaN(Number(qtyDiscNormalized)))) {
      rowErrors.push("qty_disc harus angka");
    }
    if (rcRaw !== "" && (rcNormalized === "" || Number.isNaN(Number(rcNormalized)))) {
      rowErrors.push("rc harus angka");
    }
    if (rowErrors.length === 0 && (qtyDiscRaw !== "" || rcRaw !== "")) {
      operationData.qty_actual = formatOperationNumber(
        (qtyDiscRaw === "" ? 0 : Number(qtyDiscNormalized)) +
          (rcRaw === "" ? 0 : Number(rcNormalized))
      );
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

    rowErrors.push(...operationTimelineErrors(operationData));

    let maxDischargeSequence = 0;
    if (rowNoPk !== "") {
      if (!maxDischargeSequenceByVessel.has(rowNoPk)) {
        const [countRows] = await pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) AS c FROM sibarges WHERE no_pk = ? AND record_status = 'ACT'",
          [rowNoPk]
        );
        maxDischargeSequenceByVessel.set(rowNoPk, Number(countRows[0]?.c ?? 0));
      }
      maxDischargeSequence = maxDischargeSequenceByVessel.get(rowNoPk) ?? 0;
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

    const bargeVendor = String(operationData.barge_vendor ?? "");
    if (bargeVendor !== "" && !optionLists.bargeVendorOptions.includes(bargeVendor)) {
      rowErrors.push("barge_vendor tidak ada di data Barge Vendor");
    }

    const pbmVendor = String(operationData.pbm_vendor ?? "");
    const floatingCrane = String(operationData.floating_crane ?? "");
    if (pbmVendor !== "" && !optionLists.pbmVendorOptions.includes(pbmVendor)) {
      rowErrors.push("pbm_vendor tidak ada di data FLF");
    }
    if (floatingCrane !== "" && !optionLists.floatingCraneOptions.includes(floatingCrane)) {
      rowErrors.push("floating_crane tidak ada di data FLF");
    }
    const forcedFloatingCrane = RESTRICTED_FLOATING_CRANES[pbmVendor];
    if (forcedFloatingCrane) {
      operationData.floating_crane = forcedFloatingCrane;
    } else if (Object.values(RESTRICTED_FLOATING_CRANES).includes(floatingCrane)) {
      rowErrors.push("STV KTM hanya untuk KTM dan STV MAESTRO hanya untuk MLS");
    }

    if (rowErrors.length > 0 || matchedId === null) {
      addImportError(rowNumber, rowErrors);
      continue;
    }

    const remarks = cell(row, "remarks");
    const operationJson = JSON.stringify(operationData);
    try {
      await pool.query(
        `INSERT INTO barge_operations (sibarges_id, operation_data, remarks, created_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           operation_data = VALUES(operation_data),
           remarks = VALUES(remarks),
           updated_at = CURRENT_TIMESTAMP`,
        [matchedId, operationJson, remarks, createdBy]
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
