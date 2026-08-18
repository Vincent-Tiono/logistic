import type { FastifyInstance } from "fastify";
import { dbPool } from "../config/database.js";
import { contentDispositionAttachment } from "../lib/http-headers.js";
import { buildQueryString } from "../lib/query-string.js";
import { requireAnyDivisi } from "../plugins/session.js";
import {
  DEFAULT_DENDA_DEMURRAGE,
  buildSpalDocx,
  buildSpalFilename,
  createSpalAgreement,
  formatRupiahAmount,
  getSpalAgreementById,
  listSpalAgreements,
} from "../services/spal.service.js";

interface SpalFormValues {
  nomor: string;
  tanggal: string;
  nama_pt: string;
  alamat: string;
  uang_tambang: string;
  jetty_muat: string;
  jetty_bongkar: string;
  denda_demurrage: string;
  nama_penandatangan: string;
  jabatan: string;
}

interface SpalQuerystring {
  dari?: string;
  sampai?: string;
  customer?: string;
  page?: string;
  download?: string;
  id?: string;
}

interface SpalBody {
  nomor?: string;
  tanggal?: string;
  nama_pt?: string;
  alamat?: string;
  uang_tambang?: string;
  jetty_muat?: string;
  jetty_bongkar?: string;
  denda_demurrage?: string;
  nama_penandatangan?: string;
  jabatan?: string;
}

function parseRupiahInput(raw: string | undefined): number {
  return Number(String(raw ?? "0").replace(/[^\d.-]/g, "")) || 0;
}

export async function spalRoutes(app: FastifyInstance) {
  const requireGate = requireAnyDivisi(["IT", "VM&FAT"]);

  app.get<{ Querystring: SpalQuerystring }>(
    "/spal",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");

      if (req.query.download === "agreement") {
        const id = Number.parseInt(req.query.id ?? "", 10);
        if (!(id > 0)) return reply.code(400).send("ID tidak valid.");
        const agreement = await getSpalAgreementById(pool, id);
        if (!agreement) {
          return reply.code(404).send("Data SPAL tidak ditemukan.");
        }
        const buffer = buildSpalDocx(agreement);
        return reply
          .type(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          )
          .header(
            "Content-Disposition",
            contentDispositionAttachment(buildSpalFilename(agreement))
          )
          .send(buffer);
      }

      const dari = req.query.dari ?? "";
      const sampai = req.query.sampai ?? "";
      const customer = req.query.customer ?? "";
      const page = Math.max(1, Number.parseInt(req.query.page ?? "1", 10) || 1);
      const result = await listSpalAgreements(pool, {
        dari: dari || undefined,
        sampai: sampai || undefined,
        customer: customer || undefined,
        page,
      });
      const pageUrl = (p: number) =>
        buildQueryString({ dari, sampai, customer, page: String(p) });
      const today = new Date().toISOString().slice(0, 10);

      return reply.view("spal.ejs", {
        username: req.session.username,
        divisi: req.session.divisi,
        dariInput: dari,
        sampaiInput: sampai,
        customerInput: customer,
        rows: result.pageData,
        page: result.page,
        totalPages: result.totalPages,
        totalRows: result.totalRows,
        pageUrl,
        formatRupiahAmount,
        formValues: {
          nomor: "",
          tanggal: today,
          nama_pt: "",
          alamat: "",
          uang_tambang: "",
          jetty_muat: "",
          jetty_bongkar: "",
          denda_demurrage: String(DEFAULT_DENDA_DEMURRAGE),
          nama_penandatangan: "",
          jabatan: "",
        } satisfies SpalFormValues,
        error: null,
      });
    }
  );

  app.post<{ Body: SpalBody; Querystring: SpalQuerystring }>(
    "/spal",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");

      const result = await createSpalAgreement(pool, {
        nomor: req.body.nomor ?? "",
        tanggal: req.body.tanggal ?? "",
        namaPt: req.body.nama_pt ?? "",
        alamat: req.body.alamat ?? "",
        uangTambang: parseRupiahInput(req.body.uang_tambang),
        jettyMuat: req.body.jetty_muat ?? "",
        jettyBongkar: req.body.jetty_bongkar ?? "",
        dendaDemurrage: req.body.denda_demurrage
          ? parseRupiahInput(req.body.denda_demurrage)
          : DEFAULT_DENDA_DEMURRAGE,
        namaPenandatangan: req.body.nama_penandatangan ?? "",
        jabatan: req.body.jabatan ?? "",
        createdBy: req.session.username,
      });

      if (!result.ok) {
        const listResult = await listSpalAgreements(pool, {});
        return reply.code(400).view("spal.ejs", {
          username: req.session.username,
          divisi: req.session.divisi,
          dariInput: "",
          sampaiInput: "",
          customerInput: "",
          rows: listResult.pageData,
          page: listResult.page,
          totalPages: listResult.totalPages,
          totalRows: listResult.totalRows,
          pageUrl: (p: number) => buildQueryString({ page: String(p) }),
          formatRupiahAmount,
          formValues: {
            nomor: req.body.nomor ?? "",
            tanggal: req.body.tanggal ?? "",
            nama_pt: req.body.nama_pt ?? "",
            alamat: req.body.alamat ?? "",
            uang_tambang: req.body.uang_tambang ?? "",
            jetty_muat: req.body.jetty_muat ?? "",
            jetty_bongkar: req.body.jetty_bongkar ?? "",
            denda_demurrage:
              req.body.denda_demurrage ?? String(DEFAULT_DENDA_DEMURRAGE),
            nama_penandatangan: req.body.nama_penandatangan ?? "",
            jabatan: req.body.jabatan ?? "",
          } satisfies SpalFormValues,
          error: result.error,
        });
      }

      const agreement = await getSpalAgreementById(pool, result.id);
      const buffer = buildSpalDocx(agreement!);
      return reply
        .type(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        .header(
          "Content-Disposition",
          contentDispositionAttachment(buildSpalFilename(agreement!))
        )
        .send(buffer);
    }
  );
}
