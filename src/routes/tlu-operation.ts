import type { FastifyInstance, FastifyRequest } from "fastify";
import { dbPool } from "../config/database.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  buildOperationTemplateCsv,
  importOperationCsv,
  listAllActiveOperations,
  listGroupedExportRows,
  listOperationOptionLists,
  listSiBargesByVessel,
  listVesselPeriods,
  saveOperationData,
} from "../services/tlu-operation.service.js";

interface ListQuery {
  ajax?: string;
  action?: string;
  no_pk?: string;
  download?: string;
  scope?: string;
  year?: string;
  month?: string;
}

interface SaveOperationBody {
  action?: string;
  sibarges_id?: unknown;
  data?: Record<string, unknown>;
}

function isIT(req: FastifyRequest): boolean {
  return (req.session.divisi ?? "").toUpperCase() === "IT";
}

/** Port of PHP's filter_var($value, FILTER_VALIDATE_INT): returns null for
 * blank/non-integer input instead of NaN. */
function parseIntOrNull(value: string | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** Filenames here can contain non-ASCII (an em dash between no_pk and
 * mothervessel). Unlike PHP's header(), which writes whatever raw bytes it's
 * given, Fastify re-encodes header string values as UTF-8 when writing the
 * response, corrupting a literal non-ASCII character in `filename=`. RFC
 * 6266's `filename*` extension carries the real name as percent-encoded
 * (pure-ASCII) UTF-8 instead, with a sanitized ASCII fallback in `filename=`
 * for clients that don't support it. */
function contentDispositionAttachment(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function tluOperationRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "Operation"]);

  app.get<{ Querystring: ListQuery }>(
    "/tlu-operation",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");

      if (req.query.download === "tlu_operation_template") {
        const scope = (req.query.scope ?? "vessel").trim();
        if (scope === "year" && !isIT(req)) {
          return reply
            .code(403)
            .send("Akses ditolak. Hanya Divisi IT yang boleh mengunduh template 1 tahun.");
        }

        const result = await buildOperationTemplateCsv(pool, scope, {
          noPk: req.query.no_pk,
          year: parseIntOrNull(req.query.year),
        });
        if (!result.ok) {
          return reply.code(result.status).send(result.msg);
        }
        return reply
          .type("text/csv; charset=utf-8")
          .header("Content-Disposition", contentDispositionAttachment(result.filename))
          .send(result.csv);
      }

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

        if (action === "tlu_grouped_export_data") {
          const result = await listGroupedExportRows(pool, (req.query.scope ?? "").trim(), {
            noPk: req.query.no_pk,
            year: parseIntOrNull(req.query.year),
            month: parseIntOrNull(req.query.month),
          });
          return reply.send(result);
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
