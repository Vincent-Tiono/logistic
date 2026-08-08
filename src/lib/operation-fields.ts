/**
 * TLU Operation field constants and pure validation/formatting helpers,
 * ported from Operation/8tluoperation.php:18-346 and
 * includes/operation_helpers.php:9-41. Shared by src/services/tlu-operation.service.ts,
 * src/routes/tlu-operation.ts (option lists), and the characterization tests.
 */

/** Port of TLU_OPERATION_FIELDS (8tluoperation.php:18-89). Full allowlist
 * merged into operation_data on save/import. */
export const TLU_OPERATION_FIELDS: readonly string[] = [
  "qty",
  "qty_disc",
  "rc",
  "qty_actual",
  "barge_vendor",
  "pbm_vendor",
  "floating_crane",
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
  "waiting_loading_jetty",
  "check_waiting_loading_jetty",
  "barges_arrival_early",
  "waiting_plan_loading",
  "loading_time_jetty",
  "part_1",
  "check_part_1",
  "lhv_time",
  "spog_time",
  "clear_pass_time",
  "part_2",
  "check_part_2",
  "mooring_2",
  "sailing_time",
  "total_waiting_disch_mv",
  "check_total_waiting_disch_mv",
  "waiting_cargo_readiness",
  "waiting_mv",
  "waiting_flf",
  "waiting_queueing",
  "waiting_sequence",
  "other_factor",
  "back_to_jetty_time",
  "loading_rate",
  "disch_time_loading_rate",
  "disch_time_percent",
  "cargo_readiness_p3",
  "pure_time",
  "waiting_cargo_readiness_p3",
  "waiting_mv_p3",
  "waiting_flf_p3",
  "waiting_queuing_p3",
  "waiting_sequence_p3",
  "other_factor_p3",
  "check_waiting_time_disch_mv",
  "total_ct_ltc",
  "laytime",
  "ltc_rate",
  "ltc_day",
  "ltc_total",
];

/** Port of TLU_DATETIME_FIELDS (8tluoperation.php:174-193). */
export const TLU_DATETIME_FIELDS: Record<string, string> = {
  arrival_jetty: "Arrival Jetty",
  start_loading: "Start Loading",
  completed_loading: "Completed Loading",
  lhv: "LHV",
  spog_zona_2: "SPOG ZONA 2",
  pkk: "PKK",
  rkbm: "RKBM",
  sts_spb: "STS/SPB",
  start_mooring: "Start Mooring",
  end_mooring: "End Mooring",
  clear_pass: "Clear Pass",
  start_mooring_clear_pass: "Start Mooring Clear Pass",
  cast_off_mooring_clear_pass: "Cast Off Mooring Clear Pass",
  ta_barges_actual: "TA Barges Actual",
  ta_mv: "TA MV",
  ta_flf: "TA FLF",
  cargo_readiness_actual: "Cargo Readiness Actual",
  start_disch: "Start Disch",
  completed_disch: "Completed Disch",
  back_to_jetty: "Back to Jetty",
};

/** Port of TLU_CYCLE_TIME_FIELDS (8tluoperation.php:91-130). Field->label,
 * used for validation error messages. */
