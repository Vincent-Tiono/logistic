import mysql from "mysql2/promise";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FUEL_KURS_ACTIONS, type FuelKursActionBody } from "../../src/services/fuel-kurs.service.js";

// Exercises the declarative FUEL_KURS_ACTIONS table (POST /fuel-kurs's 17
// save_* actions collapsed onto one saveFuelKursField write primitive) —
// see docs improve-codebase-architecture candidate 1. Fuel & Kurs had no
// characterization coverage before this; these hit the real fuel_kurs_rates
// row directly (service-level, no HTTP/session layer) and restore it
// afterward so a real dev DB isn't left mutated.

function pool() {
  return mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER ?? "logistic_app",
    password: process.env.DB_PASS ?? "user123",
    database: "databarging",
  });
}

async function readRatesJson(p: mysql.Pool): Promise<Record<string, unknown>> {
  const [rows] = await p.query<mysql.RowDataPacket[]>(
    "SELECT rates_json FROM fuel_kurs_rates WHERE id = 1"
  );
  const row = rows[0];
  return typeof row.rates_json === "string" ? JSON.parse(row.rates_json) : row.rates_json;
}

function call(action: string, body: Partial<FuelKursActionBody>) {
  const handler = FUEL_KURS_ACTIONS[action];
  if (!handler) throw new Error(`no handler registered for action "${action}"`);
  const p = pool();
  return handler(p, body).finally(() => p.end());
}

