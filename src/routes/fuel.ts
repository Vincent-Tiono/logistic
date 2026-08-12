import type { FastifyInstance } from "fastify";
import { dbPool } from "../config/database.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  BULAN_NAMES,
  computeEffectiveRates,
  getFuelRatesByMonth,
  listFuelData,
  saveFuelRate,
  saveFuelValue,
} from "../services/fuel.service.js";

interface FuelQuerystring {
  tahun?: string;
  bulan?: string;
}

interface FuelBody {
  action?: string;
  bulan_tahun?: string;
  periode?: string;
  field?: string;
  value?: string;
}

function parseNumericInput(raw: string | undefined): number {
  return Number(String(raw ?? "0").replace(/,/g, "")) || 0;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Ports rtrim(rtrim(number_format($rate,3,'.',''),'0'),'.'): 11 -> "11", 7.5 -> "7.5". */
function trimTrailingZeros(n: number): string {
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export async function fuelRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "VM&FAT"]);

  app.get<{ Querystring: FuelQuerystring }>(
    "/fuel",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");
      const currentYear = new Date().getFullYear();
      const tahun = Number.parseInt(req.query.tahun ?? "", 10) || currentYear;
      const tahunOptions = Array.from({ length: 11 }, (_, i) => currentYear + i);

      const bulan = BULAN_NAMES.includes(
        (req.query.bulan ?? "") as (typeof BULAN_NAMES)[number]
      )
        ? (req.query.bulan as (typeof BULAN_NAMES)[number])
        : "Jan";

      const [fuelData, rateOverrides] = await Promise.all([
        listFuelData(pool),
        getFuelRatesByMonth(pool),
      ]);

      const yy = String(tahun).slice(-2);
      const bulanTahunList = BULAN_NAMES.map((m) => `${m}-${yy}`);
      const ratesByMonth = computeEffectiveRates(rateOverrides, bulanTahunList);
      const selectedBulanTahun = `${bulan}-${yy}`;
      const selectedRates = ratesByMonth[selectedBulanTahun];

      const rows = bulanTahunList.flatMap((bt) =>
        [1, 2].map((periode) => {
          const cell = fuelData[bt]?.[periode];
          return {
            bulanTahun: bt,
            periode,
            pertaminaDisplay:
              cell && cell.pertamina !== 0 ? formatNumber(cell.pertamina) : "",
            ici3Display: cell && cell.ici3 !== 0 ? formatNumber(cell.ici3) : "",
          };
        })
      );

      return reply.view("fuel.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
        tahun,
        tahunOptions,
        bulan,
        bulanNames: BULAN_NAMES,
        rows,
        ratesByMonth,
        ppnRateDisplay: trimTrailingZeros(selectedRates.ppnRate),
        pbbkbRateDisplay: trimTrailingZeros(selectedRates.pbbkbRate),
        pph22RateDisplay: trimTrailingZeros(selectedRates.pph22Rate),
      });
    }
  );

  app.post<{ Body: FuelBody }>(
    "/fuel",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");
      const action = req.body.action ?? "";

      if (action === "save_fuel") {
        const result = await saveFuelValue(pool, {
          bulanTahun: req.body.bulan_tahun ?? "",
          periode: Number.parseInt(req.body.periode ?? "0", 10),
          field: req.body.field ?? "pertamina",
          value: parseNumericInput(req.body.value),
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      if (action === "save_fuel_rate") {
        const result = await saveFuelRate(pool, {
          bulanTahun: req.body.bulan_tahun ?? "",
          field: req.body.field ?? "",
          value: parseNumericInput(req.body.value),
        });
        if (!result.ok) reply.code(400);
        return reply.send(result);
      }

      reply.code(400);
      return reply.send({ ok: false, error: "Invalid input" });
    }
  );
}
