import type { Pool, RowDataPacket } from "mysql2/promise";
import { addDaysYmd } from "../lib/date.js";
import type { ActionResult } from "./fuel.service.js";

export interface FreightTier {
  usdMt: number;
  flf: number;
  stv: number;
}

export interface FuelKursRates {
  mhu: { lt60: FreightTier; t60to65: FreightTier; gt65: FreightTier };
  rf: {
    fuelPct: number;
    fuelValue: number;
    fuelValueBulanTahun: string;
    fuelValuePeriode: number;
    forexValue: number;
    fixedCostPct: number;
  };
  tolerance: { plus10: number; minus10: number; baseBulanTahun: string; basePeriode: number };
  cam: { lt60: FreightTier; t60to65: FreightTier; gt65: FreightTier };
  bbsBmc: BbsBmcOverrideState;
  /** Barges CAM's own All-in/Adjust picks — independent of Barges MHU's `bbsBmc`. */
  bbsBmcCam: BbsBmcOverrideState;
  /** FLF submodule's PNTS input section: Fo pick + auto Fo +5%/-5%. */
  flfPnts: FlfToleranceEntry;
  /** FLF submodule's PSS input section — independent of flfPnts. */
  flfPss: FlfToleranceEntry;
}

/** Per-column BBS/BMC "All-in vs Adjust" picks on the Barges MHU submodule. */
export interface BbsBmcAdjustEntry {
  baseFreight?: number;
  conversiFuel?: number;
  koDate?: string;
  /** Which series Ko's date value is read from. Default (unset) is "kurs"; "manual" reads `ko` directly instead of looking up koDate. */
  koSource?: "kurs" | "jisdor" | "manual";
  /** The typed-in Ko value when koSource is "manual". */
  ko?: number;
  foBulanTahun?: string;
  foPeriode?: number;
  /** Which Fuel-module column Fo's value is read from. Default (unset) is "total"; "manual" reads `fo` directly instead of looking up foBulanTahun/foPeriode. */
  foSource?: "pertamina" | "total" | "manual";
  /** The typed-in Fo value when foSource is "manual". */
  fo?: number;
}
/** RF/Tolerance parameters shared by the ici_lt60/ici_gt60 Adjust-mode cells. */
export interface RfToleranceEntry {
  fuelPct: number;
  fixedCostPct: number;
  tolerancePlus10: number;
  toleranceMinus10: number;
  toleranceBaseBulanTahun: string;
  toleranceBasePeriode: number;
}
export interface BbsBmcOverrideState {
  modes: Record<string, "allin" | "adjust">;
  values: Record<string, number>;
  adjust: Record<string, BbsBmcAdjustEntry>;
  /** Shared by both ici_lt60 and ici_gt60 — one RF value per submodule. */
  rf: RfToleranceEntry;
}

/** FLF PNTS/PSS input section: pick a Bulan-Tahun/Periode off fuel.pertamina for Fo, auto-derives Fo +5%/-5%. */
export interface FlfToleranceEntry {
  tolerancePlus5: number;
  toleranceMinus5: number;
  /** Fo: Bulan-Tahun/Periode pick off fuel.pertamina; also the base for tolerancePlus5/toleranceMinus5. */
  foBulanTahun: string;
  foPeriode: number;
  /** Fuel %/Fixed Cost %: user-typed, independent per PNTS/PSS section — not wired into a formula yet. */
  fuelPct: number;
  fixedCostPct: number;
  /** Fr: user-typed decimal per region-group (keyed by FLF_GROUP key), Single + Blending each. */
  fr: Record<string, FlfFrEntry>;
}

export interface FlfFrEntry {
  single: number;
  blending: number;
}

/** FLF's 7 PNTS/PSS region-groups — stable keys for Fr storage, independent of the display label text. */
export const FLF_GROUP_KEYS = new Set([
  "pnts_le49",
  "pnts_50_74",
  "pnts_ge75",
  "pss_lt100",
  "pss_100_120",
  "pss_120_140",
  "pss_gt140",
]);