export const TLU_CYCLE_TIME_FIELDS: Record<string, string> = {
  waiting_loading_jetty: "Waiting Loading Jetty",
  check_waiting_loading_jetty: "Check Waiting Loading Jetty",
  barges_arrival_early: "Barges Arrival Early",
  waiting_plan_loading: "Waiting Plan Loading",
  loading_time_jetty: "Loading Time Jetty",
  part_1: "Part 1",
  check_part_1: "Check Part 1",
  lhv_time: "LHV Time",
  spog_time: "SPOG Time",
  clear_pass_time: "Clear Pass Time",
  part_2: "Part 2",
  check_part_2: "Check Part 2",
  mooring_2: "Mooring 2",
  sailing_time: "Sailing Time",
  total_waiting_disch_mv: "Total Waiting Disch MV",
  check_total_waiting_disch_mv: "Check Total Waiting Disch MV",
  waiting_cargo_readiness: "Waiting Cargo Readiness (P2)",
  waiting_mv: "Waiting MV (P2)",
  waiting_flf: "Waiting FLF (P2)",
  waiting_queueing: "Waiting Queueing (P2)",
  waiting_sequence: "Waiting Sequence (P2)",
  other_factor: "Other Factor (P2)",
  back_to_jetty_time: "Back to Jetty Time",
  loading_rate: "Loading Rate",
  disch_time_loading_rate: "Disch Time for Loading Rate",
  disch_time_percent: "Disch Time",
  cargo_readiness_p3: "% Cargo Readiness (P3)",
  pure_time: "Pure Time",
  waiting_cargo_readiness_p3: "Waiting Cargo Readiness (P3)",
  waiting_mv_p3: "Waiting MV (P3)",
  waiting_flf_p3: "Waiting FLF (P3)",
  waiting_queuing_p3: "Waiting Queuing (P3)",
  waiting_sequence_p3: "Waiting Sequence (P3)",
  other_factor_p3: "Other Factor (P3)",
  check_waiting_time_disch_mv: "Check Waiting Time Disch MV",
  total_ct_ltc: "Total CT LTC",
  laytime: "Laytime",
  ltc_rate: "LTC Rate",
  ltc_day: "LTC Day",
  ltc_total: "LTC Total",
};

/** Port of TLU_CYCLE_TIME_NUMBER_FIELDS (8tluoperation.php:132-166). */
export const TLU_CYCLE_TIME_NUMBER_FIELDS: readonly string[] = [
  "waiting_loading_jetty",
  "barges_arrival_early",
  "waiting_plan_loading",
  "loading_time_jetty",
  "part_1",
  "lhv_time",
  "spog_time",
  "clear_pass_time",
  "part_2",
  "mooring_2",
  "sailing_time",
  "total_waiting_disch_mv",
  "waiting_cargo_readiness",
  "waiting_mv",
  "waiting_flf",
  "waiting_queueing",
  "waiting_sequence",
  "other_factor",
  "back_to_jetty_time",
  "loading_rate",
  "disch_time_loading_rate",
  "disch_time_percent",
  "cargo_readiness_p3",
  "pure_time",
  "waiting_cargo_readiness_p3",
  "waiting_mv_p3",
  "waiting_flf_p3",
  "waiting_queuing_p3",
  "waiting_sequence_p3",
  "other_factor_p3",
  "total_ct_ltc",
  "laytime",
  "ltc_rate",
  "ltc_day",
  "ltc_total",
];

/** Port of TLU_CYCLE_TIME_YESNO_FIELDS (8tluoperation.php:168). */
export const TLU_CYCLE_TIME_YESNO_FIELDS: readonly string[] = [
  "check_total_waiting_disch_mv",
];

/** Port of TLU_CYCLE_TIME_TRUEFALSE_FIELDS (8tluoperation.php:169). */
export const TLU_CYCLE_TIME_TRUEFALSE_FIELDS: readonly string[] = [
  "check_waiting_loading_jetty",
  "check_part_1",
  "check_part_2",
  "check_waiting_time_disch_mv",
];

/** Port of TLU_CSV_COLUMNS (8tluoperation.php:199-239). Fixed header order
 * expected by import_operation_csv; note buyer/mother_vessel/jetty/tugboat/barge/
 * laycan_start/laycan_end are matching/informational only, never merged into
 * operation_data (only names also in TLU_OPERATION_FIELDS are persisted). */
