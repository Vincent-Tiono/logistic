import type { FastifyInstance, FastifyRequest } from "fastify";
import { dbPool } from "../config/database.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  createVessel,
  deleteAllVessels,
  deleteVessel,
  importVesselCsv,
  listVessels,
  updateVessel,
  type VesselInput,
} from "../services/vessel.service.js";

interface AjaxBody extends Partial<VesselInput> {
  action?: string;
}

interface ListQuery {
  ajax?: string;
  action?: string;
  q?: string;
}

function isIT(req: FastifyRequest): boolean {
  return (req.session.divisi ?? "").toUpperCase() === "IT";
}

function toVesselInput(body: AjaxBody): VesselInput {
  return {
    no_pk: body.no_pk ?? "",
    no_si_vessel: body.no_si_vessel ?? "",
    buyer: body.buyer ?? "",
    mothervessel: body.mothervessel ?? "",
    anchorage: body.anchorage ?? "",
    term: body.term ?? "",
    laycan_start: body.laycan_start ?? "",
    laycan_end: body.laycan_end ?? "",
    ta_vessel: body.ta_vessel ?? "",
    pkk: body.pkk ?? "",
    rkbm: body.rkbm ?? "",
    single_mt: body.single_mt ?? "",
    blending_mt: body.blending_mt ?? "",
    stowageplan_mt: body.stowageplan_mt ?? "",
    loading_rate_kontrak: body.loading_rate_kontrak ?? "",
  };
}

export async function vesselRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "Operation"]);

  app.get<{ Querystring: ListQuery }>(
    "/vessel",
    { preHandler: requireGate },
    async (req, reply) => {
      if (req.query.ajax === "1") {
        if (req.query.action === "list") {
          const pool = dbPool("databarging");
          const data = await listVessels(pool, req.query.q ?? "");
          return reply.send({ ok: true, data });
        }
        return reply.send({ ok: false, msg: "Unknown action" });
      }

      return reply.view("vessel.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
      });
    }
  );

  app.post<{ Body: AjaxBody }>(
    "/vessel",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");

      if (req.isMultipart()) {
        const file = await req.file();
        if (!file) {
          return reply.send({
            ok: false,
            msg: "File CSV tidak valid / gagal upload.",
          });
        }
        const actionField = file.fields?.action;
        const action =
          actionField && "value" in actionField
            ? String(actionField.value)
            : "";
        if (action !== "import_csv") {
          return reply.send({ ok: false, msg: "Unknown action" });
        }
        if (!isIT(req)) {
          return reply.send({
            ok: false,
            msg: "Akses ditolak. Hanya Divisi IT yang boleh import CSV.",
          });
        }
        const buffer = await file.toBuffer();
        const result = await importVesselCsv(pool, buffer.toString("utf-8"));
        return reply.send(result);
      }

      const { action } = req.body;

      if (action === "create") {
        const result = await createVessel(pool, toVesselInput(req.body));
        return reply.send(result);
      }

      if (action === "update") {
        const result = await updateVessel(pool, toVesselInput(req.body));
        return reply.send(result);
      }

      if (action === "delete") {
        const result = await deleteVessel(pool, req.body.no_pk ?? "");
        return reply.send(result);
      }

      if (action === "delete_all") {
        if (!isIT(req)) {
          return reply.send({
            ok: false,
            msg: "Akses ditolak. Hanya Divisi IT yang boleh menghapus semua data.",
          });
        }
        const result = await deleteAllVessels(pool);
        return reply.send(result);
      }

      return reply.send({ ok: false, msg: "Unknown action" });
    }
  );
}