describe("FUEL_KURS_ACTIONS", () => {
  let snapshot: string;
  let p: mysql.Pool;

  beforeEach(async () => {
    p = pool();
    const [rows] = await p.query<mysql.RowDataPacket[]>(
      "SELECT rates_json FROM fuel_kurs_rates WHERE id = 1"
    );
    snapshot =
      typeof rows[0].rates_json === "string" ? rows[0].rates_json : JSON.stringify(rows[0].rates_json);
  });

  afterEach(async () => {
    await p.query("UPDATE fuel_kurs_rates SET rates_json = ? WHERE id = 1", [snapshot]);
    await p.end();
  });

  it("unknown action: dispatch table has no entry", () => {
    expect(FUEL_KURS_ACTIONS["not_a_real_action"]).toBeUndefined();
  });

  it("save_rate: sets a dotted flat-path field, leaves its siblings alone", async () => {
    const before = await readRatesJson(p);
    const siblingBefore = (before as any).mhu.lt60.flf;

    const result = await call("save_rate", { field: "mhu.lt60.usdMt", value: 12.5 });
    expect(result).toEqual({ ok: true });

    const after = await readRatesJson(p);
    expect((after as any).mhu.lt60.usdMt).toBe(12.5);
    expect((after as any).mhu.lt60.flf).toBe(siblingBefore);
  });

  it("save_rate: rejects a field not in FUEL_KURS_RATE_FIELDS", async () => {
    const result = await call("save_rate", { field: "mhu.lt60.notAField", value: 1 });
    expect(result).toEqual({ ok: false, error: "Invalid input" });
  });

  it("save_bbsbmc_mode: writes bbsBmc.modes.<col> for a fresh column (JSON_MERGE_PATCH scaffolds the parent)", async () => {
    const result = await call("save_bbsbmc_mode", { stateKey: "bbsBmc", col: "berau", mode: "adjust" });
    expect(result).toEqual({ ok: true });
    const after = await readRatesJson(p);
    expect((after as any).bbsBmc.modes.berau).toBe("adjust");
  });

  it("save_bbsbmc_mode: rejects an invalid mode", async () => {
    const result = await call("save_bbsbmc_mode", { stateKey: "bbsBmc", col: "berau", mode: "bogus" });
    expect(result).toEqual({ ok: false, error: "Invalid input" });
  });

  it("save_bbsbmc_mode: rejects an invalid stateKey", async () => {
    const result = await call("save_bbsbmc_mode", { stateKey: "notAState", col: "berau", mode: "adjust" });
    expect(result).toEqual({ ok: false, error: "Invalid input" });
  });

  it("save_bbsbmc_mode: rejects an unknown column", async () => {
    const result = await call("save_bbsbmc_mode", { stateKey: "bbsBmc", col: "not_a_col", mode: "adjust" });
    expect(result).toEqual({ ok: false, error: "Invalid input" });
  });

  it("save_bbsbmc_value: writes bbsBmc.values.<col>, bbsBmcCam is independent", async () => {
    await call("save_bbsbmc_value", { stateKey: "bbsBmc", col: "pdp", value: 100 });
    await call("save_bbsbmc_value", { stateKey: "bbsBmcCam", col: "pdp", value: 200 });
    const after = await readRatesJson(p);
    expect((after as any).bbsBmc.values.pdp).toBe(100);
    expect((after as any).bbsBmcCam.values.pdp).toBe(200);
  });

  it("save_bbsbmc_adjust_base_freight / conversi_fuel: both land under adjust.<col> without clobbering each other", async () => {
    await call("save_bbsbmc_adjust_base_freight", { stateKey: "bbsBmc", col: "tml", value: 111 });
    await call("save_bbsbmc_adjust_conversi_fuel", { stateKey: "bbsBmc", col: "tml", value: 2.5 });
    const after = await readRatesJson(p);
    expect((after as any).bbsBmc.adjust.tml.baseFreight).toBe(111);
    expect((after as any).bbsBmc.adjust.tml.conversiFuel).toBe(2.5);
  });

  it("save_bbsbmc_adjust_ko_source: accepts kurs/jisdor/manual, rejects anything else", async () => {
    const ok = await call("save_bbsbmc_adjust_ko_source", { stateKey: "bbsBmc", col: "ksu", source: "jisdor" });
    expect(ok).toEqual({ ok: true });
    const after = await readRatesJson(p);
    expect((after as any).bbsBmc.adjust.ksu.koSource).toBe("jisdor");

    const bad = await call("save_bbsbmc_adjust_ko_source", { stateKey: "bbsBmc", col: "ksu", source: "usd" });
    expect(bad).toEqual({ ok: false, error: "Invalid input" });
  });

  it("save_bbsbmc_adjust_fo_source: accepts pertamina/total/manual, rejects anything else", async () => {
    const ok = await call("save_bbsbmc_adjust_fo_source", { stateKey: "bbsBmc", col: "tms", source: "total" });
    expect(ok).toEqual({ ok: true });
    const bad = await call("save_bbsbmc_adjust_fo_source", { stateKey: "bbsBmc", col: "tms", source: "eur" });
    expect(bad).toEqual({ ok: false, error: "Invalid input" });
  });

  it("save_bbsbmc_adjust_fo: sets foBulanTahun+foPeriode together, blanking one blanks both", async () => {
    const set = await call("save_bbsbmc_adjust_fo", {
      stateKey: "bbsBmc",
      col: "ayu",
      bulanTahun: "Feb-26",
      periode: 2,
    });
    expect(set).toEqual({ ok: true });
    let after = await readRatesJson(p);
    expect((after as any).bbsBmc.adjust.ayu.foBulanTahun).toBe("Feb-26");
    expect((after as any).bbsBmc.adjust.ayu.foPeriode).toBe(2);

    const blank = await call("save_bbsbmc_adjust_fo", { stateKey: "bbsBmc", col: "ayu", bulanTahun: "", periode: 0 });
    expect(blank).toEqual({ ok: true });
    after = await readRatesJson(p);
    expect((after as any).bbsBmc.adjust.ayu.foBulanTahun).toBe("");
    expect((after as any).bbsBmc.adjust.ayu.foPeriode).toBe(0);
  });

  it("save_bbsbmc_adjust_fo: rejects a bulanTahun set with an out-of-range periode", async () => {
    const result = await call("save_bbsbmc_adjust_fo", {
      stateKey: "bbsBmc",
      col: "ayu",
      bulanTahun: "Feb-26",
      periode: 3,
    });
    expect(result).toEqual({ ok: false, error: "Invalid input" });
  });

  it("save_bbsbmc_rf_field: writes bbsBmc.rf.<field> for the RF-numeric fields only", async () => {
    const ok = await call("save_bbsbmc_rf_field", { stateKey: "bbsBmc", field: "fuelPct", value: 55 });
    expect(ok).toEqual({ ok: true });
    const after = await readRatesJson(p);
    expect((after as any).bbsBmc.rf.fuelPct).toBe(55);

    const bad = await call("save_bbsbmc_rf_field", { stateKey: "bbsBmc", field: "notAField", value: 1 });
    expect(bad).toEqual({ ok: false, error: "Invalid input" });
  });

  it("save_bbsbmc_rf_tolerance_base: sets toleranceBaseBulanTahun+toleranceBasePeriode under bbsBmc.rf", async () => {
    const result = await call("save_bbsbmc_rf_tolerance_base", {
      stateKey: "bbsBmc",
      bulanTahun: "Mar-26",
      periode: 1,
    });
    expect(result).toEqual({ ok: true });
    const after = await readRatesJson(p);
    expect((after as any).bbsBmc.rf.toleranceBaseBulanTahun).toBe("Mar-26");
    expect((after as any).bbsBmc.rf.toleranceBasePeriode).toBe(1);
  });

  it("save_fuel_value_base: sets rf.fuelValueBulanTahun/rf.fuelValuePeriode at the rates root (not stateKey-scoped)", async () => {
    const result = await call("save_fuel_value_base", { bulanTahun: "Apr-26", periode: 2 });
    expect(result).toEqual({ ok: true });
    const after = await readRatesJson(p);
    expect((after as any).rf.fuelValueBulanTahun).toBe("Apr-26");
    expect((after as any).rf.fuelValuePeriode).toBe(2);
  });

  it("save_flf_tolerance_field: writes flfPnts/flfPss numeric fields independently", async () => {
    await call("save_flf_tolerance_field", { section: "flfPnts", field: "fuelPct", value: 10 });
    await call("save_flf_tolerance_field", { section: "flfPss", field: "fuelPct", value: 20 });
    const after = await readRatesJson(p);
    expect((after as any).flfPnts.fuelPct).toBe(10);
    expect((after as any).flfPss.fuelPct).toBe(20);
  });

  it("save_flf_tolerance_field: rejects an unknown section", async () => {
    const result = await call("save_flf_tolerance_field", { section: "flfBogus", field: "fuelPct", value: 1 });
    expect(result).toEqual({ ok: false, error: "Invalid input" });
  });

  it("save_flf_fo_base: sets foBulanTahun+foPeriode on the section itself", async () => {
    const result = await call("save_flf_fo_base", { section: "flfPnts", bulanTahun: "Mei-26", periode: 1 });
    expect(result).toEqual({ ok: true });
    const after = await readRatesJson(p);
    expect((after as any).flfPnts.foBulanTahun).toBe("Mei-26");
    expect((after as any).flfPnts.foPeriode).toBe(1);
  });

  it("save_flf_fr: writes fr.<groupKey>.<single|blending>, rejects an unknown group or field", async () => {
    const ok = await call("save_flf_fr", { section: "flfPnts", groupKey: "pnts_le49", field: "single", value: 1.2 });
    expect(ok).toEqual({ ok: true });
    const after = await readRatesJson(p);
    expect((after as any).flfPnts.fr.pnts_le49.single).toBe(1.2);

    const badGroup = await call("save_flf_fr", { section: "flfPnts", groupKey: "not_a_group", field: "single", value: 1 });
    expect(badGroup).toEqual({ ok: false, error: "Invalid input" });

    const badField = await call("save_flf_fr", { section: "flfPnts", groupKey: "pnts_le49", field: "average", value: 1 });
    expect(badField).toEqual({ ok: false, error: "Invalid input" });
  });
});