export const BBS_BMC_COLUMNS = new Set([
  "ici_lt60",
  "ici_gt60",
  "berau",
  "pdp",
  "bdd",
  "dls",
  "gls",
  "gms",
  "tml",
  "ksu",
  "tms",
  "ayu",
  "cnb",
  "ppsj",
]);

const EMPTY_TIER: FreightTier = { usdMt: 0, flf: 0, stv: 0 };

export type RfNumericField = "fuelPct" | "fixedCostPct" | "tolerancePlus10" | "toleranceMinus10";
const RF_NUMERIC_FIELDS = new Set<RfNumericField>([
  "fuelPct",
  "fixedCostPct",
  "tolerancePlus10",
  "toleranceMinus10",
]);

const DEFAULT_RF_ENTRY: RfToleranceEntry = {
  fuelPct: 0,
  fixedCostPct: 0,
  tolerancePlus10: 0,
  toleranceMinus10: 0,
  toleranceBaseBulanTahun: "",
  toleranceBasePeriode: 0,
};

export type FlfToleranceNumericField =
  | "tolerancePlus5"
  | "toleranceMinus5"
  | "fuelPct"
  | "fixedCostPct";
const FLF_TOLERANCE_NUMERIC_FIELDS = new Set<FlfToleranceNumericField>([
  "tolerancePlus5",
  "toleranceMinus5",
  "fuelPct",
  "fixedCostPct",
]);

const DEFAULT_FLF_TOLERANCE_ENTRY: FlfToleranceEntry = {
  tolerancePlus5: 0,
  toleranceMinus5: 0,
  foBulanTahun: "",
  foPeriode: 0,
  fuelPct: 0,
  fixedCostPct: 0,
  fr: {},
};

export const DEFAULT_FUEL_KURS_RATES: FuelKursRates = {
  mhu: { lt60: { ...EMPTY_TIER }, t60to65: { ...EMPTY_TIER }, gt65: { ...EMPTY_TIER } },
  rf: {
    fuelPct: 0,
    fuelValue: 0,
    fuelValueBulanTahun: "",
    fuelValuePeriode: 0,
    forexValue: 0,
    fixedCostPct: 0,
  },
  tolerance: { plus10: 0, minus10: 0, baseBulanTahun: "", basePeriode: 0 },
  cam: { lt60: { ...EMPTY_TIER }, t60to65: { ...EMPTY_TIER }, gt65: { ...EMPTY_TIER } },
  bbsBmc: { modes: {}, values: {}, adjust: {}, rf: { ...DEFAULT_RF_ENTRY } },
  bbsBmcCam: { modes: {}, values: {}, adjust: {}, rf: { ...DEFAULT_RF_ENTRY } },
  flfPnts: { ...DEFAULT_FLF_TOLERANCE_ENTRY },
  flfPss: { ...DEFAULT_FLF_TOLERANCE_ENTRY },
};

export const FUEL_KURS_RATE_FIELDS = [
  "mhu.lt60.usdMt",
  "mhu.lt60.flf",
  "mhu.lt60.stv",
  "mhu.t60to65.usdMt",
  "mhu.t60to65.flf",
  "mhu.t60to65.stv",
  "mhu.gt65.usdMt",
  "mhu.gt65.flf",
  "mhu.gt65.stv",
  "rf.fuelValue",
  "rf.forexValue",
  "cam.lt60.usdMt",
  "cam.lt60.flf",
  "cam.lt60.stv",
  "cam.t60to65.usdMt",
  "cam.t60to65.flf",
  "cam.t60to65.stv",
  "cam.gt65.usdMt",
  "cam.gt65.flf",
  "cam.gt65.stv",
] as const;
export type FuelKursRateField = (typeof FUEL_KURS_RATE_FIELDS)[number];

function isFuelKursRateField(field: string): field is FuelKursRateField {
  return (FUEL_KURS_RATE_FIELDS as readonly string[]).includes(field);
}

