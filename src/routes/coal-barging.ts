import type { FastifyInstance } from "fastify";
import { dbPool } from "../config/database.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  listAllVesselOperations,
  listCoalBargingByVessel,
  listUnusedRcOptions,
  seedCoalBargingFromTlu,
} from "../services/coal-barging.service.js";
import { listVesselPeriods } from "../services/tlu-operation.service.js";

interface ListQuery {
  ajax?: string;
  action?: string;
  no_pk?: string;
}

export async function coalBargingRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "Operation"]);

  app.get<{ Querystring: ListQuery }>(
    "/coal-barging",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");
      const coalPool = dbPool("datacoalbarging");

      // Legacy runs this unconditionally on every request (page load and
      // every AJAX action) — see seedCoalBargingFromTlu's doc comment.
      await seedCoalBargingFromTlu(coalPool);

      if (req.query.ajax === "1") {
        const action = req.query.action ?? "";

        if (action === "all_vessels") {
          const data = await listAllVesselOperations(pool);
          return reply.send({ ok: true, data });
        }

        if (action === "si_barges_by_vessel") {
          const no_pk = (req.query.no_pk ?? "").trim();
          if (no_pk === "") {
            return reply.send({ ok: false, msg: "No PK wajib dipilih." });
          }
          const data = await listCoalBargingByVessel(pool, no_pk);
          return reply.send({ ok: true, data });
        }

        if (action === "unused_rc_options") {
          const no_pk = (req.query.no_pk ?? "").trim();
          if (no_pk === "") {
            return reply.send({ ok: false, msg: "No PK wajib dipilih." });
          }
          const data = await listUnusedRcOptions(pool, no_pk);
          return reply.send({ ok: true, data });
        }

        return reply.send({ ok: false, msg: "Unknown action" });
      }

      const vesselPeriods = await listVesselPeriods(pool);

      return reply.view("coal-barging.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
        vesselPeriods,
      });
    }
  );
}
