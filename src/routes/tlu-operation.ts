import type { FastifyInstance } from "fastify";
import { dbPool } from "../config/database.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  listAllActiveOperations,
  listSiBargesByVessel,
  listVesselPeriods,
} from "../services/tlu-operation.service.js";

interface ListQuery {
  ajax?: string;
  action?: string;
  no_pk?: string;
}

export async function tluOperationRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "Operation"]);

  app.get<{ Querystring: ListQuery }>(
    "/tlu-operation",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");

      if (req.query.ajax === "1") {
        const action = req.query.action ?? "";

        if (action === "all_operations") {
          const data = await listAllActiveOperations(pool);
          return reply.send({ ok: true, data });
        }

        if (action === "si_barges_by_vessel") {
          const no_pk = (req.query.no_pk ?? "").trim();
          if (no_pk === "") {
            return reply.send({ ok: false, msg: "No PK wajib dipilih." });
          }
          const data = await listSiBargesByVessel(pool, no_pk);
          return reply.send({ ok: true, data });
        }

        return reply.send({ ok: false, msg: "Unknown action" });
      }

      const vesselPeriods = await listVesselPeriods(pool);

      return reply.view("tlu-operation.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
        vesselPeriods,
      });
    }
  );
}