export async function getFuelKursRates(pool: Pool): Promise<FuelKursRates> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT rates_json FROM fuel_kurs_rates WHERE id = 1"
  );
  const row = rows[0];
  if (!row) return DEFAULT_FUEL_KURS_RATES;
  const stored: FuelKursRates =
    typeof row.rates_json === "string" ? JSON.parse(row.rates_json) : row.rates_json;

  // Rows saved before the base pickers / bbsBmc overrides existed lack these fields.
  const legacyRf = { ...DEFAULT_FUEL_KURS_RATES.rf, ...stored.rf };
  const legacyTolerance = { ...DEFAULT_FUEL_KURS_RATES.tolerance, ...stored.tolerance };
  // ici_lt60/ici_gt60 used to share one global RF/Tolerance; seed a fresh
  // entry from that shared value the first time it's missing, so a
  // pre-existing setup keeps computing the same result until edited.
  const legacyRfEntry: RfToleranceEntry = {
    fuelPct: legacyRf.fuelPct,
    fixedCostPct: legacyRf.fixedCostPct,
    tolerancePlus10: legacyTolerance.plus10,
    toleranceMinus10: legacyTolerance.minus10,
    toleranceBaseBulanTahun: legacyTolerance.baseBulanTahun,
    toleranceBasePeriode: legacyTolerance.basePeriode,
  };
  function mergeBbsBmcState(state: BbsBmcOverrideState | undefined): BbsBmcOverrideState {
    const storedRf = state?.rf as (RfToleranceEntry & Record<string, unknown>) | undefined;
    // ici_lt60/ici_gt60 briefly kept independent RF/Tolerance entries
    // (rf.ici_lt60 / rf.ici_gt60) before collapsing back to one shared
    // entry — migrate an old per-column row onto the ici_lt60 value.
    const legacyPerColumn = storedRf?.ici_lt60 as RfToleranceEntry | undefined;
    const rf: RfToleranceEntry = {
      ...legacyRfEntry,
      ...(legacyPerColumn ?? storedRf),
    };
    return {
      modes: { ...state?.modes },
      values: { ...state?.values },
      adjust: { ...state?.adjust },
      rf,
    };
  }

  const merged: FuelKursRates = {
    ...stored,
    rf: legacyRf,
    tolerance: legacyTolerance,
    bbsBmc: mergeBbsBmcState(stored.bbsBmc),
    bbsBmcCam: mergeBbsBmcState(stored.bbsBmcCam),
    flfPnts: { ...DEFAULT_FLF_TOLERANCE_ENTRY, ...stored.flfPnts },
    flfPss: { ...DEFAULT_FLF_TOLERANCE_ENTRY, ...stored.flfPss },
  };

  // Persist any backfilled fields immediately: JSON_SET no-ops silently when
  // its path's parent object is missing (e.g. $.bbsBmc.modes.x when $.bbsBmc
  // itself is absent), so a stale row would otherwise swallow every write to
  // a newly-added field forever. Writing the merged shape back once fixes
  // that for all future saves.
  if (JSON.stringify(stored) !== JSON.stringify(merged)) {
    await pool.query("UPDATE fuel_kurs_rates SET rates_json = ? WHERE id = 1", [
      JSON.stringify(merged),
    ]);
  }

  return merged;
}

export interface SaveFuelKursRateInput {
  field: string;
  value: number;
}

export async function saveFuelKursRate(
  pool: Pool,
  input: SaveFuelKursRateInput
): Promise<ActionResult> {
  if (!isFuelKursRateField(input.field)) {
    return { ok: false, error: "Invalid input" };
  }

  await pool.query(
    "UPDATE fuel_kurs_rates SET rates_json = JSON_SET(rates_json, ?, ?) WHERE id = 1",
    [`$.${input.field}`, input.value]
  );
  return { ok: true };
}

export interface SaveFuelKursBaseInput {
  bulanTahun: string;
  periode: number;
}

