import type { FastifyInstance } from "fastify";
import { addDaysYmd } from "../lib/date.js";
import { dbPool } from "../config/database.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  BARGES_MHU_BASE_ANCHOR_DATE,
  BARGES_MHU_BASE_BULAN_TAHUN,
  BARGES_MHU_BASE_JISDOR,
  BARGES_MHU_BASE_PERIODE,
  buildDenseDateSeries,
  FUEL_KURS_ACTIONS,
  fuelTaxPertaminaPbbkbPph22,
  fuelTaxTotal,
  getFuelKursRates,
  type FuelKursActionBody,
  type FuelPeriodTable,
} from "../services/fuel-kurs.service.js";
import { computeEffectiveRates, getFuelRatesByMonth, listFuelData } from "../services/fuel.service.js";
import { getJisdorRange } from "../services/jisdor.service.js";
import { getKursTengahRange } from "../services/kurs-tengah.service.js";

interface FuelKursBody {
  action?: string;
  field?: string;
  value?: string;
  bulan_tahun?: string;
  periode?: string;
  col?: string;
  mode?: string;
  date?: string;
  state_key?: string;
  source?: string;
  section?: string;
  group_key?: string;
}

const BULAN_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function parseNumericInput(raw: string | undefined): number {
  return Number(String(raw ?? "0").replace(/,/g, "")) || 0;
}

function compareBulanTahun(a: string, b: string): number {
  const [ma, ya] = a.split("-");
  const [mb, yb] = b.split("-");
  if (ya !== yb) return Number(ya) - Number(yb);
  return BULAN_NAMES.indexOf(ma ?? "") - BULAN_NAMES.indexOf(mb ?? "");
}

