import { describe, expect, it } from "vitest";
import {
  bbsBmcAdjustValue,
  bbsBmcFormula,
  bddValue,
  computeRfRatio,
  dlsValue,
  fuelCell,
  glsGmsValue,
  iciUsdMtValue,
  periodFn,
  roundTo,
} from "../../assets/js/fuel-kurs-calc.mjs";

// Pure calc module extracted from views/fuel-kurs.ejs's inline <script> —
// see docs/adr/0001-tlu-grouped-export-computes-client-side.md for why this
// stays client-side JS rather than growing a parallel server-side copy.
// No DOM access, no server target — runs directly under Node/vitest.
describe("fuel-kurs-calc: periodFn", () => {
  it("assigns Period 1 for the 1st-14th and Period 2 for the 15th-end", () => {
    expect(periodFn(2026, 0, 1)).toEqual({ periode: 1, bulanTahun: "Jan-26", label: "Period 1 Jan 26" });
    expect(periodFn(2026, 0, 14)).toEqual({ periode: 1, bulanTahun: "Jan-26", label: "Period 1 Jan 26" });
    expect(periodFn(2026, 0, 15)).toEqual({ periode: 2, bulanTahun: "Jan-26", label: "Period 2 Jan 26" });
    expect(periodFn(2026, 0, 31)).toEqual({ periode: 2, bulanTahun: "Jan-26", label: "Period 2 Jan 26" });
  });
});

describe("fuel-kurs-calc: fuelCell", () => {
  it("returns the zeroed fallback shape when the period is missing from the table", () => {
    expect(fuelCell({}, "Jan-26", 1)).toEqual({ pertamina: 0, total: 0, pertaminaPbbkbPph22: 0 });
  });

  it("returns the looked-up cell when present", () => {
    const table = { "Jan-26": { 1: { pertamina: 7000, total: 7500, pertaminaPbbkbPph22: 7600 } } };
    expect(fuelCell(table, "Jan-26", 1)).toEqual({ pertamina: 7000, total: 7500, pertaminaPbbkbPph22: 7600 });
  });
});

describe("fuel-kurs-calc: computeRfRatio", () => {
  const baseArgs = { baseFuelPrice: 7000, baseJisdor: 14000 };

  it("returns 0 when displayJisdorVal is undefined", () => {
    expect(computeRfRatio({ fuelPrice: 7200, displayJisdorVal: undefined, rfConfig: {}, ...baseArgs })).toBe(0);
  });

  it("returns 1.0 when fuelPrice sits inside the tolerance band", () => {
    const rfConfig = { fuelPct: 50, fixedCostPct: 10, tolerancePlus10: 7300, toleranceMinus10: 6700 };
    expect(computeRfRatio({ fuelPrice: 7000, displayJisdorVal: 14000, rfConfig, ...baseArgs })).toBe(1.0);
  });

  it("scales by fuelPct/fixedCostPct against the base ratio outside the tolerance band", () => {
    const rfConfig = { fuelPct: 50, fixedCostPct: 10, tolerancePlus10: 7100, toleranceMinus10: 6900 };
    // baseRatio = 7000/14000 = 0.5; rawRatio = (7500/15000)/0.5 = 1.0
    // ratio = 1.0 * 0.5 + 0.10 = 0.60
    expect(computeRfRatio({ fuelPrice: 7500, displayJisdorVal: 15000, rfConfig, ...baseArgs })).toBeCloseTo(0.6, 6);
  });
});

describe("fuel-kurs-calc: bbsBmcFormula + bbsBmcAdjustValue", () => {
  it("returns 0 when kursVal or the Ko anchor is undefined", () => {
    expect(bbsBmcFormula(undefined, 100, 1, 1, 15000, 100)).toBe(0);
    expect(bbsBmcFormula(15500, 100, 1, 1, undefined, 100)).toBe(0);
  });

  it("computes rateA*anchorKurs*(kurs/anchorKurs) + (fuelTotal-anchorFuelTotal)*rateB", () => {
    // 2*15000*(15500/15000) + (110-100)*3 = 2*15000*1.0333.. + 30 = 31000 + 30
    expect(bbsBmcFormula(15500, 110, 2, 3, 15000, 100)).toBeCloseTo(31030, 6);
  });

  it("bbsBmcAdjustValue picks kurs/fuel series per koSource/foSource and delegates to bbsBmcFormula", () => {
    const fuel = { pertamina: 7000, total: 7500, pertaminaPbbkbPph22: 7600 };
    const adj = { koSource: "jisdor", foSource: "pertamina", baseFreight: 2, conversiFuel: 3, ko: 15000, fo: 100 };
    // currentKurs = jisdorVal (16000), currentFuel = fuel.pertamina (7000)
    const expected = bbsBmcFormula(16000, 7000, 2, 3, 15000, 100);
    expect(bbsBmcAdjustValue(adj, { jisdorVal: 16000, kursVal: 15500, fuel })).toBe(expected);
  });
});

describe("fuel-kurs-calc: bddValue / dlsValue / glsGmsValue", () => {
  const fuel = { pertamina: 7000, total: 7500, pertaminaPbbkbPph22: 7600 };
  const adj = { baseFreight: 100, conversiFuel: 2, fo: 7000 };

  it("all three return 0 when displayJisdorVal is undefined", () => {
    expect(bddValue(adj, { displayJisdorVal: undefined, fuel })).toBe(0);
    expect(dlsValue(adj, { displayJisdorVal: undefined, fuel })).toBe(0);
    expect(glsGmsValue(adj, { displayJisdorVal: undefined, fuel })).toBe(0);
  });

  it("bddValue = baseFreight + conversiFuel * (fuel.total - fo)", () => {
    expect(bddValue(adj, { displayJisdorVal: 16000, fuel })).toBe(100 + 2 * (7500 - 7000));
  });

  it("dlsValue = baseFreight + (fuel.total - fo) * conversiFuel", () => {
    expect(dlsValue(adj, { displayJisdorVal: 16000, fuel })).toBe(100 + (7500 - 7000) * 2);
  });

  it("glsGmsValue rounds (baseFreight*1.11 + (fuel.total-fo)*conversiFuel)/1.11 to a whole number", () => {
    const raw = (100 * 1.11 + (7500 - 7000) * 2) / 1.11;
    expect(glsGmsValue(adj, { displayJisdorVal: 16000, fuel })).toBe(roundTo(raw, 0));
  });
});

describe("fuel-kurs-calc: iciUsdMtValue", () => {
  it("rounds jisdorForIci * (rf * usdMt) to 2dp", () => {
    expect(iciUsdMtValue(16000, 0.6, 5.5)).toBe(roundTo(16000 * (0.6 * 5.5), 2));
  });
});

describe("fuel-kurs-calc: roundTo", () => {
  it("rounds to the given decimal places", () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(4.5, 0)).toBe(5);
  });

  it("inherits float binary-representation quirks from Math.round (e.g. 1.005 rounds down)", () => {
    // 1.005 * 100 === 100.49999999999999 in IEEE 754 double precision, so
    // this rounds to 1, not 1.01 — documenting the existing behavior as
    // ported verbatim from the page's original fuelKursRound.
    expect(roundTo(1.005, 2)).toBe(1);
  });
});
