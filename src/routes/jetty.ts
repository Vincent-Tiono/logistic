import type { FastifyInstance, FastifyRequest } from "fastify";
import { dbPool } from "../config/database.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  createJetty,
  deleteAllJetties,
  deleteJetty,
  importJettyCsv,
  listJetties,
  updateJetty,
  type JettyInput,
} from "../services/jetty.service.js";

interface AjaxBody extends Partial<JettyInput> {
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

function toJettyInput(body: AjaxBody): JettyInput {
  return {
    jetty: body.jetty ?? "",
    nama_panjang: body.nama_panjang ?? "",
  };
}

export async function jettyRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "Operation"]);

  app.get<{ Querystring: ListQuery }>(
    "/jetty",
    { preHandler: requireGate },
    async (req, reply) => {
      if (req.query.ajax === "1") {
        if (req.query.action === "list") {
          const pool = dbPool("databarging");
          const data = await listJetties(pool, req.query.q ?? "");
          return reply.send({ ok: true, data });
        }
        return reply.send({ ok: false, msg: "Unknown action" });
      }

      return reply.view("jetty.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
      });
    }
  );

  app.post<{ Body: AjaxBody }>(
    "/jetty",
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
        const result = await importJettyCsv(pool, buffer.toString("utf-8"));
        return reply.send(result);
      }

      const { action } = req.body;

      if (action === "create") {
        const result = await createJetty(pool, toJettyInput(req.body));
        return reply.send(result);
      }

      if (action === "update") {
        const result = await updateJetty(pool, toJettyInput(req.body));
        return reply.send(result);
      }

      if (action === "delete") {
        const result = await deleteJetty(pool, req.body.jetty ?? "");
        return reply.send(result);
      }

      if (action === "delete_all") {
        if (!isIT(req)) {
          return reply.send({
            ok: false,
            msg: "Akses ditolak. Hanya Divisi IT yang boleh menghapus semua data.",
          });
        }
        const result = await deleteAllJetties(pool);
        return reply.send(result);
      }

      return reply.send({ ok: false, msg: "Unknown action" });
    }
  );
}
