import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COAL_BARGING_CSV_COLUMNS } from "../../src/services/coal-barging.service.js";
import {
  deleteCoalBargeDeletedRow,
  deleteCoalBargeOperationRowsBySibargesId,
  deleteCoalBargeRcRow,
  getCoalBargeOperationRow,
  getCoalBargeRcRow,
  seedCoalBargeDeletedRow,
  seedCoalBargeOperationRow,
  seedCoalBargeRcRow,
} from "./coal-barging-fixture.js";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { deleteFlfRow, seedFlfRow } from "./flf-fixture.js";
import { HttpClient } from "./http-client.js";
import { deleteJettyRow, seedJettyRow } from "./jetty-fixture.js";
import { deleteShipperRow, seedShipperRow } from "./shipper-fixture.js";
import { deleteSibargesRow, getSibargesRow, seedSibargesRow } from "./sibarges-fixture.js";
import { targets } from "./targets.js";
import {
  deleteBargeOperationRowsBySibargesId,
  seedBargeOperationRow,
} from "./tlu-operation-fixture.js";
import { deleteVesselRow, seedVesselRow } from "./vessel-fixture.js";

interface AjaxResult {
  ok: boolean;
  msg?: string;
  data?: any;
  rc_row_id?: number;
  updated?: number;
  errors?: number;
  partial?: boolean;
  deleted?: number;
  imported?: number;
}

interface ByVesselRow {
  id: number;
  sibarges_id: number;
  row_type: "base" | "rc";
  is_rc_clone: number;
  no_pk: string;
  buyer: string;
  mothervessel: string;
  operation_data: unknown;
}

interface UnusedRcRow {
  rc_row_id: number;
  target_sibarges_id: number;
  no_pk: string;
  buyer: string;
  mothervessel: string;
  anchorage: string;
}

interface VesselGroup {
  no_pk: string;
  mothervessel: string;
  earliest_laycan_start: string | null;
  rows: { id: number; source_sibarges_id: number; row_type: "base" | "rc" }[];
}

function decodeOperationData(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (!value) return {};
  return JSON.parse(String(value));
}