async function saveFuelKursBase(
  pool: Pool,
  bulanTahunPath: string,
  periodePath: string,
  input: SaveFuelKursBaseInput
): Promise<ActionResult> {
  const bulanTahun = input.bulanTahun.trim();
  if (bulanTahun !== "" && input.periode !== 1 && input.periode !== 2) {
    return { ok: false, error: "Invalid input" };
  }

  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_SET(rates_json, ?, ?, ?, ?)
     WHERE id = 1`,
    [bulanTahunPath, bulanTahun, periodePath, bulanTahun === "" ? 0 : input.periode]
  );
  return { ok: true };
}

export function saveFuelKursFuelValueBase(
  pool: Pool,
  input: SaveFuelKursBaseInput
): Promise<ActionResult> {
  return saveFuelKursBase(pool, "$.rf.fuelValueBulanTahun", "$.rf.fuelValuePeriode", input);
}

// ===== Barges MHU / Barges CAM: BBS/BMC "All-in vs Adjust" per-column overrides =====
//
// Both submodules share the same column set and formula shape but keep
// independent state — `bbsBmc` for Barges MHU, `bbsBmcCam` for Barges CAM —
// so picking All-in/Adjust (or Ko/Fo anchors) on one never touches the other.

export type BbsBmcStateKey = "bbsBmc" | "bbsBmcCam";

function isBbsBmcStateKey(key: string): key is BbsBmcStateKey {
  return key === "bbsBmc" || key === "bbsBmcCam";
}

export interface SaveBbsBmcModeInput {
  stateKey: string;
  col: string;
  mode: string;
}

// JSON_SET requires every path segment above the leaf to already exist, and
// bbsBmc's per-column sub-objects (modes/values/adjust.<col>) are never
// pre-scaffolded, so a plain JSON_SET silently no-ops on a column's first
// write. JSON_MERGE_PATCH creates missing nested objects along the way, so
// every bbsBmc.* save below uses it instead.
export async function saveBbsBmcMode(
  pool: Pool,
  input: SaveBbsBmcModeInput
): Promise<ActionResult> {
  if (
    !isBbsBmcStateKey(input.stateKey) ||
    !BBS_BMC_COLUMNS.has(input.col) ||
    (input.mode !== "allin" && input.mode !== "adjust")
  ) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('modes', JSON_OBJECT(?, ?))))
     WHERE id = 1`,
    [input.stateKey, input.col, input.mode]
  );
  return { ok: true };
}

export interface SaveBbsBmcValueInput {
  stateKey: string;
  col: string;
  value: number;
}

export async function saveBbsBmcValue(
  pool: Pool,
  input: SaveBbsBmcValueInput
): Promise<ActionResult> {
  if (!isBbsBmcStateKey(input.stateKey) || !BBS_BMC_COLUMNS.has(input.col)) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('values', JSON_OBJECT(?, ?))))
     WHERE id = 1`,
    [input.stateKey, input.col, input.value]
  );
  return { ok: true };
}

export interface SaveBbsBmcAdjustFieldInput {
  stateKey: string;
  col: string;
  value: number;
}

/** Base Freight: the flat freight-rate input in the "Adjust" formula group. */
export async function saveBbsBmcAdjustBaseFreight(
  pool: Pool,
  input: SaveBbsBmcAdjustFieldInput
): Promise<ActionResult> {
  if (!isBbsBmcStateKey(input.stateKey) || !BBS_BMC_COLUMNS.has(input.col)) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('adjust', JSON_OBJECT(?, JSON_OBJECT('baseFreight', ?)))))
     WHERE id = 1`,
    [input.stateKey, input.col, input.value]
  );
  return { ok: true };
}