/** "Jan-26" -> {start: "2026-01-01", end: "2026-01-31"}. */
function monthBounds(bulanTahun: string): { start: string; end: string } | null {
  const [mon, yy] = bulanTahun.split("-");
  const monthIndex = BULAN_NAMES.indexOf(mon ?? "");
  if (monthIndex < 0 || !yy) return null;
  const year = 2000 + Number(yy);
  const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const end = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export async function fuelKursRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "VM&FAT"]);

  app.get("/fuel-kurs", { preHandler: requireGate }, async (req, reply) => {
    const pool = dbPool("databarging");
    const [rates, fuelData, fuelRateOverrides] = await Promise.all([
      getFuelKursRates(pool),
      listFuelData(pool),
      getFuelRatesByMonth(pool),
    ]);

    const pertaminaLookup: Record<string, Record<number, number>> = {};
    const fuelPeriodTable: FuelPeriodTable = {};
    const bulanTahunKeys = Object.keys(fuelData).sort(compareBulanTahun);
    // Effective PPN/PBBKB/PPH22 per month, carried forward from the Fuel
    // page's rate overrides (same resolver fuel.ts uses) — not a fixed
    // constant, so a rate change there is reflected here too.
    const effectiveFuelRates = computeEffectiveRates(fuelRateOverrides, bulanTahunKeys);
    for (const bulanTahun of bulanTahunKeys) {
      const monthRates = effectiveFuelRates[bulanTahun];
      for (const [periode, cell] of Object.entries(fuelData[bulanTahun] ?? {})) {
        fuelPeriodTable[bulanTahun] ??= {};
        fuelPeriodTable[bulanTahun][Number(periode)] = {
          pertamina: cell.pertamina,
          total: fuelTaxTotal(cell.pertamina, monthRates),
          pertaminaPbbkbPph22: fuelTaxPertaminaPbbkbPph22(cell.pertamina, monthRates),
        };
        if (cell.pertamina === 0) continue;
        pertaminaLookup[bulanTahun] ??= {};
        pertaminaLookup[bulanTahun][Number(periode)] = cell.pertamina;
      }
    }

    // Barges MHU daily engine: fetch real Jisdor/Kurs Tengah for every month
    // that has fuel-price data entered, plus the fixed RF/BBS-BMC/BDD anchor date.
    const monthsWithData = Object.keys(pertaminaLookup).sort(compareBulanTahun);
    const bargesMhu: {
      kursByDate: Record<string, number>;
      jisdorByDate: Record<string, number>;
      fuelPeriodTable: FuelPeriodTable;
      config: {
        baseBulanTahun: string;
        basePeriode: number;
        baseAnchorDate: string;
        baseJisdor: number;
      };
      fetchFailed: boolean;
    } = {
      kursByDate: {},
      jisdorByDate: {},
      fuelPeriodTable,
      config: {
        baseBulanTahun: BARGES_MHU_BASE_BULAN_TAHUN,
        basePeriode: BARGES_MHU_BASE_PERIODE,
        baseAnchorDate: BARGES_MHU_BASE_ANCHOR_DATE,
        baseJisdor: BARGES_MHU_BASE_JISDOR,
      },
      fetchFailed: false,
    };

    const bounds = monthsWithData
      .map(monthBounds)
      .filter((b): b is { start: string; end: string } => b !== null);

    if (bounds.length > 0) {
      let minDate = bounds.reduce((m, b) => (b.start < m ? b.start : m), bounds[0].start);
      let maxDate = bounds.reduce((m, b) => (b.end > m ? b.end : m), bounds[0].end);
      minDate = minDate < BARGES_MHU_BASE_ANCHOR_DATE ? minDate : BARGES_MHU_BASE_ANCHOR_DATE;
      maxDate = maxDate > BARGES_MHU_BASE_ANCHOR_DATE ? maxDate : BARGES_MHU_BASE_ANCHOR_DATE;
      // Buffer before minDate so the anchor date (and any month start) has a
      // carried-forward value even if BI has no data exactly on that day.
      const fetchStart = addDaysYmd(minDate, -15) ?? minDate;

      const [jisdorRows, kursRows] = await Promise.all([
        getJisdorRange(fetchStart, maxDate),
        getKursTengahRange(fetchStart, maxDate),
      ]);

      bargesMhu.fetchFailed = jisdorRows === null || kursRows === null;

      // BI returns tanggal as "YYYY-MM-DDT00:00:00+07:00"; only the date part is used as the key.
      const jisdorRaw = new Map(
        (jisdorRows ?? []).map((r) => [r.tanggal.slice(0, 10), r.kurs])
      );
      const kursRaw = new Map(
        (kursRows ?? []).map((r) => [r.tanggal.slice(0, 10), r.tengah])
      );

      bargesMhu.jisdorByDate = buildDenseDateSeries(jisdorRaw, fetchStart, maxDate);
      bargesMhu.kursByDate = buildDenseDateSeries(kursRaw, fetchStart, maxDate);
    }

    return reply.view("fuel-kurs.ejs", {
      username: req.session.username,
      divisi: req.session.divisi,
      rates,
      pertaminaLookup,
      bargesMhu,
    });
  });

  app.post<{ Body: FuelKursBody }>(
    "/fuel-kurs",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");

      const handler = FUEL_KURS_ACTIONS[req.body.action ?? ""];
      if (!handler) {
        reply.code(400);
        return reply.send({ ok: false, error: "Invalid input" });
      }

      // Every action reads its inputs off this same normalized shape —
      // stateKey defaults to "bbsBmc" to match every bbsBmc(Cam)-scoped
      // action's original per-branch default.
      const body: FuelKursActionBody = {
        field: req.body.field ?? "",
        value: parseNumericInput(req.body.value),
        bulanTahun: req.body.bulan_tahun ?? "",
        periode: Number.parseInt(req.body.periode ?? "0", 10),
        col: req.body.col ?? "",
        mode: req.body.mode ?? "",
        date: req.body.date ?? "",
        stateKey: req.body.state_key ?? "bbsBmc",
        source: req.body.source ?? "",
        section: req.body.section ?? "",
        groupKey: req.body.group_key ?? "",
      };

      const result = await handler(pool, body);
      if (!result.ok) reply.code(400);
      return reply.send(result);
    }
  );
}
