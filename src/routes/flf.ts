import type { FastifyInstance, FastifyRequest } from "fastify";
import { dbPool } from "../config/database.js";
import { contentDispositionAttachment } from "../lib/http-headers.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  buildFlfTemplateCsv,
  createFlf,
  deleteAllFlf,
  deleteFlf,
  importFlfCsv,
  listFlf,
  updateFlf,
  type FlfInput,
} from "../services/flf.service.js";

interface AjaxBody extends Partial<FlfInput> {
  action?: string;
}

interface ListQuery {
  ajax?: string;
  action?: string;
  download?: string;
  q?: string;
}

function isIT(req: FastifyRequest): boolean {
  return (req.session.divisi ?? "").toUpperCase() === "IT";
}

function toFlfInput(body: AjaxBody): FlfInput {
  return {
    floating_crane: body.floating_crane ?? "",
    vendor_flf: body.vendor_flf ?? "",
    pbm: body.pbm ?? "",
    anchorage: body.anchorage ?? "",
  };
}

export async function flfRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "Operation"]);

  app.get<{ Querystring: ListQuery }>(
    "/flf",
    { preHandler: requireGate },
    async (req, reply) => {
      if (req.query.download === "flf_template") {
        const { filename, csv } = buildFlfTemplateCsv();
        return reply
          .type("text/csv; charset=utf-8")
          .header("Content-Disposition", contentDispositionAttachment(filename))
          .send(csv);
      }

      if (req.query.ajax === "1") {
        if (req.query.action === "list") {
          const pool = dbPool("databarging");
          const data = await listFlf(pool, req.query.q ?? "");
          return reply.send({ ok: true, data });
        }
        return reply.send({ ok: false, msg: "Unknown action" });
      }

      return reply.view("flf.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
      });
    }
  );

  app.post<{ Body: AjaxBody }>(
    "/flf",
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
        const result = await importFlfCsv(pool, buffer.toString("utf-8"));
        return reply.send(result);
      }

      const { action } = req.body;

      if (action === "create") {
        const result = await createFlf(pool, toFlfInput(req.body));
        return reply.send(result);
      }

      if (action === "update") {
        const result = await updateFlf(pool, toFlfInput(req.body));
        return reply.send(result);
      }

      if (action === "delete") {
        const result = await deleteFlf(pool, req.body.floating_crane ?? "");
        return reply.send(result);
      }

      if (action === "delete_all") {
        if (!isIT(req)) {
          return reply.send({
            ok: false,
            msg: "Akses ditolak. Hanya Divisi IT yang boleh menghapus semua data.",
          });
        }
        const result = await deleteAllFlf(pool);
        return reply.send(result);
      }

      return reply.send({ ok: false, msg: "Unknown action" });
    }
  );
}