/** Conversi Fuel: the fuel-conversion input in the "Adjust" formula group. */
export async function saveBbsBmcAdjustConversiFuel(
  pool: Pool,
  input: SaveBbsBmcAdjustFieldInput
): Promise<ActionResult> {
  if (!isBbsBmcStateKey(input.stateKey) || !BBS_BMC_COLUMNS.has(input.col)) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('adjust', JSON_OBJECT(?, JSON_OBJECT('conversiFuel', ?)))))
     WHERE id = 1`,
    [input.stateKey, input.col, input.value]
  );
  return { ok: true };
}

export interface SaveBbsBmcAdjustKoInput {
  stateKey: string;
  col: string;
  date: string;
}

/** Ko: the date the user picked out of the Kurs Tengah table. */
export async function saveBbsBmcAdjustKo(
  pool: Pool,
  input: SaveBbsBmcAdjustKoInput
): Promise<ActionResult> {
  if (!isBbsBmcStateKey(input.stateKey) || !BBS_BMC_COLUMNS.has(input.col)) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('adjust', JSON_OBJECT(?, JSON_OBJECT('koDate', ?)))))
     WHERE id = 1`,
    [input.stateKey, input.col, input.date]
  );
  return { ok: true };
}

export interface SaveBbsBmcAdjustKoSourceInput {
  stateKey: string;
  col: string;
  source: string;
}

/** Ko Sumber: which series (Kurs Tengah, Jisdor, or a typed-in Manual value) the Ko value is read from. */
export async function saveBbsBmcAdjustKoSource(
  pool: Pool,
  input: SaveBbsBmcAdjustKoSourceInput
): Promise<ActionResult> {
  if (
    !isBbsBmcStateKey(input.stateKey) ||
    !BBS_BMC_COLUMNS.has(input.col) ||
    (input.source !== "kurs" && input.source !== "jisdor" && input.source !== "manual")
  ) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('adjust', JSON_OBJECT(?, JSON_OBJECT('koSource', ?)))))
     WHERE id = 1`,
    [input.stateKey, input.col, input.source]
  );
  return { ok: true };
}

export interface SaveBbsBmcAdjustKoManualInput {
  stateKey: string;
  col: string;
  value: number;
}

/** Ko manual entry: user types the anchor value directly instead of picking a date. */
export async function saveBbsBmcAdjustKoManual(
  pool: Pool,
  input: SaveBbsBmcAdjustKoManualInput
): Promise<ActionResult> {
  if (!isBbsBmcStateKey(input.stateKey) || !BBS_BMC_COLUMNS.has(input.col)) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('adjust', JSON_OBJECT(?, JSON_OBJECT('ko', ?)))))
     WHERE id = 1`,
    [input.stateKey, input.col, input.value]
  );
  return { ok: true };
}

export interface SaveBbsBmcAdjustFoInput {
  stateKey: string;
  col: string;
  bulanTahun: string;
  periode: number;
}

/** Fo: the Bulan-Tahun/Periode the user picked out of the Fuel page's Total column. */
export async function saveBbsBmcAdjustFo(
  pool: Pool,
  input: SaveBbsBmcAdjustFoInput
): Promise<ActionResult> {
  if (!isBbsBmcStateKey(input.stateKey) || !BBS_BMC_COLUMNS.has(input.col)) {
    return { ok: false, error: "Invalid input" };
  }
  const bulanTahun = input.bulanTahun.trim();
  if (bulanTahun !== "" && input.periode !== 1 && input.periode !== 2) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('adjust', JSON_OBJECT(?, JSON_OBJECT('foBulanTahun', ?, 'foPeriode', ?)))))
     WHERE id = 1`,
    [input.stateKey, input.col, bulanTahun, bulanTahun === "" ? 0 : input.periode]
  );
  return { ok: true };
}

export interface SaveBbsBmcAdjustFoManualInput {
  stateKey: string;
  col: string;
  value: number;
}

/** Fo manual entry: user types the anchor value directly instead of picking a period. */
export async function saveBbsBmcAdjustFoManual(
  pool: Pool,
  input: SaveBbsBmcAdjustFoManualInput
): Promise<ActionResult> {
  if (!isBbsBmcStateKey(input.stateKey) || !BBS_BMC_COLUMNS.has(input.col)) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('adjust', JSON_OBJECT(?, JSON_OBJECT('fo', ?)))))
     WHERE id = 1`,
    [input.stateKey, input.col, input.value]
  );
  return { ok: true };
}

