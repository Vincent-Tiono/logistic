import type { Pool, RowDataPacket } from "mysql2/promise";
import { addDaysYmd } from "../lib/date.js";
import type { ActionResult, FuelRates } from "./fuel.service.js";

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

// Barges MHU/Barges CAM keep independent BBS/BMC override state — `bbsBmc`
// for MHU, `bbsBmcCam` for CAM — so picking All-in/Adjust (or Ko/Fo anchors)
// on one never touches the other.
export type BbsBmcStateKey = "bbsBmc" | "bbsBmcCam";

function isBbsBmcStateKey(key: string): key is BbsBmcStateKey {
  return key === "bbsBmc" || key === "bbsBmcCam";
}

// FLF's PNTS/PSS input sections each keep their own independent Fo pick,
// derived +5%/-5% values, and Fuel %/Fixed Cost % inputs.
export type FlfSectionKey = "flfPnts" | "flfPss";

function isFlfSectionKey(key: string): key is FlfSectionKey {
  return key === "flfPnts" || key === "flfPss";
}

// ===== One save mechanism for every fuel-kurs rate field =====
//
// All 17 POST actions on /fuel-kurs (see fuelKursRoutes) reduce to the same
// shape: validate a few domain values out of the raw form body, then
// JSON_MERGE_PATCH one or more leaf fields into rates_json at a path built
// from those values. JSON_MERGE_PATCH (not JSON_SET) is required throughout
// because bbsBmc's per-column sub-objects (modes/values/adjust.<col>) are
// never pre-scaffolded — JSON_SET silently no-ops when a path segment above
// the leaf doesn't exist yet, JSON_MERGE_PATCH creates it.
//
// `saveFuelKursField` is the one write primitive; `FUEL_KURS_ACTIONS` is the
// declarative action -> validate-and-build table the route dispatches
// through. Each entry keeps the action's real per-action business rule
// (which stateKey/col/section/field values are legal) — that's the part
// that's genuinely different action to action — while the SQL and the
// dispatch mechanics live in exactly one place.

/** Bulan-Tahun/Periode pair, blanked together: periode collapses to 0 whenever bulanTahun is "". */
function bulanTahunPeriodeFields(
  prefix: string,
  bulanTahunRaw: string,
  periode: number
): Record<string, unknown> | null {
  const bulanTahun = bulanTahunRaw.trim();
  if (bulanTahun !== "" && periode !== 1 && periode !== 2) return null;
  return { [`${prefix}BulanTahun`]: bulanTahun, [`${prefix}Periode`]: bulanTahun === "" ? 0 : periode };
}

async function saveFuelKursField(
  pool: Pool,
  path: string[],
  fields: Record<string, unknown>
): Promise<ActionResult> {
  const patch = path.reduceRight<Record<string, unknown>>((node, key) => ({ [key]: node }), fields);
  await pool.query("UPDATE fuel_kurs_rates SET rates_json = JSON_MERGE_PATCH(rates_json, ?) WHERE id = 1", [
    JSON.stringify(patch),
  ]);
  return { ok: true };
}

const INVALID: ActionResult = { ok: false, error: "Invalid input" };

/** Raw POST /fuel-kurs body — every field is optional since each action only uses a subset. */
export interface FuelKursActionBody {
  field?: string;
  value?: number;
  bulanTahun?: string;
  periode?: number;
  col?: string;
  mode?: string;
  date?: string;
  stateKey?: string;
  source?: string;
  section?: string;
  groupKey?: string;
}

export type FuelKursActionHandler = (pool: Pool, body: FuelKursActionBody) => Promise<ActionResult>;

/** bbsBmc/bbsBmcCam per-column Adjust-group fields (Base Freight, Conversi Fuel, Ko*, Fo*) all share this path. */
function bbsBmcAdjustPath(stateKey: string, col: string): string[] {
  return [stateKey, "adjust", col];
}