export const TLU_CSV_COLUMNS: readonly string[] = [
  "si_barges",
  "no_pk",
  "buyer",
  "mother_vessel",
  "jetty",
  "tugboat",
  "barge",
  "barge_vendor",
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

/** Port of the $restrictedFloatingCranes map used by both save_operation_data
 * (8tluoperation.php:746-749) and import_operation_csv (:877). */
export const RESTRICTED_FLOATING_CRANES: Record<string, string> = {
  KTM: "STV KTM",
  MLS: "STV MAESTRO",
};

export type NumberParseResult =
  | { ok: true; value: number | null }
  | { ok: false; msg: string };

/** Port of parseOperationNumber (includes/operation_helpers.php:9-19). */
export function parseOperationNumber(raw: unknown, label: string): NumberParseResult {
  const value = String(raw ?? "").trim();
  if (value === "") return { ok: true, value: null };

  const normalized = value.replace(/[, ]/g, "");
  if (normalized === "" || Number.isNaN(Number(normalized))) {
    return { ok: false, msg: `${label} harus berupa angka.` };
  }

  return { ok: true, value: Number(normalized) };
}

/** Port of formatOperationNumber (includes/operation_helpers.php:21-23). */
export function formatOperationNumber(value: number): string {
  return value
    .toFixed(6)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

/** Port of formatOperationDisplayNumber (8tluoperation.php:242-250). Adds
 * thousands separators, then strips trailing zeros/decimal point — used only
 * by the CSV template export (buildOperationTemplateCsv). */
export function formatOperationDisplayNumber(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return "";

  const normalized = trimmed.replace(/[, ]/g, "");
  if (normalized === "" || Number.isNaN(Number(normalized))) return trimmed;

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(Number(normalized));

  return formatted.replace(/0+$/, "").replace(/\.$/, "");
}

const DISPLAY_MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Port of formatDisplayDateTime (8tluoperation.php:296-309): 'dd/Mon/yy
 * [HH:MM]' display format used only by the CSV template export
 * (buildOperationTemplateCsv). Falls back to the raw trimmed value when it
 * doesn't match any of PHP's four try-formats or isn't calendar-valid. */
export function formatDisplayDateTime(value: unknown, withTime = true): string {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return "";

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?$/
  );
  if (!match) return trimmed;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? "0");
  const minute = Number(match[5] ?? "0");
  if (!isValidCalendarDateTime(year, month, day, hour, minute)) return trimmed;

  const mon = DISPLAY_MONTH_ABBREV[month - 1];
  const datePart = `${pad2(day)}/${mon}/${String(year).slice(-2)}`;
  return withTime ? `${datePart} ${pad2(hour)}:${pad2(minute)}` : datePart;
}

const MONTH_ABBREV: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidCalendarDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): boolean {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

interface DateTimePattern {
  regex: RegExp;
  /** Extracts {year,month,day,hour,minute} from a regex match, in whichever
   * group order this pattern uses (some patterns swap day/month order). */
  extract: (m: RegExpMatchArray) => { year: number; month: number; day: number; hour: number; minute: number } | null;
}

/**
 * Port of parseOperationDateTimeValue's 13-format try-list
 * (8tluoperation.php:265-293), collapsed to 7 pattern shapes since PHP's `H`
 * (zero-padded 24h) vs `G` (non-padded) format pairs only differ on
 * single-digit-hour input with no leading zero, and output is normalized
 * regardless — using a permissive 1-2 digit hour/day/month everywhere is a
 * behavior-preserving superset. Tried in order, first calendar-valid match
 * wins — order matters for numeric-only ambiguity (d/m/Y is tried before
 * m/d/Y, matching PHP's exact try-order).
 */
const DATETIME_PATTERNS: DateTimePattern[] = [
  // !Y-m-d\TH:i
  {
    regex: /^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2})$/,
    extract: (m) => ({
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hour: Number(m[4]),
      minute: Number(m[5]),
    }),
  },
  // !Y-m-d H:i
  {
    regex: /^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{2})$/,
    extract: (m) => ({
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hour: Number(m[4]),
      minute: Number(m[5]),
    }),
  },
  // !Y-m-d H:i:s (seconds discarded from output)
  {
    regex: /^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{2}):(\d{2})$/,
    extract: (m) => ({
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hour: Number(m[4]),
      minute: Number(m[5]),
    }),
  },
  // !Y/m/d H:i, !Y/n/j H:i, !Y/m/d G:i, !Y/n/j G:i (collapsed)
  {
    regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})$/,
    extract: (m) => ({
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hour: Number(m[4]),
      minute: Number(m[5]),
    }),
  },
  // !d/m/Y H:i, !j/n/Y H:i, !d/m/Y G:i, !j/n/Y G:i (collapsed) — day/month order
  {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})$/,
    extract: (m) => ({
      year: Number(m[3]),
      month: Number(m[2]),
      day: Number(m[1]),
      hour: Number(m[4]),
      minute: Number(m[5]),
    }),
  },
  // !m/d/Y H:i — month/day order, only reached when the d/m/Y interpretation
  // above was calendar-invalid (e.g. "05/13/2025" -> month 13 invalid as d/m/Y).
  {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})$/,
    extract: (m) => ({
      year: Number(m[3]),
      month: Number(m[1]),
      day: Number(m[2]),
      hour: Number(m[4]),
      minute: Number(m[5]),
    }),
  },
  // !d/M/y H:i (e.g. "05/Jun/25 14:30")
  {
    regex: /^(\d{1,2})\/([A-Za-z]{3})\/(\d{2}) (\d{1,2}):(\d{2})$/,
    extract: (m) => {
      const month = MONTH_ABBREV[m[2].toUpperCase()];
      if (month === undefined) return null;
      return {
        year: Number(m[3]) + 2000,
        month,
        day: Number(m[1]),
        hour: Number(m[4]),
        minute: Number(m[5]),
      };
    },
  },
];

