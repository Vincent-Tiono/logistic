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
}

/** Per-column BBS/BMC "All-in vs Adjust" picks on the Barges MHU submodule. */
export interface BbsBmcAdjustEntry {
  baseFreight?: number;
  conversiFuel?: number;
  koDate?: string;
  foBulanTahun?: string;
  foPeriode?: number;
}
export interface BbsBmcOverrideState {
  modes: Record<string, "allin" | "adjust">;
  values: Record<string, number>;
  adjust: Record<string, BbsBmcAdjustEntry>;
}

export const BBS_BMC_COLUMNS = new Set([
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
  bbsBmc: { modes: {}, values: {}, adjust: {} },
  bbsBmcCam: { modes: {}, values: {}, adjust: {} },
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
  "rf.fuelPct",
  "rf.fuelValue",
  "rf.forexValue",
  "rf.fixedCostPct",
  "tolerance.plus10",
  "tolerance.minus10",
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
  const merged: FuelKursRates = {
    ...stored,
    rf: { ...DEFAULT_FUEL_KURS_RATES.rf, ...stored.rf },
    tolerance: { ...DEFAULT_FUEL_KURS_RATES.tolerance, ...stored.tolerance },
    bbsBmc: {
      modes: { ...stored.bbsBmc?.modes },
      values: { ...stored.bbsBmc?.values },
      adjust: { ...stored.bbsBmc?.adjust },
    },
    bbsBmcCam: {
      modes: { ...stored.bbsBmcCam?.modes },
      values: { ...stored.bbsBmcCam?.values },
      adjust: { ...stored.bbsBmcCam?.adjust },
    },
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

export function saveFuelKursToleranceBase(
  pool: Pool,
  input: SaveFuelKursBaseInput
): Promise<ActionResult> {
  return saveFuelKursBase(pool, "$.tolerance.baseBulanTahun", "$.tolerance.basePeriode", input);
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

export interface FuelPeriodCell {
  pertamina: number;
  total: number;
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
