import type { FastifyInstance, FastifyRequest } from "fastify";
import { dbPool } from "../config/database.js";
import { contentDispositionAttachment } from "../lib/http-headers.js";
import { requireAnyDivisi } from "../plugins/session.js";
import { listJetties } from "../services/jetty.service.js";
import { listShippers } from "../services/shipper.service.js";
import {
  buildSibargesPdfFilename,
  fetchPdfRow,
  fetchPdfRows,
  renderSibargesPdf,
  renderSibargesZip,
} from "../services/sibarges-pdf.service.js";
import {
  buildSibargesTemplateCsv,
  changeVessel,
  createSibarges,
  deleteAllSibarges,
  deleteSibarges,
  getVessel,
  importSibargesCsv,
  listBargeTypeahead,
  listSibarges,
  listTugTypeahead,
  listVesselTypeahead,
  updateSibarges,
  type CreateInput,
  type UpdateInput,
} from "../services/sibarges.service.js";

interface AjaxBody extends Partial<CreateInput & UpdateInput> {
  action?: string;
  id?: string;
  no_pk?: string;
}

interface ListQuery {
  ajax?: string;
  action?: string;
  download?: string;
  id?: string;
  ids?: string;
  q?: string;
  no_pk?: string;
  filter_month?: string;
  filter_no_pk?: string;
  filter_discarded?: string;
  sort_by?: string;
  sort_dir?: string;
}

function isIT(req: FastifyRequest): boolean {
  return (req.session.divisi ?? "").toUpperCase() === "IT";
}

export async function sibargesRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "Operation"]);

  app.get<{ Querystring: ListQuery }>(
    "/sibarges",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");

      if (req.query.download === "sibarges_template") {
        const { filename, csv } = buildSibargesTemplateCsv();
        return reply
          .type("text/csv; charset=utf-8")
          .header("Content-Disposition", contentDispositionAttachment(filename))
          .send(csv);
      }

      if (req.query.download === "si_pdf") {
        const id = Number(req.query.id ?? 0);
        if (!(id > 0)) {
          return reply.code(400).send("ID tidak valid.");
        }
        const row = await fetchPdfRow(pool, id);
        if (!row) {
          return reply.code(404).send("Data SI Barges tidak ditemukan.");
        }
        const buffer = await renderSibargesPdf(row);
        return reply
          .type("application/pdf")
          .header(
            "Content-Disposition",
            `attachment; filename="${buildSibargesPdfFilename(row)}"`
          )
          .send(buffer);
      }

      if (req.query.download === "si_pdf_all") {
        const ids = (req.query.ids ?? "")
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => n > 0);
        if (ids.length === 0) {
          return reply
            .code(400)
            .send("Tidak ada data SI Barges yang dipilih untuk diunduh.");
        }
        const rows = await fetchPdfRows(pool, ids);
        if (rows.length === 0) {
          return reply.code(404).send("Tidak ada data SI Barges untuk diunduh.");
        }
        const buffer = await renderSibargesZip(rows);
        return reply
          .type("application/zip")
          .header("Content-Disposition", 'attachment; filename="All SI.zip"')
          .send(buffer);
      }

      if (req.query.ajax === "1") {
        const action = req.query.action ?? "";

        if (action === "list") {
          const data = await listSibarges(pool, req.query);
          return reply.send({ ok: true, data });
        }

        if (action === "vessel_get") {
          const result = await getVessel(pool, req.query.no_pk ?? "");
          return reply.send(result);
        }

        if (action === "vessel_list") {
          const data = await listVesselTypeahead(pool, req.query.q ?? "");
          return reply.send({ ok: true, data });
        }

        if (action === "tug_list") {
          const data = await listTugTypeahead(pool, req.query.q ?? "");
          return reply.send({ ok: true, data });
        }

        if (action === "barge_list") {
          const data = await listBargeTypeahead(pool, req.query.q ?? "");
          return reply.send({ ok: true, data });
        }

        return reply.send({ ok: false, msg: "Unknown action" });
      }

      const [jettyRows, shipperRows] = await Promise.all([
        listJetties(pool, ""),
        listShippers(pool, ""),
      ]);

      return reply.view("sibarges.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
        jettyRows,
        shipperRows,
      });
    }
  );

  app.post<{ Body: AjaxBody }>(
    "/sibarges",
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
          actionField && "value" in actionField ? String(actionField.value) : "";
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
        const result = await importSibargesCsv(
          pool,
          buffer.toString("utf-8"),
          req.session.username ?? ""
        );
        return reply.send(result);
      }

      const { action } = req.body;

      if (action === "create") {
        const result = await createSibarges(
          pool,
          req.body,
          req.session.username ?? ""
        );
        return reply.send(result);
      }

      if (action === "update") {
        const result = await updateSibarges(pool, req.body);
        return reply.send(result);
      }

      if (action === "change_vessel") {
        const result = await changeVessel(
          pool,
          req.body.id ?? "",
          req.body.no_pk ?? "",
          req.session.username ?? ""
        );
        return reply.send(result);
      }

      if (action === "delete") {
        const result = await deleteSibarges(pool, req.body.id ?? "");
        return reply.send(result);
      }

      if (action === "delete_all") {
        if (!isIT(req)) {
          return reply.send({
            ok: false,
            msg: "Akses ditolak. Hanya Divisi IT yang boleh menghapus semua data.",
          });
        }
        const result = await deleteAllSibarges(pool);
        return reply.send(result);
      }

      return reply.send({ ok: false, msg: "Unknown action" });
    }
  );
}
