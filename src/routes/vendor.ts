import type { FastifyInstance, FastifyRequest } from "fastify";
import { dbPool } from "../config/database.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  createVendor,
  deleteAllVendors,
  deleteVendor,
  importVendorCsv,
  listVendors,
  updateVendor,
  type VendorInput,
} from "../services/vendor.service.js";

interface AjaxBody extends Partial<VendorInput> {
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

function toVendorInput(body: AjaxBody): VendorInput {
  return {
    id: body.id ?? "",
    vendor: body.vendor ?? "",
    shipper: body.shipper ?? "",
    freight: body.freight ?? "",
    tonnage: body.tonnage ?? "",
    penalty: body.penalty ?? "",
    discount: body.discount ?? "",
    contract: body.contract ?? "",
    laytime: body.laytime ?? "",
    ltc_rate: body.ltc_rate ?? "",
  };
}

export async function vendorRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "Operation"]);

  app.get<{ Querystring: ListQuery }>(
    "/vendor",
    { preHandler: requireGate },
    async (req, reply) => {
      if (req.query.ajax === "1") {
        if (req.query.action === "list") {
          const pool = dbPool("databarging");
          const data = await listVendors(
            pool,
            req.query.q ?? "",
            req.query.sort,
            req.query.dir
          );
          return reply.send({ ok: true, data });
        }
        return reply.send({ ok: false, msg: "Unknown action" });
      }

      return reply.view("vendor.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
      });
    }
  );

  app.post<{ Body: AjaxBody }>(
    "/vendor",
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
        const result = await importVendorCsv(pool, buffer.toString("utf-8"));
        return reply.send(result);
      }

      const { action } = req.body;

      if (action === "create") {
        const result = await createVendor(pool, toVendorInput(req.body));
        return reply.send(result);
      }

      if (action === "update") {
        const result = await updateVendor(pool, toVendorInput(req.body));
        return reply.send(result);
      }

      if (action === "delete") {
        const result = await deleteVendor(pool, req.body.id ?? "");
        return reply.send(result);
      }

      if (action === "delete_all") {
        if (!isIT(req)) {
          return reply.send({
            ok: false,
            msg: "Akses ditolak. Hanya Divisi IT yang boleh menghapus semua data.",
          });
        }
        const result = await deleteAllVendors(pool);
        return reply.send(result);
      }

      return reply.send({ ok: false, msg: "Unknown action" });
    }
  );
}
