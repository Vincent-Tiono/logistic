import type { FastifyInstance } from "fastify";
import { dbPool } from "../config/database.js";
import { contentDispositionAttachment } from "../lib/http-headers.js";
import { buildQueryString } from "../lib/query-string.js";
import { requireAnyDivisi } from "../plugins/session.js";
import { listBarges } from "../services/barges.service.js";
import { listJetties } from "../services/jetty.service.js";
import { listShippers } from "../services/shipper.service.js";
import {
  buildSpalDocx,
  buildSpalFilename,
  createSpalAgreement,
  deleteSpalAgreement,
  formatRupiahAmount,
  getSpalAgreementById,
  listSpalAgreements,
  SPAL_PAGE_SIZES,
  updateSpalAgreement,
  type SpalKapalPair,
  type SpalUpdateInput,
} from "../services/spal.service.js";

interface SpalFormValues {
  operator: string;
  kode_customer: string;
  nama_pt: string;
  alamat: string;
  uang_tambang: string;
  deadfreight: string;
  jetty_muat: string;
  jetty_bongkar: string;
  kesediaan_kapal_mulai: string;
  kesediaan_kapal_selesai: string;
  posisi_kapal: string;
  total_hari_muat_bongkar: string;
  denda_demurrage: string;
  nama_penandatangan: string;
  jabatan: string;
  kapalPairs: SpalKapalPair[];
}

interface SpalQuerystring {
  dari?: string;
  sampai?: string;
  customer?: string;
  page?: string;
  per_page?: string;
  download?: string;
  id?: string;
}

interface SpalBody {
  operator?: string;
  kode_customer?: string;
  nama_pt?: string;
  alamat?: string;
  uang_tambang?: string;
  deadfreight?: string;
  jetty_muat?: string;
  jetty_bongkar?: string;
  kesediaan_kapal_mulai?: string;
  kesediaan_kapal_selesai?: string;
  posisi_kapal?: string;
  total_hari_muat_bongkar?: string;
  denda_demurrage?: string;
  nama_penandatangan?: string;
  jabatan?: string;
  kapal_tugboat?: string | string[];
  kapal_barge?: string | string[];
}

interface SpalPatchBody {
  operator?: string;
  kode_customer?: string;
  nama_pt?: string;
  alamat?: string;
  uang_tambang?: string;
  deadfreight?: string;
  jetty_muat?: string;
  jetty_bongkar?: string;
  kesediaan_kapal_mulai?: string;
  kesediaan_kapal_selesai?: string;
  posisi_kapal?: string;
  total_hari_muat_bongkar?: string;
  denda_demurrage?: string;
  nama_penandatangan?: string;
  jabatan?: string;
  kapal_tugboat?: string | string[];
  kapal_barge?: string | string[];
}

function parseRupiahInput(raw: string | undefined): number {
  return Number(String(raw ?? "0").replace(/[^\d.-]/g, "")) || 0;
}