describe.each(targets)("coal-barging — $name", (target) => {
  const uid = randomUUID().slice(0, 8);
  const opUser = `op_${uid}`;
  const opPassword = "op-test-pass";

  const noPk = `CB.${uid}`;
  const mothervessel = `MV CB ${uid}`;
  const jettyCode = `JT${uid.slice(0, 6)}`.toUpperCase();
  const shipperCode = `SH${uid.slice(0, 6)}`.toUpperCase();
  const sharedTugboat = `TB.${uid}`;

  let sibargesId1: number;
  let sibargesId2: number;

  const isPhp = target.name.startsWith("PHP");

  beforeEach(async () => {
    await seedLegacyUser(opUser, opPassword, "Staff", "Operation");

    await seedVesselRow({
      no_pk: noPk,
      no_si_vessel: "090",
      buyer: "BUYER TEST",
      mothervessel,
      anchorage: "MUARA BERAU",
      term: "FOB",
    });
    await seedJettyRow({ jetty: jettyCode, nama_panjang: "JETTY TEST" });
    await seedShipperRow({
      shipper: shipperCode,
      pt: "PT TEST",
      nama_lengkap: "PT TEST SHIPPER",
    });

    sibargesId1 = await seedSibargesRow({
      no_pk: noPk,
      no_si_vessel: "090",
      buyer: "BUYER TEST",
      mothervessel,
      barge_seq: 1,
      jetty_code: jettyCode,
      shipper_code: shipperCode,
      tugboat: sharedTugboat,
      laycan_start: "2025-08-01",
      laycan_end: "2025-08-02",
    });
    sibargesId2 = await seedSibargesRow({
      no_pk: noPk,
      no_si_vessel: "090",
      buyer: "BUYER TEST",
      mothervessel,
      barge_seq: 2,
      jetty_code: jettyCode,
      shipper_code: shipperCode,
      tugboat: sharedTugboat,
      laycan_start: "2025-08-01",
      laycan_end: "2025-08-02",
    });
  });

  afterEach(async () => {
    await deleteCoalBargeOperationRowsBySibargesId(sibargesId1);
    await deleteCoalBargeOperationRowsBySibargesId(sibargesId2);
    await deleteCoalBargeDeletedRow(sibargesId1);
    await deleteCoalBargeDeletedRow(sibargesId2);
    await deleteBargeOperationRowsBySibargesId(sibargesId1);
    await deleteBargeOperationRowsBySibargesId(sibargesId2);
    await deleteSibargesRow(sibargesId1);
    await deleteSibargesRow(sibargesId2);
    await deleteVesselRow(noPk);
    await deleteJettyRow(jettyCode);
    await deleteShipperRow(shipperCode);
    await deleteUserRow(opUser);
  });

  async function loginAs(username: string, password: string) {
    const client = new HttpClient(target.baseUrl);
    await client.postForm(target.paths.login, { username, password });
    return client;
  }

  function ajaxUrl(action: string, params: Record<string, string> = {}) {
    const ajaxPrefix = isPhp ? "" : "ajax=1&";
    const qs = new URLSearchParams({ action, ...params }).toString();
    return `${target.paths.coalBarging}?${ajaxPrefix}${qs}`;
  }

  // PHP reads `action` only from $_GET for POST write actions; Node reads it
  // from the JSON body / multipart fields (same split as tlu-operation's own
  // characterization spec).
  function writeUrl(action: string) {
    return isPhp ? `${target.paths.coalBarging}?action=${action}` : target.paths.coalBarging;
  }
  function writeBody(action: string, payload: Record<string, unknown>) {
    return isPhp ? payload : { action, ...payload };
  }
  function importCsvUrl() {
    return isPhp
      ? `${target.paths.coalBarging}?action=import_operation_csv`
      : target.paths.coalBarging;
  }
  function importCsvFields(noPkValue: string): Record<string, string> {
    return isPhp
      ? { no_pk: noPkValue }
      : { action: "import_operation_csv", no_pk: noPkValue };
  }
  function buildCoalBargingCsv(rows: Record<string, string>[]): string {
    const header = COAL_BARGING_CSV_COLUMNS.join(",");
    const lines = rows.map((row) => COAL_BARGING_CSV_COLUMNS.map((col) => row[col] ?? "").join(","));
    return [header, ...lines].join("\n");
  }

  /** Strips any leading PHP warning/notice HTML (display_errors output)
   * ahead of the actual JSON body — see import_operation_csv's cell-accessor
   * quirk, documented at its call site. */
  function extractJsonFromPhpBody(body: string): string {
    const start = body.indexOf("{");
    return start === -1 ? body : body.slice(start);
  }

  it("si_barges_by_vessel requires no_pk", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.get(ajaxUrl("si_barges_by_vessel", { no_pk: "" }));
    const json = JSON.parse(res.body) as AjaxResult;
    expect(json.ok).toBe(false);
    expect(json.msg).toContain("No PK wajib dipilih");
  });

  it("seeds coal_barge_operations from TLU's barge_operations on read when no coal-specific row exists yet", async () => {
    await seedBargeOperationRow({
      sibarges_id: sibargesId1,
      operation_data: { qty: "100", discharge_sequence: "1" },
    });

    const client = await loginAs(opUser, opPassword);
    const res = await client.get(ajaxUrl("si_barges_by_vessel", { no_pk: noPk }));
    const json = JSON.parse(res.body) as AjaxResult;
    expect(json.ok).toBe(true);

    const rows = (json.data ?? []) as ByVesselRow[];
    const row1 = rows.find((r) => String(r.sibarges_id) === String(sibargesId1) && r.row_type === "base");
    expect(row1).toBeDefined();
    expect(decodeOperationData(row1!.operation_data).qty).toBe("100");

    // Proves seedCoalBargingFromTlu ran: a coal_barge_operations copy now exists.
    const coalRow = await getCoalBargeOperationRow(sibargesId1);
    expect(coalRow).not.toBeNull();
    expect(decodeOperationData(coalRow!.operation_data).qty).toBe("100");
  });

  it("prefers Coal Barging's own operation_data over TLU's once both exist", async () => {
    await seedBargeOperationRow({
      sibarges_id: sibargesId2,
      operation_data: { qty: "100" },
    });
    await seedCoalBargeOperationRow({
      sibarges_id: sibargesId2,
      operation_data: { qty: "999" },
    });

    const client = await loginAs(opUser, opPassword);
    const res = await client.get(ajaxUrl("si_barges_by_vessel", { no_pk: noPk }));
    const json = JSON.parse(res.body) as AjaxResult;
    const rows = (json.data ?? []) as ByVesselRow[];
    const row2 = rows.find((r) => String(r.sibarges_id) === String(sibargesId2) && r.row_type === "base");
    expect(decodeOperationData(row2!.operation_data).qty).toBe("999");
  });

  it("includes a 'used' RC row with no_pk/buyer/mothervessel overridden from its own operation_data", async () => {
    const rcRowId = await seedCoalBargeRcRow({
      source_sibarges_id: sibargesId1,
      usage_status: "used",
      operation_data: { no_pk: `RC.${uid}`, buyer: "RC BUYER", mothervessel: "RC MV", qty: "5" },
    });

    try {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(ajaxUrl("si_barges_by_vessel", { no_pk: noPk }));
      const json = JSON.parse(res.body) as AjaxResult;
      const rows = (json.data ?? []) as ByVesselRow[];

      const rcRow = rows.find((r) => r.row_type === "rc" && String(r.sibarges_id) === String(sibargesId1));
      expect(rcRow).toBeDefined();
      expect(rcRow!.no_pk).toBe(`RC.${uid}`);
      expect(rcRow!.buyer).toBe("RC BUYER");
      expect(rcRow!.mothervessel).toBe("RC MV");
      expect(decodeOperationData(rcRow!.operation_data).qty).toBe("5");
    } finally {
      await deleteCoalBargeRcRow(rcRowId);
    }
  });

  it("excludes a tombstoned barge from both the base and rc branches", async () => {
    const rcRowId = await seedCoalBargeRcRow({
      source_sibarges_id: sibargesId2,
      usage_status: "used",
      operation_data: { qty: "5" },
    });
    await seedCoalBargeDeletedRow(sibargesId2);

    try {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(ajaxUrl("si_barges_by_vessel", { no_pk: noPk }));
      const json = JSON.parse(res.body) as AjaxResult;
      const rows = (json.data ?? []) as ByVesselRow[];

      expect(rows.some((r) => String(r.sibarges_id) === String(sibargesId2))).toBe(false);
    } finally {
      await deleteCoalBargeRcRow(rcRowId);
    }
  });

  describe("unused_rc_options", () => {
    it("requires no_pk", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(ajaxUrl("unused_rc_options", { no_pk: "" }));
      const json = JSON.parse(res.body) as AjaxResult;
      expect(json.ok).toBe(false);
      expect(json.msg).toContain("No PK wajib dipilih");
    });

    it("matches an 'unused' RC row to every active barge under the vessel sharing its source tugboat, using only the RC row's own operation_data", async () => {
      const rcRowId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "unused",
        operation_data: { no_pk: "IGNORED", buyer: "RC BUYER", mothervessel: "RC MV" },
      });

      try {
        const client = await loginAs(opUser, opPassword);
        const res = await client.get(ajaxUrl("unused_rc_options", { no_pk: noPk }));
        const json = JSON.parse(res.body) as AjaxResult;
        expect(json.ok).toBe(true);

        const rows = (json.data ?? []) as UnusedRcRow[];
        const targetIds = rows.filter((r) => r.rc_row_id === rcRowId).map((r) => String(r.target_sibarges_id));
        // Both barges share sharedTugboat and belong to noPk, so both are candidates.
        expect(new Set(targetIds)).toEqual(new Set([String(sibargesId1), String(sibargesId2)]));

        for (const row of rows.filter((r) => r.rc_row_id === rcRowId)) {
          expect(row.no_pk).toBe("IGNORED");
          expect(row.buyer).toBe("RC BUYER");
          expect(row.mothervessel).toBe("RC MV");
          expect(row.anchorage).toBe("");
        }
      } finally {
        await deleteCoalBargeRcRow(rcRowId);
      }
    });

    it("excludes a tombstoned target barge", async () => {
      const rcRowId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "unused",
        operation_data: { buyer: "RC BUYER" },
      });
      await seedCoalBargeDeletedRow(sibargesId2);

      try {
        const client = await loginAs(opUser, opPassword);
        const res = await client.get(ajaxUrl("unused_rc_options", { no_pk: noPk }));
        const json = JSON.parse(res.body) as AjaxResult;
        const rows = (json.data ?? []) as UnusedRcRow[];
        const targetIds = rows.filter((r) => r.rc_row_id === rcRowId).map((r) => String(r.target_sibarges_id));
        expect(targetIds).not.toContain(String(sibargesId2));
      } finally {
        await deleteCoalBargeRcRow(rcRowId);
      }
    });

    it("only surfaces 'used' RC rows via si_barges_by_vessel, and only 'unused' ones here", async () => {
      const usedRcId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "used",
      });
      const unusedRcId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "unused",
      });

      try {
        const client = await loginAs(opUser, opPassword);

        const byVesselRes = await client.get(ajaxUrl("si_barges_by_vessel", { no_pk: noPk }));
        const byVesselJson = JSON.parse(byVesselRes.body) as AjaxResult;
        const byVesselRows = (byVesselJson.data ?? []) as any[];
        expect(byVesselRows.some((r) => Number(r.rc_row_id) === usedRcId)).toBe(true);
        expect(byVesselRows.some((r) => Number(r.rc_row_id) === unusedRcId)).toBe(false);

        const unusedRes = await client.get(ajaxUrl("unused_rc_options", { no_pk: noPk }));
        const unusedJson = JSON.parse(unusedRes.body) as AjaxResult;
        const unusedRows = (unusedJson.data ?? []) as UnusedRcRow[];
        expect(unusedRows.some((r) => r.rc_row_id === unusedRcId)).toBe(true);
        expect(unusedRows.some((r) => r.rc_row_id === usedRcId)).toBe(false);
      } finally {
        await deleteCoalBargeRcRow(usedRcId);
        await deleteCoalBargeRcRow(unusedRcId);
      }
    });
  });

  describe("save_operation_data", () => {
    it("rejects an invalid sibarges_id", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        writeUrl("save_operation_data"),
        writeBody("save_operation_data", { sibarges_id: 0, data: {} })
      );
      expect(res.ok).toBe(false);
      expect(res.msg).toContain("Data barge tidak valid");
    });

    it("rebuilds operation_data wholesale from submittedData — a previously-saved field not resubmitted is dropped (unlike TLU's partial merge)", async () => {
      await seedCoalBargeOperationRow({
        sibarges_id: sibargesId1,
        operation_data: { qty_disc: "100", pbm_vendor: "OLDVENDOR" },
      });

      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        writeUrl("save_operation_data"),
        writeBody("save_operation_data", { sibarges_id: sibargesId1, data: { qty_disc: "200" } })
      );
      expect(res.ok).toBe(true);
      expect(res.data.qty_disc).toBe("200");
      // pbm_vendor was saved before but not resubmitted — dropped, not preserved.
      expect(res.data.pbm_vendor).toBeUndefined();

      const raw = await getCoalBargeOperationRow(sibargesId1);
      const rawData = decodeOperationData(raw?.operation_data);
      expect(rawData.pbm_vendor).toBeUndefined();
    });

    it("qty_actual is taken directly from the submitted value, not recomputed from qty_disc+rc", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        writeUrl("save_operation_data"),
        writeBody("save_operation_data", {
          sibarges_id: sibargesId1,
          data: { qty_disc: "100", rc: "50", qty_actual: "999" },
        })
      );
      expect(res.ok).toBe(true);
      expect(res.data.qty_actual).toBe("999");

      const blank = await client.postJsonBody<AjaxResult>(
        writeUrl("save_operation_data"),
        writeBody("save_operation_data", { sibarges_id: sibargesId1, data: { qty_actual: "" } })
      );
      expect(blank.ok).toBe(true);
      expect(blank.data.qty_actual).toBeUndefined();
    });

    it("KTM pbm_vendor forces floating_crane to STV KTM; STV MAESTRO rejected without vendor MLS", async () => {
      const client = await loginAs(opUser, opPassword);
      const ktmVendor = "KTM";
      const otherFloatingCrane = `FC-${uid}`;
      await deleteFlfRow("STV KTM");
      await seedFlfRow({
        floating_crane: "STV KTM",
        vendor_flf: ktmVendor,
        pbm: "PBM TEST",
        anchorage: "ANCHOR TEST",
      });
      await seedFlfRow({
        floating_crane: otherFloatingCrane,
        vendor_flf: `OTHERVENDOR-${uid}`,
        pbm: "PBM TEST",
        anchorage: "ANCHOR TEST",
      });

      try {
        const forced = await client.postJsonBody<AjaxResult>(
          writeUrl("save_operation_data"),
          writeBody("save_operation_data", {
            sibarges_id: sibargesId1,
            data: { pbm_vendor: ktmVendor, floating_crane: otherFloatingCrane },
          })
        );
        expect(forced.ok).toBe(true);
        expect(forced.data.floating_crane).toBe("STV KTM");

        const rejected = await client.postJsonBody<AjaxResult>(
          writeUrl("save_operation_data"),
          writeBody("save_operation_data", {
            sibarges_id: sibargesId1,
            data: { pbm_vendor: `OTHERVENDOR-${uid}`, floating_crane: "STV KTM" },
          })
        );
        expect(rejected.ok).toBe(false);
        expect(rejected.msg).toContain("STV KTM hanya untuk vendor KTM");
      } finally {
        await deleteFlfRow("STV KTM");
        await deleteFlfRow(otherFloatingCrane);
      }
    });

    it("discharge_sequence max includes active barges plus 'used' RC rows for the vessel", async () => {
      const rcRowId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "used",
      });

      try {
        const client = await loginAs(opUser, opPassword);

        // 2 active barges (sibargesId1, sibargesId2) + 1 used RC row = max 3.
        const tooHigh = await client.postJsonBody<AjaxResult>(
          writeUrl("save_operation_data"),
          writeBody("save_operation_data", { sibarges_id: sibargesId1, data: { discharge_sequence: "4" } })
        );
        expect(tooHigh.ok).toBe(false);
        expect(tooHigh.msg).toContain("Discharge Sequence harus antara 1 dan 3");

        const valid = await client.postJsonBody<AjaxResult>(
          writeUrl("save_operation_data"),
          writeBody("save_operation_data", { sibarges_id: sibargesId1, data: { discharge_sequence: "3" } })
        );
        expect(valid.ok).toBe(true);
        expect(valid.data.discharge_sequence).toBe("3");
      } finally {
        await deleteCoalBargeRcRow(rcRowId);
      }
    });

    it("routes operation_remarks to the remarks column, not into operation_data", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        writeUrl("save_operation_data"),
        writeBody("save_operation_data", {
          sibarges_id: sibargesId1,
          data: { operation_remarks: "hello world" },
        })
      );
      expect(res.ok).toBe(true);
      expect(res.data.operation_remarks).toBe("hello world");

      const raw = await getCoalBargeOperationRow(sibargesId1);
      expect(raw?.remarks).toBe("hello world");
      const rawData = decodeOperationData(raw?.operation_data);
      expect(rawData.operation_remarks).toBeUndefined();
    });

    it("row_type 'rc' rebuilds no_pk/buyer/mothervessel from submittedData and writes into coal_barge_rc_rows", async () => {
      const rcRowId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "unused",
        operation_data: { qty: "5" },
      });

      try {
        const client = await loginAs(opUser, opPassword);
        const res = await client.postJsonBody<AjaxResult>(
          writeUrl("save_operation_data"),
          writeBody("save_operation_data", {
            row_type: "rc",
            rc_row_id: rcRowId,
            data: { no_pk: `RC.${uid}`, buyer: "RC BUYER", qty_disc: "10" },
          })
        );
        expect(res.ok).toBe(true);
        expect(res.data.no_pk).toBe(`RC.${uid}`);
        expect(res.data.buyer).toBe("RC BUYER");

        const rcRow = await getCoalBargeRcRow(rcRowId);
        const rcData = decodeOperationData(rcRow?.operation_data);
        expect(rcData.no_pk).toBe(`RC.${uid}`);
        expect(rcData.qty_disc).toBe("10");
        // qty from the seed wasn't resubmitted — dropped (wholesale rebuild).
        expect(rcData.qty).toBeUndefined();
      } finally {
        await deleteCoalBargeRcRow(rcRowId);
      }
    });
  });

  describe("create_rc_row", () => {
    it("derives an unused RC row with qty_disc/qty_actual as the jetty-vs-disc/laut delta, status forced to RC, and target-barge fields stripped", async () => {
      await seedCoalBargeOperationRow({
        sibarges_id: sibargesId1,
        operation_data: {
          no_pk: noPk,
          buyer: "OLD BUYER",
          qty: "100",
          qty_disc: "20",
          qty_actual: "15",
          pbm_vendor: "SOMEVENDOR",
        },
      });

      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        writeUrl("create_rc_row"),
        writeBody("create_rc_row", { sibarges_id: sibargesId1, data: { qty: "100", qty_disc: "20", qty_actual: "15" } })
      );
      expect(res.ok).toBe(true);
      const rcRowId = Number(res.rc_row_id);

      try {
        expect(res.data.qty).toBe("0");
        expect(Number(res.data.qty_disc)).toBe(80);
        expect(Number(res.data.qty_actual)).toBe(85);
        expect(res.data.status_act_rc).toBe("RC");
        expect(res.data.status_act_act_rc).toBe("ACT&RC");
        // stripRcUnusedFields removes these, even though they were derivable.
        expect(res.data.no_pk).toBeUndefined();
        expect(res.data.buyer).toBeUndefined();
        expect(res.data.pbm_vendor).toBeUndefined();

        const rcRow = await getCoalBargeRcRow(rcRowId);
        expect(rcRow?.usage_status).toBe("unused");
        expect(rcRow?.source_sibarges_id).toBe(sibargesId1);

        const sourceRow = await getCoalBargeOperationRow(sibargesId1);
        const sourceData = decodeOperationData(sourceRow?.operation_data);
        expect(sourceData.status_act_act_rc).toBe("ACT&RC");
        // the source row's own fields (pbm_vendor) are otherwise untouched.
        expect(sourceData.pbm_vendor).toBe("SOMEVENDOR");
      } finally {
        await deleteCoalBargeRcRow(rcRowId);
      }
    });
  });

  describe("delete_coal_barging_row", () => {
    it("row_type 'rc' + delete_scope 'unused' hard-deletes the row", async () => {
      const rcRowId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "unused",
      });

      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        writeUrl("delete_coal_barging_row"),
        writeBody("delete_coal_barging_row", { row_type: "rc", rc_row_id: rcRowId, delete_scope: "unused" })
      );
      expect(res.ok).toBe(true);

      const rcRow = await getCoalBargeRcRow(rcRowId);
      expect(rcRow).toBeNull();
    });

    it("row_type 'rc' (default scope) soft-detaches a used row back to 'unused', stripping target-barge fields", async () => {
      const rcRowId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "used",
        operation_data: { no_pk: noPk, buyer: "X", pbm_vendor: "Y", qty: "5" },
      });

      try {
        const client = await loginAs(opUser, opPassword);
        const res = await client.postJsonBody<AjaxResult>(
          writeUrl("delete_coal_barging_row"),
          writeBody("delete_coal_barging_row", { row_type: "rc", rc_row_id: rcRowId })
        );
        expect(res.ok).toBe(true);

        const rcRow = await getCoalBargeRcRow(rcRowId);
        expect(rcRow?.usage_status).toBe("unused");
        const rcData = decodeOperationData(rcRow?.operation_data);
        expect(rcData.no_pk).toBeUndefined();
        expect(rcData.buyer).toBeUndefined();
        expect(rcData.pbm_vendor).toBeUndefined();
        expect(rcData.qty).toBe("5");
      } finally {
        await deleteCoalBargeRcRow(rcRowId);
      }
    });

    it("row_type 'base' tombstones the barge and detaches its 'used' RC rows", async () => {
      const rcRowId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "used",
        operation_data: { no_pk: noPk, pbm_vendor: "Y" },
      });

      try {
        const client = await loginAs(opUser, opPassword);
        const res = await client.postJsonBody<AjaxResult>(
          writeUrl("delete_coal_barging_row"),
          writeBody("delete_coal_barging_row", { row_type: "base", sibarges_id: sibargesId1 })
        );
        expect(res.ok).toBe(true);

        const rcRow = await getCoalBargeRcRow(rcRowId);
        expect(rcRow?.usage_status).toBe("unused");

        const byVesselRes = await client.get(ajaxUrl("si_barges_by_vessel", { no_pk: noPk }));
        const byVesselJson = JSON.parse(byVesselRes.body) as AjaxResult;
        const rows = (byVesselJson.data ?? []) as ByVesselRow[];
        expect(rows.some((r) => String(r.sibarges_id) === String(sibargesId1))).toBe(false);
      } finally {
        await deleteCoalBargeRcRow(rcRowId);
      }
    });
  });

  describe("import_from_tlu_operation", () => {
    it("requires no_pk", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        writeUrl("import_from_tlu_operation"),
        writeBody("import_from_tlu_operation", { no_pk: "" })
      );
      expect(res.ok).toBe(false);
      expect(res.msg).toContain("Pilih Mother Vessel");
    });

    it("vessel-wide delete-then-reseed: replaces coal_barge_operations, resets 'used' RC rows to unused, clears tombstones", async () => {
      await seedBargeOperationRow({
        sibarges_id: sibargesId1,
        operation_data: { qty: "777" },
      });
      await seedCoalBargeOperationRow({
        sibarges_id: sibargesId1,
        operation_data: { qty: "111" },
      });
      const rcRowId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "used",
      });
      await seedCoalBargeDeletedRow(sibargesId2);

      try {
        const client = await loginAs(opUser, opPassword);
        const res = await client.postJsonBody<AjaxResult>(
          writeUrl("import_from_tlu_operation"),
          writeBody("import_from_tlu_operation", { no_pk: noPk })
        );
        expect(res.ok).toBe(true);

        const coalRow = await getCoalBargeOperationRow(sibargesId1);
        expect(decodeOperationData(coalRow?.operation_data).qty).toBe("777");

        const rcRow = await getCoalBargeRcRow(rcRowId);
        expect(rcRow?.usage_status).toBe("unused");

        const byVesselRes = await client.get(ajaxUrl("si_barges_by_vessel", { no_pk: noPk }));
        const byVesselJson = JSON.parse(byVesselRes.body) as AjaxResult;
        const rows = (byVesselJson.data ?? []) as ByVesselRow[];
        // sibargesId2's tombstone was cleared — it's visible again.
        expect(rows.some((r) => String(r.sibarges_id) === String(sibargesId2))).toBe(true);
      } finally {
        await deleteCoalBargeRcRow(rcRowId);
      }
    });
  });

  describe("import_operation_csv", () => {
    it("rejects a CSV missing a required column", async () => {
      const client = await loginAs(opUser, opPassword);
      const header = COAL_BARGING_CSV_COLUMNS.filter((c) => c !== "remarks").join(",");
      const res = await client.postJsonMultipart<AjaxResult>(
        importCsvUrl(),
        importCsvFields(noPk),
        { fieldName: "csv", filename: "import.csv", content: `${header}\n` }
      );
      expect(res.ok).toBe(false);
      expect(res.msg).toContain("remarks");
    });

    it("matches rows by (si_barges, form-selected no_pk) and upserts operation_data", async () => {
      const sibargesRow1 = await getSibargesRow(sibargesId1);

      const client = await loginAs(opUser, opPassword);
      const csv = buildCoalBargingCsv([
        { si_barges: String(sibargesRow1?.si_barges ?? ""), no_pk: noPk, qty_disc: "50", remarks: "csv note" },
      ]);
      // Legacy's per-row CSV cell accessor (9coalbarging.php:1301,
      // `$row[$idx[$column]] ?? ''`) omits the `?? -1` fallback the rest of
      // the codebase uses when a field name isn't a CSV column — status_act_rc/
      // status_act_act_rc/date_jetty are in COAL_BARGING_OPERATION_FIELDS but
      // never in COAL_BARGING_CSV_COLUMNS, so every row triggers PHP "Undefined
      // array key" warnings that display_errors prints before the JSON body.
      // The Node port's cell() (colIndex.get(col) ?? -1) doesn't have this
      // wart; extractJsonFromPhpBody strips the noise so both targets can be
      // asserted against the same underlying (warning-free) JSON payload.
      const rawRes = await client.postMultipart(
        importCsvUrl(),
        importCsvFields(noPk),
        { fieldName: "csv", filename: "import.csv", content: csv }
      );
      const res = JSON.parse(extractJsonFromPhpBody(rawRes.body)) as AjaxResult;
      expect(res.ok).toBe(true);
      expect(res.updated).toBe(1);

      const coalRow = await getCoalBargeOperationRow(sibargesId1);
      expect(decodeOperationData(coalRow?.operation_data).qty_disc).toBe("50");
      expect(coalRow?.remarks).toBe("csv note");
    });
  });

  describe("input_rc_row", () => {
    it("attaches an unused RC row to a target barge sharing its source tugboat, reattaching pbm_vendor/floating_crane/start_disch/completed_disch from the target's own data", async () => {
      await seedCoalBargeOperationRow({
        sibarges_id: sibargesId2,
        operation_data: { pbm_vendor: "TARGETVENDOR", start_disch: "2025-08-05 10:00" },
      });
      const rcRowId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "unused",
        operation_data: { qty: "5" },
      });

      try {
        const client = await loginAs(opUser, opPassword);
        const res = await client.postJsonBody<AjaxResult>(
          writeUrl("input_rc_row"),
          writeBody("input_rc_row", { rc_row_id: rcRowId, target_sibarges_id: sibargesId2 })
        );
        expect(res.ok).toBe(true);

        const rcRow = await getCoalBargeRcRow(rcRowId);
        expect(rcRow?.usage_status).toBe("used");
        expect(rcRow?.source_sibarges_id).toBe(sibargesId2);
        const rcData = decodeOperationData(rcRow?.operation_data);
        expect(rcData.no_pk).toBe(noPk);
        expect(rcData.pbm_vendor).toBe("TARGETVENDOR");
        expect(rcData.start_disch).toBe("2025-08-05 10:00");
      } finally {
        await deleteCoalBargeRcRow(rcRowId);
      }
    });

    it("rejects a target barge with a different tugboat than the RC's source", async () => {
      const otherTugboat = `TB.other.${uid}`;
      const otherSibargesId = await seedSibargesRow({
        no_pk: noPk,
        no_si_vessel: "090",
        buyer: "BUYER TEST",
        mothervessel,
        barge_seq: 3,
        jetty_code: jettyCode,
        shipper_code: shipperCode,
        tugboat: otherTugboat,
        laycan_start: "2025-08-01",
        laycan_end: "2025-08-02",
      });
      const rcRowId = await seedCoalBargeRcRow({
        source_sibarges_id: sibargesId1,
        usage_status: "unused",
      });

      try {
        const client = await loginAs(opUser, opPassword);
        const res = await client.postJsonBody<AjaxResult>(
          writeUrl("input_rc_row"),
          writeBody("input_rc_row", { rc_row_id: rcRowId, target_sibarges_id: otherSibargesId })
        );
        expect(res.ok).toBe(false);
        expect(res.msg).toContain("TB yang sama");
      } finally {
        await deleteCoalBargeRcRow(rcRowId);
        await deleteSibargesRow(otherSibargesId);
      }
    });
  });

  // Node-only: the landing table is ported as a discrete `all_vessels` AJAX
  // action (issue #13 design decision), not legacy PHP's server-rendered,
  // JSON-embedded-in-page-HTML table — see docs/adr/0001 and the plan.
  it.skipIf(isPhp)(
    "all_vessels groups rows by vessel, ordered by earliest laycan start",
    async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(ajaxUrl("all_vessels"));
      const json = JSON.parse(res.body) as AjaxResult;
      expect(json.ok).toBe(true);

      const groups = (json.data ?? []) as VesselGroup[];
      const ourGroup = groups.find((g) => g.no_pk === noPk);
      expect(ourGroup).toBeDefined();
      expect(ourGroup!.mothervessel).toBe(mothervessel);

      const ourIds = new Set([String(sibargesId1), String(sibargesId2)]);
      const ourRows = ourGroup!.rows.filter((r) => ourIds.has(String(r.source_sibarges_id)));
      expect(ourRows).toHaveLength(2);
    }
  );
});