export const FUEL_KURS_ACTIONS: Record<string, FuelKursActionHandler> = {
  // Flat rate fields (mhu.*/cam.*/rf.fuelValue/rf.forexValue): field is a
  // dotted path, e.g. "mhu.lt60.usdMt" — split it into path + leaf key.
  save_rate: async (pool, body) => {
    const field = body.field ?? "";
    if (!isFuelKursRateField(field)) return INVALID;
    const segments = field.split(".");
    const leafKey = segments.pop() as string;
    return saveFuelKursField(pool, segments, { [leafKey]: body.value });
  },

  // ===== ici_lt60/ici_gt60 shared RF/Tolerance parameters (bbsBmc(Cam).rf) =====
  save_bbsbmc_rf_field: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const field = body.field ?? "";
    if (!isBbsBmcStateKey(stateKey) || !RF_NUMERIC_FIELDS.has(field as RfNumericField)) return INVALID;
    return saveFuelKursField(pool, [stateKey, "rf"], { [field]: body.value });
  },
  save_bbsbmc_rf_tolerance_base: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    if (!isBbsBmcStateKey(stateKey)) return INVALID;
    const fields = bulanTahunPeriodeFields("toleranceBase", body.bulanTahun ?? "", body.periode ?? 0);
    if (!fields) return INVALID;
    return saveFuelKursField(pool, [stateKey, "rf"], fields);
  },

  // rf.fuelValueBulanTahun/rf.fuelValuePeriode — not stateKey-scoped, one shared pick.
  save_fuel_value_base: async (pool, body) => {
    const fields = bulanTahunPeriodeFields("fuelValue", body.bulanTahun ?? "", body.periode ?? 0);
    if (!fields) return INVALID;
    return saveFuelKursField(pool, ["rf"], fields);
  },

  // ===== Barges MHU/CAM: BBS/BMC per-column "All-in vs Adjust" overrides =====
  save_bbsbmc_mode: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const col = body.col ?? "";
    const mode = body.mode ?? "";
    if (!isBbsBmcStateKey(stateKey) || !BBS_BMC_COLUMNS.has(col) || (mode !== "allin" && mode !== "adjust")) {
      return INVALID;
    }
    return saveFuelKursField(pool, [stateKey, "modes"], { [col]: mode });
  },
  save_bbsbmc_value: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const col = body.col ?? "";
    if (!isBbsBmcStateKey(stateKey) || !BBS_BMC_COLUMNS.has(col)) return INVALID;
    return saveFuelKursField(pool, [stateKey, "values"], { [col]: body.value });
  },
  // Base Freight/Conversi Fuel/Ko*/Fo*: the "Adjust" formula group's inputs,
  // all stored under bbsBmc(Cam).adjust.<col> — see bbsBmcAdjustPath.
  save_bbsbmc_adjust_base_freight: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const col = body.col ?? "";
    if (!isBbsBmcStateKey(stateKey) || !BBS_BMC_COLUMNS.has(col)) return INVALID;
    return saveFuelKursField(pool, bbsBmcAdjustPath(stateKey, col), { baseFreight: body.value });
  },
  save_bbsbmc_adjust_conversi_fuel: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const col = body.col ?? "";
    if (!isBbsBmcStateKey(stateKey) || !BBS_BMC_COLUMNS.has(col)) return INVALID;
    return saveFuelKursField(pool, bbsBmcAdjustPath(stateKey, col), { conversiFuel: body.value });
  },
  save_bbsbmc_adjust_ko: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const col = body.col ?? "";
    if (!isBbsBmcStateKey(stateKey) || !BBS_BMC_COLUMNS.has(col)) return INVALID;
    return saveFuelKursField(pool, bbsBmcAdjustPath(stateKey, col), { koDate: body.date ?? "" });
  },
  save_bbsbmc_adjust_ko_source: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const col = body.col ?? "";
    const source = body.source ?? "";
    if (
      !isBbsBmcStateKey(stateKey) ||
      !BBS_BMC_COLUMNS.has(col) ||
      (source !== "kurs" && source !== "jisdor" && source !== "manual")
    ) {
      return INVALID;
    }
    return saveFuelKursField(pool, bbsBmcAdjustPath(stateKey, col), { koSource: source });
  },
  save_bbsbmc_adjust_ko_manual: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const col = body.col ?? "";
    if (!isBbsBmcStateKey(stateKey) || !BBS_BMC_COLUMNS.has(col)) return INVALID;
    return saveFuelKursField(pool, bbsBmcAdjustPath(stateKey, col), { ko: body.value });
  },
  save_bbsbmc_adjust_fo_manual: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const col = body.col ?? "";
    if (!isBbsBmcStateKey(stateKey) || !BBS_BMC_COLUMNS.has(col)) return INVALID;
    return saveFuelKursField(pool, bbsBmcAdjustPath(stateKey, col), { fo: body.value });
  },
  save_bbsbmc_adjust_fo_source: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const col = body.col ?? "";
    const source = body.source ?? "";
    if (
      !isBbsBmcStateKey(stateKey) ||
      !BBS_BMC_COLUMNS.has(col) ||
      (source !== "pertamina" && source !== "total" && source !== "manual")
    ) {
      return INVALID;
    }
    return saveFuelKursField(pool, bbsBmcAdjustPath(stateKey, col), { foSource: source });
  },
  save_bbsbmc_adjust_fo: async (pool, body) => {
    const stateKey = body.stateKey ?? "";
    const col = body.col ?? "";
    if (!isBbsBmcStateKey(stateKey) || !BBS_BMC_COLUMNS.has(col)) return INVALID;
    const fields = bulanTahunPeriodeFields("fo", body.bulanTahun ?? "", body.periode ?? 0);
    if (!fields) return INVALID;
    return saveFuelKursField(pool, bbsBmcAdjustPath(stateKey, col), fields);
  },

  // ===== FLF: PNTS/PSS input section — Fo pick + auto Fo +5%/-5% =====
  save_flf_tolerance_field: async (pool, body) => {
    const section = body.section ?? "";
    const field = body.field ?? "";
    if (!isFlfSectionKey(section) || !FLF_TOLERANCE_NUMERIC_FIELDS.has(field as FlfToleranceNumericField)) {
      return INVALID;
    }
    return saveFuelKursField(pool, [section], { [field]: body.value });
  },
  save_flf_fo_base: async (pool, body) => {
    const section = body.section ?? "";
    if (!isFlfSectionKey(section)) return INVALID;
    const fields = bulanTahunPeriodeFields("fo", body.bulanTahun ?? "", body.periode ?? 0);
    if (!fields) return INVALID;
    return saveFuelKursField(pool, [section], fields);
  },
  // Fr: user-typed decimal per region-group, Single + Blending each — no derived calc, straight input.
  save_flf_fr: async (pool, body) => {
    const section = body.section ?? "";
    const groupKey = body.groupKey ?? "";
    const field = body.field ?? "";
    if (!isFlfSectionKey(section) || !FLF_GROUP_KEYS.has(groupKey) || (field !== "single" && field !== "blending")) {
      return INVALID;
    }
    return saveFuelKursField(pool, [section, "fr", groupKey], { [field]: body.value });
  },
};

// ===== Barges MHU daily engine: Section 2 lookup table + anchor config =====

/**
 * total = pertamina + ppn + pbbkb + pph22, per Section 2 of the spec.
 * `rates` is the month's *effective* PPN/PBBKB/PPH22 — resolve it with
 * fuel.service.ts's computeEffectiveRates(getFuelRatesByMonth(pool), ...)
 * rather than a fixed constant, so a rate override saved on the Fuel page
 * carries forward into this table too (ppnRate/pbbkbRate/pph22Rate are
 * whole-number percentages, e.g. 11 = 11%).
 */
export function fuelTaxTotal(pertamina: number, rates: FuelRates): number {
  return pertamina * (1 + rates.ppnRate / 100 + rates.pbbkbRate / 100 + rates.pph22Rate / 100);
}

/** pertamina + pbbkb + pph22, excluding ppn — FLF's PSS Fo formula. Same `rates` contract as fuelTaxTotal. */
export function fuelTaxPertaminaPbbkbPph22(pertamina: number, rates: FuelRates): number {
  return pertamina * (1 + rates.pbbkbRate / 100 + rates.pph22Rate / 100);
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
