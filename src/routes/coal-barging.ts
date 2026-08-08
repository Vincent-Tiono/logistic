import type { FastifyInstance } from "fastify";
import { dbPool } from "../config/database.js";
import { contentDispositionAttachment } from "../lib/http-headers.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  buildCoalBargingGroupedExportCsv,
  buildCoalBargingOperationTemplateCsv,
  createCoalBargingRcRow,
  deleteCoalBargingRow,
  importCoalBargingCsv,
  importCoalBargingFromTlu,
  inputCoalBargingRcRow,
  listAllVesselOperations,
  listCoalBargingByVessel,
  listUnusedRcOptions,
  saveCoalBargingOperationData,
  seedCoalBargingFromTlu,
} from "../services/coal-barging.service.js";
import { listOperationOptionLists, listVesselPeriods } from "../services/tlu-operation.service.js";

interface ListQuery {
  ajax?: string;
  action?: string;
  no_pk?: string;
  download?: string;
  scope?: string;
  year?: string;
  month?: string;
}

/** Port of PHP's filter_var($value, FILTER_VALIDATE_INT): returns null for
 * blank/non-integer input instead of NaN. */
function parseIntOrNull(value: string | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

interface WriteBody {
  action?: string;
  row_type?: unknown;
  sibarges_id?: unknown;
  rc_row_id?: unknown;
  target_sibarges_id?: unknown;
  delete_scope?: unknown;
  data?: Record<string, unknown>;
  operation_data?: unknown;
  operation_remarks?: unknown;
  no_pk?: unknown;
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

      if (req.query.download === "tlu_grouped_export") {
        const result = await buildCoalBargingGroupedExportCsv(
          pool,
          (req.query.scope ?? "").trim(),
          {
            noPk: req.query.no_pk,
            year: parseIntOrNull(req.query.year),
            month: parseIntOrNull(req.query.month),
          }
        );
        if (!result.ok) {
          return reply.code(result.status).send(result.msg);
        }
        return reply
          .type("text/csv; charset=utf-8")
          .header("Content-Disposition", contentDispositionAttachment(result.filename))
          .send(result.csv);
      }

      if (req.query.download === "tlu_operation_template") {
        const result = await buildCoalBargingOperationTemplateCsv(pool, req.query.no_pk ?? "");
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
      // Reused from TLU Operation: same `flf` table, same PBM Vendor /
      // Floating Crane option-list shape the edit modal's selects need
      // (9coalbarging.php:1674-1696). bargeVendorOptions is unused here —
      // Coal Barging has no barge_vendor field.
      const optionLists = await listOperationOptionLists(pool);

      return reply.view("coal-barging.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
        vesselPeriods,
        optionLists,
      });
    }
  );

  app.post<{ Body: WriteBody }>(
    "/coal-barging",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");
      const coalPool = dbPool("datacoalbarging");
      const createdBy = req.session.username ?? "";

      // Legacy runs this unconditionally on every request (see the GET
      // handler's own call and seedCoalBargingFromTlu's doc comment).
      await seedCoalBargingFromTlu(coalPool);

      if (req.isMultipart()) {
        const file = await req.file();
        if (!file) {
          return reply.send({ ok: false, msg: "File CSV tidak valid atau gagal diunggah." });
        }
        const actionField = file.fields?.action;
        const action = actionField && "value" in actionField ? String(actionField.value) : "";
        if (action !== "import_operation_csv") {
          return reply.send({ ok: false, msg: "Unknown action" });
        }
        const noPkField = file.fields?.no_pk;
        const noPk = noPkField && "value" in noPkField ? String(noPkField.value) : "";
        const buffer = await file.toBuffer();
        const result = await importCoalBargingCsv(
          pool,
          coalPool,
          noPk,
          buffer.toString("utf-8"),
          createdBy
        );
        return reply.send(result);
      }

      const { action } = req.body;

      if (action === "save_operation_data") {
        const result = await saveCoalBargingOperationData(pool, coalPool, req.body, createdBy);
        return reply.send(result);
      }

      if (action === "create_rc_row") {
        const result = await createCoalBargingRcRow(pool, coalPool, req.body, createdBy);
        return reply.send(result);
      }

      if (action === "delete_coal_barging_row") {
        const result = await deleteCoalBargingRow(pool, coalPool, req.body, createdBy);
        return reply.send(result);
      }

      if (action === "import_from_tlu_operation") {
        const result = await importCoalBargingFromTlu(pool, coalPool, req.body.no_pk);
        return reply.send(result);
      }

      if (action === "input_rc_row") {
        const result = await inputCoalBargingRcRow(pool, coalPool, req.body);
        return reply.send(result);
      }

      return reply.send({ ok: false, msg: "Unknown action" });
    }
  );
}
