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
  fuelTaxTotal,
  getFuelKursRates,
  saveBbsBmcAdjustBaseFreight,
  saveBbsBmcAdjustConversiFuel,
  saveBbsBmcAdjustFo,
  saveBbsBmcAdjustKo,
  saveBbsBmcMode,
  saveBbsBmcValue,
  saveFuelKursFuelValueBase,
  saveFuelKursRate,
  saveFuelKursToleranceBase,
  type FuelPeriodTable,
} from "../services/fuel-kurs.service.js";
import { listFuelData } from "../services/fuel.service.js";
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
    const [rates, fuelData] = await Promise.all([
      getFuelKursRates(pool),
      listFuelData(pool),
    ]);

    const pertaminaLookup: Record<string, Record<number, number>> = {};
    const fuelPeriodTable: FuelPeriodTable = {};
    const bulanTahunKeys = Object.keys(fuelData).sort(compareBulanTahun);
    for (const bulanTahun of bulanTahunKeys) {
      for (const [periode, cell] of Object.entries(fuelData[bulanTahun] ?? {})) {
        fuelPeriodTable[bulanTahun] ??= {};
        fuelPeriodTable[bulanTahun][Number(periode)] = {
          pertamina: cell.pertamina,
          total: fuelTaxTotal(cell.pertamina),
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

      if (req.body.action === "save_rate") {
        const result = await saveFuelKursRate(pool, {
          field: req.body.field ?? "",
          value: parseNumericInput(req.body.value),
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      if (req.body.action === "save_tolerance_base") {
        const result = await saveFuelKursToleranceBase(pool, {
          bulanTahun: req.body.bulan_tahun ?? "",
          periode: Number.parseInt(req.body.periode ?? "0", 10),
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      if (req.body.action === "save_fuel_value_base") {
        const result = await saveFuelKursFuelValueBase(pool, {
          bulanTahun: req.body.bulan_tahun ?? "",
          periode: Number.parseInt(req.body.periode ?? "0", 10),
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      if (req.body.action === "save_bbsbmc_mode") {
        const result = await saveBbsBmcMode(pool, {
          stateKey: req.body.state_key ?? "bbsBmc",
          col: req.body.col ?? "",
          mode: req.body.mode ?? "",
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      if (req.body.action === "save_bbsbmc_value") {
        const result = await saveBbsBmcValue(pool, {
          stateKey: req.body.state_key ?? "bbsBmc",
          col: req.body.col ?? "",
          value: parseNumericInput(req.body.value),
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      if (req.body.action === "save_bbsbmc_adjust_base_freight") {
        const result = await saveBbsBmcAdjustBaseFreight(pool, {
          stateKey: req.body.state_key ?? "bbsBmc",
          col: req.body.col ?? "",
          value: parseNumericInput(req.body.value),
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      if (req.body.action === "save_bbsbmc_adjust_conversi_fuel") {
        const result = await saveBbsBmcAdjustConversiFuel(pool, {
          stateKey: req.body.state_key ?? "bbsBmc",
          col: req.body.col ?? "",
          value: parseNumericInput(req.body.value),
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      if (req.body.action === "save_bbsbmc_adjust_ko") {
        const result = await saveBbsBmcAdjustKo(pool, {
          stateKey: req.body.state_key ?? "bbsBmc",
          col: req.body.col ?? "",
          date: req.body.date ?? "",
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      if (req.body.action === "save_bbsbmc_adjust_fo") {
        const result = await saveBbsBmcAdjustFo(pool, {
          stateKey: req.body.state_key ?? "bbsBmc",
          col: req.body.col ?? "",
          bulanTahun: req.body.bulan_tahun ?? "",
          periode: Number.parseInt(req.body.periode ?? "0", 10),
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      reply.code(400);
      return reply.send({ ok: false, error: "Invalid input" });
    }
  );
}
