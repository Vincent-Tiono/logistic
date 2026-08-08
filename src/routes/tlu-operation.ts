import type { FastifyInstance, FastifyRequest } from "fastify";
import { dbPool } from "../config/database.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  importOperationCsv,
  listAllActiveOperations,
  listOperationOptionLists,
  listSiBargesByVessel,
  listVesselPeriods,
  saveOperationData,
} from "../services/tlu-operation.service.js";

interface ListQuery {
  ajax?: string;
  action?: string;
  no_pk?: string;
}

interface SaveOperationBody {
  action?: string;
  sibarges_id?: unknown;
  data?: Record<string, unknown>;
}

function isIT(req: FastifyRequest): boolean {
  return (req.session.divisi ?? "").toUpperCase() === "IT";
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
      const optionLists = await listOperationOptionLists(pool);

      return reply.view("tlu-operation.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
        vesselPeriods,
        optionLists,
        isIT: isIT(req),
      });
    }
  );

  app.post<{ Body: SaveOperationBody }>(
    "/tlu-operation",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");

      if (req.isMultipart()) {
        const file = await req.file();
        if (!file) {
          return reply.send({ ok: false, msg: "File CSV tidak valid / gagal upload." });
        }
        const actionField = file.fields?.action;
        const action = actionField && "value" in actionField ? String(actionField.value) : "";
        if (action !== "import_operation_csv") {
          return reply.send({ ok: false, msg: "Unknown action" });
        }
        if (!isIT(req)) {
          return reply.send({
            ok: false,
            msg: "Akses ditolak. Hanya Divisi IT yang boleh import CSV.",
          });
        }
        const buffer = await file.toBuffer();
        const result = await importOperationCsv(
          pool,
          buffer.toString("utf-8"),
          req.session.username ?? ""
        );
        return reply.send(result);
      }

      const { action } = req.body;

      if (action === "save_operation_data") {
        const result = await saveOperationData(
          pool,
          req.body.sibarges_id,
          req.body.data ?? {},
          req.session.username ?? ""
        );
        return reply.send(result);
      }

      return reply.send({ ok: false, msg: "Unknown action" });
    }
  );
}
