// Barges MHU/CAM + FLF daily-engine formulas for the Fuel & Kurs page
// (views/fuel-kurs.ejs). Extracted from the page's inline <script> so the
// pure calc logic can be unit tested with Node's built-in/vitest runner and
// reasoned about independently of the DOM-wiring code that consumes it
// (makeBargesEngine/makeFlfEngine's computeRow, bbsBmcCell).
//
// Per docs/adr/0001-tlu-grouped-export-computes-client-side.md's precedent,
// this stays a single client-side implementation rather than growing a
// parallel server-side (TS) copy of the same formulas.

export const BULAN_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function roundTo(n, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

// Period Fn: 1st-14th = Period 1, 15th-end = Period 2 of the calendar month.
export function periodFn(y, m0, d) {
  const periode = d <= 14 ? 1 : 2;
  const mmm = BULAN_NAMES[m0];
  const yy = String(y).slice(-2);
  return {
    periode: periode,
    bulanTahun: mmm + '-' + yy,
    label: 'Period ' + periode + ' ' + mmm + ' ' + yy,
  };
}

export function fuelCell(fuelPeriodTable, bulanTahun, periode) {
  const byPeriode = fuelPeriodTable[bulanTahun];
  return (byPeriode && byPeriode[periode]) || { pertamina: 0, total: 0, pertaminaPbbkbPph22: 0 };
}

// RF: single shared config, always Barges MHU's bbsBmc.rf entry — Barges
// CAM and FLF both copy this value rather than keeping their own.
export function computeRfRatio({ fuelPrice, displayJisdorVal, rfConfig, baseFuelPrice, baseJisdor }) {
  const entry = rfConfig || {};
  const fuelPct = (entry.fuelPct || 0) / 100;
  const fixedCostPct = (entry.fixedCostPct || 0) / 100;
  const tolerancePlus = entry.tolerancePlus10 || 0;
  const toleranceMinus = entry.toleranceMinus10 || 0;
  if (displayJisdorVal === undefined) return 0;
  if (fuelPrice < tolerancePlus && fuelPrice > toleranceMinus) return 1.0;
  const baseRatio = baseFuelPrice && baseJisdor ? baseFuelPrice / baseJisdor : 0;
  const rawRatio = displayJisdorVal ? roundTo((fuelPrice / displayJisdorVal) / (baseRatio || 1), 4) : 0;
  return rawRatio * fuelPct + fixedCostPct;
}

// ICI <60/>60: same formula, different tier.usdMt constant.
export function iciUsdMtValue(jisdorForIci, rf, usdMt) {
  return roundTo(jisdorForIci * (rf * usdMt), 2);
}

// anchorKursVal/anchorFuelTotalVal come from the column's Adjust-mode
// Ko/Fo picks (per-column anchors), not a fixed global anchor.
export function bbsBmcFormula(kursVal, fuelTaxTotal, rateA, rateB, anchorKursVal, anchorFuelTotalVal) {
  if (kursVal === undefined || anchorKursVal === undefined) return 0;
  return rateA * anchorKursVal * (kursVal / anchorKursVal) + (fuelTaxTotal - anchorFuelTotalVal) * rateB;
}

// Shared by Berau/PDP/TML/KSU/TMS/AYU/CNB/PPSJ — all 8 columns use the exact
// same anchor-ratio formula, differing only in which column's own
// baseFreight/conversiFuel/ko/fo the caller supplies via `adj`.
// koSource/foSource pick which series backs the formula's "current" value
// (kursVal vs jisdorVal) and fuel total (Total vs Pertamina) — they must
// match what the Ko/Fo anchor was read from, per column.
export function bbsBmcAdjustValue(adj, { jisdorVal, kursVal, fuel }) {
  const currentKurs = adj.koSource === 'jisdor' ? jisdorVal : kursVal;
  const currentFuel = adj.foSource === 'pertamina' ? fuel.pertamina : fuel.total;
  return bbsBmcFormula(currentKurs, currentFuel, adj.baseFreight, adj.conversiFuel, adj.ko, adj.fo);
}

// BDD: row's own Jisdor gate + row's own Period Fn Fuel Total, not the
// anchor-ratio formula the other BBS/BMC columns use.
// = 0 if row's Jisdor blank, else baseFreight + conversiFuel * (fuel.total - fo).
export function bddValue(adj, { displayJisdorVal, fuel }) {
  if (displayJisdorVal === undefined) return 0;
  return adj.baseFreight + adj.conversiFuel * (fuel.total - adj.fo);
}

// = 0 if row's Jisdor blank, else baseFreight + (fuel.total - fo) * conversiFuel.
export function dlsValue(adj, { displayJisdorVal, fuel }) {
  if (displayJisdorVal === undefined) return 0;
  return adj.baseFreight + (fuel.total - adj.fo) * adj.conversiFuel;
}

// Shared by GLS/GMS — same base formula as DLS, additionally rounded to a
// whole number (displayed with .00 via fmtMoney).
export function glsGmsValue(adj, { displayJisdorVal, fuel }) {
  if (displayJisdorVal === undefined) return 0;
  return roundTo((adj.baseFreight * 1.11 + (fuel.total - adj.fo) * adj.conversiFuel) / 1.11, 0);
}
