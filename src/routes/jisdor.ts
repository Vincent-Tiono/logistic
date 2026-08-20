import type { FastifyInstance } from "fastify";
import { dbPool } from "../config/database.js";
import { formatRupiah, formatTanggalID } from "../lib/bi-kurs.js";
import { buildQueryString } from "../lib/query-string.js";
import { requireAnyDivisi } from "../plugins/session.js";
import { getJisdorPage } from "../services/jisdor.service.js";

interface JisdorQuerystring {
  dari?: string;
  sampai?: string;
  page?: string;
  retry?: string;
}

const MAX_RETRIES = 5;

export async function jisdorRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "VM&FAT"]);

  app.get<{ Querystring: JisdorQuerystring }>(
    "/jisdor",
    { preHandler: requireGate },
    async (req, reply) => {
      const dari = req.query.dari ?? "";
      const sampai = req.query.sampai ?? "";
      const page = Math.max(1, Number.parseInt(req.query.page ?? "1", 10) || 1);
      const retry = Math.max(0, Number.parseInt(req.query.retry ?? "0", 10) || 0);

      const result = await getJisdorPage({ dari, sampai, page }, dbPool("databarging"));
      const shouldAutoReload =
        result.fetchFailed && result.totalRows === 0 && retry < MAX_RETRIES;

      const reloadUrl = shouldAutoReload
        ? buildQueryString({ dari, sampai, page: String(page), retry: String(retry + 1) })
        : null;

      const retryUrl = result.fetchFailed
        ? buildQueryString({ dari, sampai, page: String(page), retry: "0" })
        : null;

      const pageUrl = (p: number) => buildQueryString({ dari, sampai, page: String(p) });

      return reply.view("jisdor.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
        dariInput: dari,
        sampaiInput: sampai,
        rows: result.pageData,
        fetchFailed: result.fetchFailed,
        usingStaleData: result.usingStaleData,
        shouldAutoReload,
        reloadUrl,
        retryUrl,
        page: result.page,
        totalPages: result.totalPages,
        totalRows: result.totalRows,
        pageUrl,
        formatTanggalID,
        formatRupiah,
      });
    }
  );
}