function toArray(raw: string | string[] | undefined): string[] {
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Tugboat/barge are independent selects (one row = one array index each) —
 * zipped by position rather than a combined dropdown, so any tugboat can
 * pair with any barge. */
function zipKapalInputs(
  tugboatRaw: string | string[] | undefined,
  bargeRaw: string | string[] | undefined
): SpalKapalPair[] {
  const tugboats = toArray(tugboatRaw);
  const barges = toArray(bargeRaw);
  const len = Math.max(tugboats.length, barges.length);
  const pairs: SpalKapalPair[] = [];
  for (let i = 0; i < len; i++) {
    pairs.push({
      tugboat: (tugboats[i] ?? "").trim(),
      barge: (barges[i] ?? "").trim(),
    });
  }
  return pairs;
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
      const perPage = Number.parseInt(req.query.per_page ?? "", 10);
      const [result, shipperRows, bargesRows, jettyRows] = await Promise.all([
        listSpalAgreements(pool, {
          dari: dari || undefined,
          sampai: sampai || undefined,
          customer: customer || undefined,
          page,
          perPage: Number.isFinite(perPage) ? perPage : undefined,
        }),
        listShippers(pool, ""),
        listBarges(pool, "", undefined, undefined),
        listJetties(pool, ""),
      ]);
      const tugboatOptions = [...new Set(bargesRows.map((b) => b.tugboat))].sort();
      const bargeOptions = [...new Set(bargesRows.map((b) => b.barge))].sort();
      const pageUrl = (p: number) =>
        buildQueryString({ dari, sampai, customer, page: String(p), per_page: String(result.perPage) });

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
        perPage: result.perPage,
        pageSizes: SPAL_PAGE_SIZES,
        pageUrl,
        formatRupiahAmount,
        shipperRows,
        jettyRows,
        tugboatOptions,
        bargeOptions,
        formValues: {
          operator: "",
          kode_customer: "",
          nama_pt: "",
          alamat: "",
          uang_tambang: "",
          deadfreight: "",
          jetty_muat: "",
          jetty_bongkar: "",
          kesediaan_kapal_mulai: "",
          kesediaan_kapal_selesai: "",
          posisi_kapal: "",
          total_hari_muat_bongkar: "",
          denda_demurrage: "",
          nama_penandatangan: "",
          jabatan: "",
          kapalPairs: [],
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
      const wantsJson = (req.headers.accept ?? "").includes("application/json");
      const kapalPairs = zipKapalInputs(
        req.body.kapal_tugboat,
        req.body.kapal_barge
      ).filter((pair) => pair.tugboat || pair.barge);

      const result = await createSpalAgreement(pool, {
        operator: req.body.operator ?? "",
        kodeCustomer: req.body.kode_customer ?? "",
        namaPt: req.body.nama_pt ?? "",
        alamat: req.body.alamat ?? "",
        uangTambang: parseRupiahInput(req.body.uang_tambang),
        deadfreight: parseRupiahInput(req.body.deadfreight),
        jettyMuat: req.body.jetty_muat ?? "",
        jettyBongkar: req.body.jetty_bongkar ?? "",
        kesediaanKapalMulai: req.body.kesediaan_kapal_mulai ?? "",
        kesediaanKapalSelesai: req.body.kesediaan_kapal_selesai ?? "",
        posisiKapal: req.body.posisi_kapal ?? "",
        totalHariMuatBongkar: req.body.total_hari_muat_bongkar ?? "",
        dendaDemurrage: parseRupiahInput(req.body.denda_demurrage),
        namaPenandatangan: req.body.nama_penandatangan ?? "",
        jabatan: req.body.jabatan ?? "",
        kapal: kapalPairs,
        createdBy: req.session.username,
      });

      if (!result.ok) {
        if (wantsJson) {
          return reply.code(400).send({ ok: false, error: result.error });
        }
        const [listResult, shipperRows, bargesRows, jettyRows] = await Promise.all([
          listSpalAgreements(pool, {}),
          listShippers(pool, ""),
          listBarges(pool, "", undefined, undefined),
          listJetties(pool, ""),
        ]);
        const tugboatOptions = [...new Set(bargesRows.map((b) => b.tugboat))].sort();
        const bargeOptions = [...new Set(bargesRows.map((b) => b.barge))].sort();
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
          perPage: listResult.perPage,
          pageSizes: SPAL_PAGE_SIZES,
          pageUrl: (p: number) =>
            buildQueryString({ page: String(p), per_page: String(listResult.perPage) }),
          formatRupiahAmount,
          shipperRows,
          jettyRows,
          tugboatOptions,
          bargeOptions,
          formValues: {
            operator: req.body.operator ?? "",
            kode_customer: req.body.kode_customer ?? "",
            nama_pt: req.body.nama_pt ?? "",
            alamat: req.body.alamat ?? "",
            uang_tambang: req.body.uang_tambang ?? "",
            deadfreight: req.body.deadfreight ?? "",
            jetty_muat: req.body.jetty_muat ?? "",
            jetty_bongkar: req.body.jetty_bongkar ?? "",
            kesediaan_kapal_mulai: req.body.kesediaan_kapal_mulai ?? "",
            kesediaan_kapal_selesai: req.body.kesediaan_kapal_selesai ?? "",
            posisi_kapal: req.body.posisi_kapal ?? "",
            total_hari_muat_bongkar: req.body.total_hari_muat_bongkar ?? "",
            denda_demurrage: req.body.denda_demurrage ?? "",
            nama_penandatangan: req.body.nama_penandatangan ?? "",
            jabatan: req.body.jabatan ?? "",
            kapalPairs,
          } satisfies SpalFormValues,
          error: result.error,
        });
      }

      const agreement = await getSpalAgreementById(pool, result.id);

      if (wantsJson) {
        return reply.send({
          ok: true,
          id: agreement!.id,
          downloadUrl: `/spal?download=agreement&id=${agreement!.id}`,
          row: {
            operator: agreement!.operator,
            nomor: agreement!.nomor,
            namaPt: agreement!.namaPt,
            kapal: agreement!.kapal,
            uangTambang: formatRupiahAmount(agreement!.uangTambang),
            jettyMuat: agreement!.jettyMuat,
            jettyBongkar: agreement!.jettyBongkar,
            dendaDemurrage: formatRupiahAmount(agreement!.dendaDemurrage),
            kesediaanKapalMulai: agreement!.kesediaanKapalMulai,
            kesediaanKapalSelesai: agreement!.kesediaanKapalSelesai,
            posisiKapal: agreement!.posisiKapal,
            totalHariMuatBongkar: agreement!.totalHariMuatBongkar,
            namaPenandatangan: agreement!.namaPenandatangan,
            jabatan: agreement!.jabatan,
          },
        });
      }

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

  app.patch<{ Params: { id: string }; Body: SpalPatchBody }>(
    "/spal/:id",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");
      const id = Number.parseInt(req.params.id, 10);
      if (!(id > 0)) {
        return reply.code(400).send({ ok: false, error: "ID tidak valid." });
      }

      const body = req.body;
      const patch: SpalUpdateInput = {};
      if (body.operator !== undefined) patch.operator = body.operator;
      if (body.kode_customer !== undefined) patch.kodeCustomer = body.kode_customer;
      if (body.nama_pt !== undefined) patch.namaPt = body.nama_pt;
      if (body.alamat !== undefined) patch.alamat = body.alamat;
      if (body.uang_tambang !== undefined) patch.uangTambang = parseRupiahInput(body.uang_tambang);
      if (body.deadfreight !== undefined) patch.deadfreight = parseRupiahInput(body.deadfreight);
      if (body.jetty_muat !== undefined) patch.jettyMuat = body.jetty_muat;
      if (body.jetty_bongkar !== undefined) patch.jettyBongkar = body.jetty_bongkar;
      if (body.kesediaan_kapal_mulai !== undefined) patch.kesediaanKapalMulai = body.kesediaan_kapal_mulai;
      if (body.kesediaan_kapal_selesai !== undefined) patch.kesediaanKapalSelesai = body.kesediaan_kapal_selesai;
      if (body.posisi_kapal !== undefined) patch.posisiKapal = body.posisi_kapal;
      if (body.total_hari_muat_bongkar !== undefined) patch.totalHariMuatBongkar = body.total_hari_muat_bongkar;
      if (body.denda_demurrage !== undefined) patch.dendaDemurrage = parseRupiahInput(body.denda_demurrage);
      if (body.nama_penandatangan !== undefined) patch.namaPenandatangan = body.nama_penandatangan;
      if (body.jabatan !== undefined) patch.jabatan = body.jabatan;
      if (body.kapal_tugboat !== undefined || body.kapal_barge !== undefined) {
        patch.kapal = zipKapalInputs(body.kapal_tugboat, body.kapal_barge).filter(
          (pair) => pair.tugboat || pair.barge
        );
      }

      const result = await updateSpalAgreement(pool, id, patch);
      if (!result.ok) {
        return reply.code(400).send(result);
      }

      const agreement = await getSpalAgreementById(pool, id);
      return reply.send({
        ok: true,
        row: {
          id: agreement!.id,
          nomor: agreement!.nomor,
          namaPt: agreement!.namaPt,
          kapal: agreement!.kapal,
          uangTambang: formatRupiahAmount(agreement!.uangTambang),
          jettyMuat: agreement!.jettyMuat,
          jettyBongkar: agreement!.jettyBongkar,
          dendaDemurrage: formatRupiahAmount(agreement!.dendaDemurrage),
          kesediaanKapalMulai: agreement!.kesediaanKapalMulai,
          kesediaanKapalSelesai: agreement!.kesediaanKapalSelesai,
          posisiKapal: agreement!.posisiKapal,
          totalHariMuatBongkar: agreement!.totalHariMuatBongkar,
          namaPenandatangan: agreement!.namaPenandatangan,
          jabatan: agreement!.jabatan,
        },
      });
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/spal/:id",
    { preHandler: requireGate },
    async (req, reply) => {
      const pool = dbPool("databarging");
      const id = Number.parseInt(req.params.id, 10);
      if (!(id > 0)) {
        return reply.code(400).send({ ok: false, error: "ID tidak valid." });
      }
      const result = await deleteSpalAgreement(pool, id);
      if (!result.ok) {
        return reply.code(404).send(result);
      }
      return reply.send(result);
    }
  );
}
