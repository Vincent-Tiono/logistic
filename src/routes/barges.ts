import type { FastifyInstance, FastifyRequest } from "fastify";
import { dbPool } from "../config/database.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  createBarges,
  deleteAllBarges,
  deleteBarges,
  importBargesCsv,
  listBarges,
  updateBarges,
  type BargesInput,
} from "../services/barges.service.js";

interface AjaxBody extends Partial<BargesInput> {
  action?: string;
}

interface ListQuery {
  ajax?: string;
  action?: string;
  q?: string;
  sort?: string;
  dir?: string;
}

function isIT(req: FastifyRequest): boolean {
  return (req.session.divisi ?? "").toUpperCase() === "IT";
}

function toBargesInput(body: AjaxBody): BargesInput {
  return {
    id: body.id ?? "",
    tugboat: body.tugboat ?? "",
    barge: body.barge ?? "",
    vendor: body.vendor ?? "",
    kontrak: body.kontrak ?? "",
    muatan: body.muatan ?? "",
    penalty: body.penalty ?? "",
  };
}

export async function bargesRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "Operation"]);

  app.get<{ Querystring: ListQuery }>(
    "/barges",
    { preHandler: requireGate },
    async (req, reply) => {
      if (req.query.ajax === "1") {
        if (req.query.action === "list") {
          const pool = dbPool("databarging");
          const data = await listBarges(
            pool,
            req.query.q ?? "",
            req.query.sort,
            req.query.dir
          );
          return reply.send({ ok: true, data });
        }
        return reply.send({ ok: false, msg: "Unknown action" });
      }

      return reply.view("barges.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
      });
    }
  );

  app.post<{ Body: AjaxBody }>(
    "/barges",
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
        if (action !== "import_csv") {
          return reply.send({ ok: false, msg: "Unknown action" });
        }
        if (!isIT(req)) {
          return reply.send({ ok: false, msg: "Akses ditolak. Hanya Divisi IT yang boleh import CSV." });
        }
        const buffer = await file.toBuffer();
        const result = await importBargesCsv(pool, buffer.toString("utf-8"));
        return reply.send(result);
      }

      const { action } = req.body;

      if (action === "create") {
        const result = await createBarges(pool, toBargesInput(req.body));
        return reply.send(result);
      }
      if (action === "update") {
        const result = await updateBarges(pool, toBargesInput(req.body));
        return reply.send(result);
      }
      if (action === "delete") {
        const result = await deleteBarges(pool, req.body.id ?? "");
        return reply.send(result);
      }
      if (action === "delete_all") {
        if (!isIT(req)) {
          return reply.send({ ok: false, msg: "Akses ditolak. Hanya Divisi IT yang boleh menghapus semua data." });
        }
        const result = await deleteAllBarges(pool);
        return reply.send(result);
      }

      return reply.send({ ok: false, msg: "Unknown action" });
    }
  );
}