/** Port of parseOperationDateTimeValue (8tluoperation.php:265-293). Returns
 * '' for blank input, null if no format matched/calendar-invalid, else a
 * normalized 'Y-m-d H:i' string. */
export function parseOperationDateTimeValue(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (value === "") return "";

  for (const pattern of DATETIME_PATTERNS) {
    const match = value.match(pattern.regex);
    if (!match) continue;
    const parts = pattern.extract(match);
    if (!parts) continue;
    if (!isValidCalendarDateTime(parts.year, parts.month, parts.day, parts.hour, parts.minute)) {
      continue;
    }
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
  }

  return null;
}

export type DateTimeNormalizeResult =
  | { ok: true; value: string }
  | { ok: false; msg: string };

/** Port of normalizeOperationDateTime (8tluoperation.php:311-317). */
export function normalizeOperationDateTime(raw: unknown, label: string): DateTimeNormalizeResult {
  const normalized = parseOperationDateTimeValue(raw);
  if (normalized === null) {
    return { ok: false, msg: `${label} harus berisi tanggal dan waktu yang valid.` };
  }
  return { ok: true, value: normalized };
}

function trimmedField(operationData: Record<string, unknown>, field: string): string {
  return String(operationData[field] ?? "").trim();
}

/**
 * Port of operationTimelineErrors (8tluoperation.php:319-346). Pure function,
 * no I/O. Three independent chains, each only checked when both sides are
 * present (string comparison works because the normalized 'Y-m-d H:i' format
 * sorts lexicographically the same as chronologically):
 *   1. Arrival Jetty -> Start Loading -> Completed Loading, with a direct
 *      Arrival Jetty -> Completed Loading fallback only when Start Loading
 *      is blank.
 *   2. Start Mooring -> End Mooring.
 *   3. Start Disch -> Completed Disch.
 * Returns Indonesian error strings; caller joins with '. ' + trailing '.'.
 */
export function operationTimelineErrors(operationData: Record<string, unknown>): string[] {
  const arrivalJetty = trimmedField(operationData, "arrival_jetty");
  const startLoading = trimmedField(operationData, "start_loading");
  const completedLoading = trimmedField(operationData, "completed_loading");
  const startMooring = trimmedField(operationData, "start_mooring");
  const endMooring = trimmedField(operationData, "end_mooring");
  const startDisch = trimmedField(operationData, "start_disch");
  const completedDisch = trimmedField(operationData, "completed_disch");
  const errors: string[] = [];

  if (arrivalJetty !== "" && startLoading !== "" && startLoading < arrivalJetty) {
    errors.push("Start Loading harus sama dengan atau setelah Arrival Jetty");
  }
  if (startLoading !== "" && completedLoading !== "" && completedLoading < startLoading) {
    errors.push("Completed Loading harus sama dengan atau setelah Start Loading");
  }
  if (
    startLoading === "" &&
    arrivalJetty !== "" &&
    completedLoading !== "" &&
    completedLoading < arrivalJetty
  ) {
    errors.push("Completed Loading harus sama dengan atau setelah Arrival Jetty");
  }
  if (startMooring !== "" && endMooring !== "" && endMooring < startMooring) {
    errors.push("End Mooring harus sama dengan atau setelah Start Mooring");
  }
  if (startDisch !== "" && completedDisch !== "" && completedDisch < startDisch) {
    errors.push("Completed Disch harus sama dengan atau setelah Start Disch");
  }

  return errors;
}