export interface SaveBbsBmcAdjustFoSourceInput {
  stateKey: string;
  col: string;
  source: string;
}

/** Fo Sumber: which Fuel-module column (Pertamina, Total, or a typed-in Manual value) the Fo value is read from. */
export async function saveBbsBmcAdjustFoSource(
  pool: Pool,
  input: SaveBbsBmcAdjustFoSourceInput
): Promise<ActionResult> {
  if (
    !isBbsBmcStateKey(input.stateKey) ||
    !BBS_BMC_COLUMNS.has(input.col) ||
    (input.source !== "pertamina" && input.source !== "total" && input.source !== "manual")
  ) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('adjust', JSON_OBJECT(?, JSON_OBJECT('foSource', ?)))))
     WHERE id = 1`,
    [input.stateKey, input.col, input.source]
  );
  return { ok: true };
}

// ===== ici_lt60 / ici_gt60: shared RF/Tolerance parameters =====
//
// Fuel%, Fixed Cost%, Tolerance +10%/-10%, and Tolerance Base are one value
// per submodule, shared by both Adjust-mode ICI cells (<60 and >60), stored
// under bbsBmc(Cam).rf.

export interface SaveBbsBmcRfFieldInput {
  stateKey: string;
  field: string;
  value: number;
}

export async function saveBbsBmcRfField(
  pool: Pool,
  input: SaveBbsBmcRfFieldInput
): Promise<ActionResult> {
  if (
    !isBbsBmcStateKey(input.stateKey) ||
    !RF_NUMERIC_FIELDS.has(input.field as RfNumericField)
  ) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('rf', JSON_OBJECT(?, ?))))
     WHERE id = 1`,
    [input.stateKey, input.field, input.value]
  );
  return { ok: true };
}

export interface SaveBbsBmcRfToleranceBaseInput {
  stateKey: string;
  bulanTahun: string;
  periode: number;
}

export async function saveBbsBmcRfToleranceBase(
  pool: Pool,
  input: SaveBbsBmcRfToleranceBaseInput
): Promise<ActionResult> {
  if (!isBbsBmcStateKey(input.stateKey)) {
    return { ok: false, error: "Invalid input" };
  }
  const bulanTahun = input.bulanTahun.trim();
  if (bulanTahun !== "" && input.periode !== 1 && input.periode !== 2) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('rf', JSON_OBJECT('toleranceBaseBulanTahun', ?, 'toleranceBasePeriode', ?))))
     WHERE id = 1`,
    [input.stateKey, bulanTahun, bulanTahun === "" ? 0 : input.periode]
  );
  return { ok: true };
}

// ===== FLF: PNTS/PSS input section — Fo pick + auto Fo +5%/-5% =====
//
// Each of the two subsections keeps its own independent Fo pick, derived
// +5%/-5% values, and Fuel %/Fixed Cost % inputs, stored under flfPnts/flfPss
// at the rates root (same shape as bbsBmc(Cam).rf).

export type FlfSectionKey = "flfPnts" | "flfPss";

function isFlfSectionKey(key: string): key is FlfSectionKey {
  return key === "flfPnts" || key === "flfPss";
}

export interface SaveFlfToleranceFieldInput {
  section: string;
  field: string;
  value: number;
}

export async function saveFlfToleranceField(
  pool: Pool,
  input: SaveFlfToleranceFieldInput
): Promise<ActionResult> {
  if (
    !isFlfSectionKey(input.section) ||
    !FLF_TOLERANCE_NUMERIC_FIELDS.has(input.field as FlfToleranceNumericField)
  ) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT(?, ?)))
     WHERE id = 1`,
    [input.section, input.field, input.value]
  );
  return { ok: true };
}

export interface SaveFlfFoBaseInput {
  section: string;
  bulanTahun: string;
  periode: number;
}

/** Fo: Bulan-Tahun/Periode pick off fuel.pertamina — also drives auto-derived tolerancePlus5/toleranceMinus5. */
export async function saveFlfFoBase(
  pool: Pool,
  input: SaveFlfFoBaseInput
): Promise<ActionResult> {
  if (!isFlfSectionKey(input.section)) {
    return { ok: false, error: "Invalid input" };
  }
  const bulanTahun = input.bulanTahun.trim();
  if (bulanTahun !== "" && input.periode !== 1 && input.periode !== 2) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('foBulanTahun', ?, 'foPeriode', ?)))
     WHERE id = 1`,
    [input.section, bulanTahun, bulanTahun === "" ? 0 : input.periode]
  );
  return { ok: true };
}

export type FlfFrField = "single" | "blending";

export interface SaveFlfFrInput {
  section: string;
  groupKey: string;
  field: string;
  value: number;
}

/** Fr: user-typed decimal per region-group, Single + Blending each — no derived calc, straight input. */
export async function saveFlfFr(pool: Pool, input: SaveFlfFrInput): Promise<ActionResult> {
  if (
    !isFlfSectionKey(input.section) ||
    !FLF_GROUP_KEYS.has(input.groupKey) ||
    (input.field !== "single" && input.field !== "blending")
  ) {
    return { ok: false, error: "Invalid input" };
  }
  await pool.query(
    `UPDATE fuel_kurs_rates
     SET rates_json = JSON_MERGE_PATCH(rates_json, JSON_OBJECT(?, JSON_OBJECT('fr', JSON_OBJECT(?, JSON_OBJECT(?, ?)))))
     WHERE id = 1`,
    [input.section, input.groupKey, input.field, input.value]
  );
  return { ok: true };
}

// ===== Barges MHU daily engine: Section 2 lookup table + anchor config =====

/** Fixed Section 2 tax rates on top of pertamina_price (PPN/PBBKB/PPH22). */
export const FUEL_TAX_RATES = { ppn: 0.11, pbbkb: 0.075, pph22: 0.003 };

/** total = pertamina + ppn + pbbkb + pph22, per Section 2 of the spec. */
export function fuelTaxTotal(pertamina: number): number {
  return (
    pertamina *
    (1 + FUEL_TAX_RATES.ppn + FUEL_TAX_RATES.pbbkb + FUEL_TAX_RATES.pph22)
  );
}

/** pertamina + pbbkb + pph22, excluding ppn — FLF's PSS Fo formula. */
export function fuelTaxPertaminaPbbkbPph22(pertamina: number): number {
  return pertamina * (1 + FUEL_TAX_RATES.pbbkb + FUEL_TAX_RATES.pph22);
}

export interface FuelPeriodCell {
  pertamina: number;
  total: number;
  /** pertamina + pbbkb + pph22 (no ppn) — FLF's PSS Fo formula. */
  pertaminaPbbkbPph22: number;
}
export type FuelPeriodTable = Record<string, Record<number, FuelPeriodCell>>;

/** base_fuel_price / RF & BBS-BMC / BDD anchor period: Period 1 Jan-26 (source sheet's anchor row). */
export const BARGES_MHU_BASE_BULAN_TAHUN = "Jan-26";
export const BARGES_MHU_BASE_PERIODE = 1;
export const BARGES_MHU_BASE_ANCHOR_DATE = "2026-01-01";
/** base_jisdor: fixed historical Jisdor snapshot used as the RF ratio anchor (source ~17,002). */
export const BARGES_MHU_BASE_JISDOR = 17002;

/** Densifies a sparse (BI-supplied, business-days-only) date->value map by carrying the last known value forward across every day in [startDate, endDate]. */
export function buildDenseDateSeries(
  rawByDate: Map<string, number>,
  startDate: string,
  endDate: string
): Record<string, number> {
  const out: Record<string, number> = {};
  let last: number | undefined;
  let d: string | null = startDate;
  while (d !== null && d <= endDate) {
    const raw = rawByDate.get(d);
    if (raw !== undefined) last = raw;
    if (last !== undefined) out[d] = last;
    d = addDaysYmd(d, 1);
  }
  return out;
}
