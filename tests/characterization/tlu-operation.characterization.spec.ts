import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseCsv } from "../../src/lib/csv-parser.js";
import { TLU_CSV_COLUMNS } from "../../src/lib/operation-fields.js";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { deleteFlfRow, seedFlfRow } from "./flf-fixture.js";
import { HttpClient } from "./http-client.js";
import { deleteJettyRow, seedJettyRow } from "./jetty-fixture.js";
import { deleteShipperRow, seedShipperRow } from "./shipper-fixture.js";
import { deleteSibargesRow, getSibargesRow, seedSibargesRow } from "./sibarges-fixture.js";
import {
  deleteBargeOperationRow,
  getBargeOperationRow,
  seedBargeOperationRow,
} from "./tlu-operation-fixture.js";
import { targets } from "./targets.js";
import { deleteVendorRow, seedVendorRow } from "./vendor-fixture.js";
import { deleteVesselRow, seedVesselRow } from "./vessel-fixture.js";

interface AjaxResult {
  ok: boolean;
  msg?: string;
  data?: any;
  partial?: boolean;
  updated?: number;
  errors?: number;
  filename?: string;
  rows?: any;
}

interface DecodedRow {
  id: number;
  barge_seq: number;
  operation_data: string | null;
}

describe.each(targets)("tlu-operation — $name", (target) => {
  const uid = randomUUID().slice(0, 8);
  const opUser = `op_${uid}`;
  const opPassword = "op-test-pass";

  const noPk = `TLU.${uid}`;
  const mothervessel = `MV TLU ${uid}`;
  const jettyCode = `JT${uid.slice(0, 6)}`.toUpperCase();
  const shipperCode = `SH${uid.slice(0, 6)}`.toUpperCase();
  const vendorName = `VEND ${uid}`;

  let vendorId: number;
  let sibargesId1: number;
  let sibargesId2: number;
  let operationId: number;

  beforeEach(async () => {
    await seedLegacyUser(opUser, opPassword, "Staff", "Operation");

    await seedVesselRow({
      no_pk: noPk,
      no_si_vessel: "070",
      buyer: "BUYER TEST",
      mothervessel,
      anchorage: "MUARA BERAU",
      term: "FOB",
    });
    // vessel_pkk/vessel_rkbm defaults (via config/database.php's lazy ALTER,
    // ported by ensureVesselScheduleColumns) come from raw UPDATE, since
    // seedVesselRow doesn't accept pkk/rkbm columns.
    await seedJettyRow({ jetty: jettyCode, nama_panjang: "JETTY TEST" });
    await seedShipperRow({
      shipper: shipperCode,
      pt: "PT TEST",
      nama_lengkap: "PT TEST SHIPPER",
      laytime: 1.5,
    });
    vendorId = await seedVendorRow({ vendor: vendorName, ltc_rate: 2500 });

    sibargesId1 = await seedSibargesRow({
      no_pk: noPk,
      no_si_vessel: "070",
      buyer: "BUYER TEST",
      mothervessel,
      barge_seq: 1,
      jetty_code: jettyCode,
      shipper_code: shipperCode,
      laycan_start: "2025-06-01",
      laycan_end: "2025-06-02",
    });
    sibargesId2 = await seedSibargesRow({
      no_pk: noPk,
      no_si_vessel: "070",
      buyer: "BUYER TEST",
      mothervessel,
      barge_seq: 2,
      jetty_code: jettyCode,
      shipper_code: shipperCode,
      laycan_start: "2025-06-01",
      laycan_end: "2025-06-02",
    });

    operationId = await seedBargeOperationRow({
      sibarges_id: sibargesId1,
      operation_data: {
        barge_vendor: vendorName,
        discharge_sequence: "1",
        qty_disc: "1000",
        rc: "0",
      },
    });
  });

  afterEach(async () => {
    await deleteBargeOperationRow(operationId);
    await deleteSibargesRow(sibargesId1);
    await deleteSibargesRow(sibargesId2);
    await deleteVendorRow(vendorId);
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

  const isPhp = target.name.startsWith("PHP");

  function siBargesByVesselUrl(no_pk: string) {
    const ajaxPrefix = isPhp ? "" : "ajax=1&";
    return `${target.paths.tluOperation}?${ajaxPrefix}action=si_barges_by_vessel&no_pk=${encodeURIComponent(no_pk)}`;
  }

  function groupedExportUrl(params: Record<string, string>) {
    const ajaxPrefix = isPhp ? "" : "ajax=1&";
    const qs = new URLSearchParams({ action: "tlu_grouped_export_data", ...params }).toString();
    return `${target.paths.tluOperation}?${ajaxPrefix}${qs}`;
  }

  function templateDownloadUrl(params: Record<string, string>) {
    const qs = new URLSearchParams({ download: "tlu_operation_template", ...params }).toString();
    return `${target.paths.tluOperation}?${qs}`;
  }

  function stripBom(text: string) {
    return text.replace(/^﻿/, "");
  }

  // PHP's header() writes the filename's em dash as raw UTF-8 bytes, which
  // undici's fetch Headers decode isomorphically (one byte -> one char code)
  // — reverse that to recover the real filename. Node's Content-Disposition
  // (see contentDispositionAttachment, src/routes/tlu-operation.ts) instead
  // uses RFC 6266's percent-encoded filename* extension, since Fastify
  // re-encodes literal non-ASCII header characters as UTF-8 on the wire.
  function decodeContentDisposition(value: string | null): string {
    if (!value) return "";
    const extended = value.match(/filename\*=UTF-8''([^;]+)/);
    if (extended) return decodeURIComponent(extended[1]);
    return Buffer.from(value, "latin1").toString("utf8");
  }

  /** Groups CSV data rows (post-header) into vessel blocks, splitting on the
   * blank-line separator (a single-cell [""] row from parseCsv). */
  function splitIntoVesselBlocks(rows: string[][]): string[][][] {
    const blocks: string[][][] = [[]];
    for (const row of rows) {
      if (row.length === 1 && row[0] === "") {
        blocks.push([]);
      } else {
        blocks[blocks.length - 1].push(row);
      }
    }
    return blocks.filter((b) => b.length > 0);
  }

  // PHP reads `action` only from $_GET for these two write actions; Node
  // reads it from the JSON body / multipart fields. Both forms can be sent
  // without conflict since each side ignores what it doesn't look at.
  function saveOperationUrl() {
    return isPhp ? `${target.paths.tluOperation}?action=save_operation_data` : target.paths.tluOperation;
  }
  function saveOperationBody(payload: { sibarges_id: number; data: Record<string, unknown> }) {
    return isPhp ? payload : { action: "save_operation_data", ...payload };
  }
  function importOperationUrl() {
    return isPhp ? `${target.paths.tluOperation}?action=import_operation_csv` : target.paths.tluOperation;
  }
  function importOperationFields(): Record<string, string> {
    return isPhp ? {} : { action: "import_operation_csv" };
  }
  function buildOperationCsv(rows: Record<string, string>[]): string {
    const header = TLU_CSV_COLUMNS.join(",");
    const lines = rows.map((row) => TLU_CSV_COLUMNS.map((col) => row[col] ?? "").join(","));
    return [header, ...lines].join("\n");
  }

  // mysql2 auto-parses the `json` column type into a JS object; PHP's
  // mysqli returns it as a raw string. Normalize both shapes.
  function decodeRawOperationData(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object") return value as Record<string, unknown>;
    if (!value) return {};
    return JSON.parse(String(value));
  }

  it("requires no_pk", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.get(siBargesByVesselUrl(""));
    const json = JSON.parse(res.body) as AjaxResult;
    expect(json.ok).toBe(false);
    expect(json.msg).toContain("No PK wajib dipilih");
  });

  it("returns rows ordered by barge_seq with vessel/shipper/vendor defaults merged into operation_data", async () => {
    const client = await loginAs(opUser, opPassword);
    const res = await client.get(siBargesByVesselUrl(noPk));
    const json = JSON.parse(res.body) as AjaxResult;

    expect(json.ok).toBe(true);
    const rows = (json.data ?? []) as DecodedRow[];
    // PHP's mysqli returns `id` as a native int via the si_barges_by_vessel
    // prepared statement but as a string from the landing query's plain
    // mysqli_query() call — compare as strings to stay type-agnostic across
    // both PHP's own inconsistency and Node's driver.
    const oursIds = new Set([String(sibargesId1), String(sibargesId2)]);
    const ours = rows.filter((r) => oursIds.has(String(r.id)));
    expect(ours).toHaveLength(2);
    expect(String(ours[0].id)).toBe(String(sibargesId1));
    expect(Number(ours[0].barge_seq)).toBe(1);
    expect(String(ours[1].id)).toBe(String(sibargesId2));
    expect(Number(ours[1].barge_seq)).toBe(2);

    const data1 = JSON.parse(ours[0].operation_data ?? "{}");
    // Laytime defaults from the shipper, LTC Rate defaults from the barge
    // vendor referenced in operation_data (Operation/8tluoperation.php:349-388).
    expect(Number(data1.laytime)).toBeCloseTo(1.5, 5);
    expect(Number(data1.ltc_rate)).toBe(2500);
    expect(data1.discharge_sequence).toBe("1");

    // No barge_operations row exists for barge 2, so operation_data is built
    // entirely from vessel/shipper defaults (still non-null: laytime default
    // applies even without a saved operation record).
    const data2 = JSON.parse(ours[1].operation_data ?? "{}");
    expect(Number(data2.laytime)).toBeCloseTo(1.5, 5);
  });

  it("all_operations / landing data includes the seeded vessel's rows with the same defaults", async () => {
    const client = await loginAs(opUser, opPassword);
    const isPhp = target.name.startsWith("PHP");

    let rows: DecodedRow[];
    if (isPhp) {
      const res = await client.get(target.paths.tluOperation);
      expect(res.status).toBe(200);
      const match = res.body.match(
        /^const allOperationsRawRows = (\[.*\]);$/m
      );
      expect(match).not.toBeNull();
      rows = JSON.parse(match![1]) as DecodedRow[];
    } else {
      const res = await client.get(
        `${target.paths.tluOperation}?ajax=1&action=all_operations`
      );
      const json = JSON.parse(res.body) as AjaxResult;
      expect(json.ok).toBe(true);
      rows = (json.data ?? []) as DecodedRow[];
    }

    // PHP's mysqli returns `id` as a native int via the si_barges_by_vessel
    // prepared statement but as a string from the landing query's plain
    // mysqli_query() call — compare as strings to stay type-agnostic across
    // both PHP's own inconsistency and Node's driver.
    const oursIds = new Set([String(sibargesId1), String(sibargesId2)]);
    const ours = rows.filter((r) => oursIds.has(String(r.id)));
    expect(ours).toHaveLength(2);
    expect(String(ours[0].id)).toBe(String(sibargesId1));
    expect(String(ours[1].id)).toBe(String(sibargesId2));

    const data1 = JSON.parse(ours[0].operation_data ?? "{}");
    expect(Number(data1.laytime)).toBeCloseTo(1.5, 5);
    expect(Number(data1.ltc_rate)).toBe(2500);
  });

  describe("save_operation_data", () => {
    it("rejects an invalid sibarges_id", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({ sibarges_id: 0, data: {} })
      );
      expect(res.ok).toBe(false);
      expect(res.msg).toContain("Data barge tidak valid");
    });

    it("partial-merges submitted fields, leaving untouched baseline fields intact", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({ sibarges_id: sibargesId1, data: { qty_disc: "200" } })
      );
      expect(res.ok).toBe(true);
      // baseline (seeded in beforeEach) has barge_vendor/discharge_sequence — untouched.
      expect(res.data.barge_vendor).toBe(vendorName);
      expect(res.data.discharge_sequence).toBe("1");
      // qty_disc updated, rc untouched (still "0" from baseline), qty_actual recomputed.
      expect(res.data.qty_disc).toBe("200");
      expect(Number(res.data.qty_actual)).toBe(200);

      const raw = await getBargeOperationRow(sibargesId1);
      const rawData = decodeRawOperationData(raw?.operation_data);
      expect(rawData.barge_vendor).toBe(vendorName);
    });

    it("deletes a field from operation_data when submitted as an empty string", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({ sibarges_id: sibargesId1, data: { barge_vendor: "" } })
      );
      expect(res.ok).toBe(true);
      expect(res.data.barge_vendor).toBeUndefined();
    });

    it("qty_actual: recomputed when either side submitted, unset when both blank, untouched when neither key present", async () => {
      const client = await loginAs(opUser, opPassword);

      const both = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({ sibarges_id: sibargesId1, data: { qty_disc: "100", rc: "50" } })
      );
      expect(both.ok).toBe(true);
      expect(both.data.qty_actual).toBe("150");

      const blank = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({ sibarges_id: sibargesId1, data: { qty_disc: "", rc: "" } })
      );
      expect(blank.ok).toBe(true);
      expect(blank.data.qty_actual).toBeUndefined();

      const neither = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({ sibarges_id: sibargesId1, data: { barge_vendor: vendorName } })
      );
      expect(neither.ok).toBe(true);
      expect(neither.data.qty_actual).toBeUndefined();
    });

    it("rejects a chronologically invalid timeline (Start Loading before Arrival Jetty)", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({
          sibarges_id: sibargesId1,
          data: {
            arrival_jetty: "2025-06-05 10:00",
            start_loading: "2025-06-04 10:00",
          },
        })
      );
      expect(res.ok).toBe(false);
      expect(res.msg).toContain("Start Loading harus sama dengan atau setelah Arrival Jetty");
    });

    it("normalizes an accepted datetime format and rejects an unparseable one", async () => {
      const client = await loginAs(opUser, opPassword);

      const good = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({
          sibarges_id: sibargesId1,
          data: { arrival_jetty: "2025/06/01 14:30" },
        })
      );
      expect(good.ok).toBe(true);
      expect(good.data.arrival_jetty).toBe("2025-06-01 14:30");

      const bad = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({
          sibarges_id: sibargesId1,
          data: { arrival_jetty: "not-a-date" },
        })
      );
      expect(bad.ok).toBe(false);
      expect(bad.msg).toContain("harus berisi tanggal dan waktu yang valid");
    });

    it("rejects a barge_vendor not present in the vendor table", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({
          sibarges_id: sibargesId1,
          data: { barge_vendor: `NOPE-${uid}` },
        })
      );
      expect(res.ok).toBe(false);
      expect(res.msg).toContain("tidak ditemukan pada data Barge Vendor");
    });

    it("KTM pbm_vendor forces floating_crane to STV KTM; STV MAESTRO rejected without vendor MLS", async () => {
      const client = await loginAs(opUser, opPassword);
      // "KTM" is the literal RESTRICTED_FLOATING_CRANES key the server
      // matches against pbm_vendor — must be exact, not uid-suffixed.
      const ktmVendor = "KTM";
      const otherFloatingCrane = `FC-${uid}`;
      // floating_crane is flf's PRIMARY KEY; "STV KTM" is a fixed,
      // business-meaningful value (the restriction target), so clear any
      // leftover row from a previous interrupted run before seeding.
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
          saveOperationUrl(),
          saveOperationBody({
            sibarges_id: sibargesId1,
            data: { pbm_vendor: ktmVendor, floating_crane: otherFloatingCrane },
          })
        );
        expect(forced.ok).toBe(true);
        expect(forced.data.floating_crane).toBe("STV KTM");

        const rejected = await client.postJsonBody<AjaxResult>(
          saveOperationUrl(),
          saveOperationBody({
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

    it("discharge_sequence must be within 1..active-barge-count for the vessel", async () => {
      const client = await loginAs(opUser, opPassword);

      const tooHigh = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({ sibarges_id: sibargesId1, data: { discharge_sequence: "3" } })
      );
      expect(tooHigh.ok).toBe(false);
      expect(tooHigh.msg).toContain("Discharge Sequence harus antara 1 dan 2");

      const valid = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({ sibarges_id: sibargesId1, data: { discharge_sequence: "2" } })
      );
      expect(valid.ok).toBe(true);
      expect(valid.data.discharge_sequence).toBe("2");
    });

    it("validates Yes/No and True/False cycle-time check fields", async () => {
      const client = await loginAs(opUser, opPassword);

      const badYesNo = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({
          sibarges_id: sibargesId1,
          data: { check_total_waiting_disch_mv: "Maybe" },
        })
      );
      expect(badYesNo.ok).toBe(false);
      expect(badYesNo.msg).toContain("harus Yes atau No");

      const badTrueFalse = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({ sibarges_id: sibargesId1, data: { check_part_1: "Maybe" } })
      );
      expect(badTrueFalse.ok).toBe(false);
      expect(badTrueFalse.msg).toContain("harus True atau False");

      const good = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({
          sibarges_id: sibargesId1,
          data: { check_total_waiting_disch_mv: "Yes", check_part_1: "True" },
        })
      );
      expect(good.ok).toBe(true);
    });

    it("upsert round-trip: created_by stays fixed, updated_at advances on a second save", async () => {
      const client = await loginAs(opUser, opPassword);
      const before = await getBargeOperationRow(sibargesId1);

      await new Promise((resolve) => setTimeout(resolve, 1100));
      const res = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({ sibarges_id: sibargesId1, data: { qty: "999" } })
      );
      expect(res.ok).toBe(true);

      const after = await getBargeOperationRow(sibargesId1);
      expect(after?.created_by).toBe(before?.created_by);
      expect(after?.updated_at).not.toBe(before?.updated_at);
    });

    it("routes operation_remarks to the remarks column, not into operation_data", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.postJsonBody<AjaxResult>(
        saveOperationUrl(),
        saveOperationBody({
          sibarges_id: sibargesId1,
          data: { operation_remarks: "hello world" },
        })
      );
      expect(res.ok).toBe(true);
      expect(res.data.operation_remarks).toBe("hello world");

      const raw = await getBargeOperationRow(sibargesId1);
      expect(raw?.remarks).toBe("hello world");
      const rawData = decodeRawOperationData(raw?.operation_data);
      expect(rawData.operation_remarks).toBeUndefined();
    });
  });

  describe("import_operation_csv", () => {
    it("rejects import for non-IT users", async () => {
      const client = await loginAs(opUser, opPassword);
      const csv = buildOperationCsv([{ si_barges: "x", no_pk: noPk }]);
      const res = await client.postJsonMultipart<AjaxResult>(
        importOperationUrl(),
        importOperationFields(),
        { fieldName: "csv", filename: "import.csv", content: csv }
      );
      expect(res.ok).toBe(false);
      expect(res.msg).toContain("Hanya Divisi IT");
    });

    it("rejects a CSV missing a required column", async () => {
      const itUser = `it_${uid}`;
      await seedLegacyUser(itUser, opPassword, "Staff", "IT");
      try {
        const client = await loginAs(itUser, opPassword);
        const header = TLU_CSV_COLUMNS.filter((c) => c !== "remarks").join(",");
        const res = await client.postJsonMultipart<AjaxResult>(
          importOperationUrl(),
          importOperationFields(),
          { fieldName: "csv", filename: "import.csv", content: `${header}\n` }
        );
        expect(res.ok).toBe(false);
        expect(res.msg).toContain("remarks");
      } finally {
        await deleteUserRow(itUser);
      }
    });

    // Legacy PHP bug discovered while writing this test: import_operation_csv's
    // $countStmt (discharge_sequence max-per-vessel lookup, 8tluoperation.php
    // ~878-887) is prepared once and reused across rows via bind_result()+
    // fetch() but is never closed/store_result()'d between iterations —
    // unlike save_operation_data's equivalent countStmt, which is closed
    // immediately after each fetch (line 780). Any row with a non-blank
    // no_pk triggers this count query, and the next statement executed on
    // the same mysqli connection (the following row's $stmtFind, or this
    // row's own $stmtSave) then fatals with "Commands out of sync; you
    // can't run this command now" — i.e. current production PHP CSV import
    // crashes on essentially any real input. Not carrying the bug forward
    // (same precedent as the readOnly/showCycleTimeColumns note in issue
    // #11) — Node-only for the tests that reach this code path.
    it.skipIf(isPhp)("accumulates per-row errors without aborting the whole import", async () => {
      const itUser = `it_${uid}`;
      await seedLegacyUser(itUser, opPassword, "Staff", "IT");
      try {
        const client = await loginAs(itUser, opPassword);
        const sibargesRow = await getSibargesRow(sibargesId1);
        const siBarges = String(sibargesRow?.si_barges ?? "");

        const csv = buildOperationCsv([
          { si_barges: siBarges, no_pk: noPk, qty_disc: "100", rc: "10" },
          { si_barges: "UNKNOWN-SI", no_pk: noPk },
        ]);

        const res = await client.postJsonMultipart<AjaxResult>(
          importOperationUrl(),
          importOperationFields(),
          { fieldName: "csv", filename: "import.csv", content: csv }
        );
        expect(res.ok).toBe(true);
        expect(res.partial).toBe(true);
        expect(res.updated).toBe(1);
        expect(res.errors).toBe(1);
        expect(res.msg).toContain("SI Barges tidak ditemukan");
      } finally {
        await deleteUserRow(itUser);
      }
    });

    // Node-only: see the "Commands out of sync" note above.
    it.skipIf(isPhp)("flags an in-file duplicate (si_barges, no_pk) pair", async () => {
      const itUser = `it_${uid}`;
      await seedLegacyUser(itUser, opPassword, "Staff", "IT");
      try {
        const client = await loginAs(itUser, opPassword);
        const csv = buildOperationCsv([
          { si_barges: "DUP-SI", no_pk: noPk },
          { si_barges: "DUP-SI", no_pk: noPk },
        ]);
        const res = await client.postJsonMultipart<AjaxResult>(
          importOperationUrl(),
          importOperationFields(),
          { fieldName: "csv", filename: "import.csv", content: csv }
        );
        expect(res.errors).toBe(2);
        expect(res.msg).toContain("duplikat");
      } finally {
        await deleteUserRow(itUser);
      }
    });

    // Node-only: see the "Commands out of sync" note above.
    it.skipIf(isPhp)("wholesale-replaces operation_data on import (no baseline merge, unlike save)", async () => {
      const itUser = `it_${uid}`;
      await seedLegacyUser(itUser, opPassword, "Staff", "IT");
      try {
        const client = await loginAs(itUser, opPassword);
        const sibargesRow = await getSibargesRow(sibargesId1);
        const siBarges = String(sibargesRow?.si_barges ?? "");

        // Baseline (from beforeEach) has barge_vendor + qty_disc set. Import a
        // row for the same si_barges/no_pk that only sets rc.
        const csv = buildOperationCsv([{ si_barges: siBarges, no_pk: noPk, rc: "5", remarks: "from csv" }]);
        const res = await client.postJsonMultipart<AjaxResult>(
          importOperationUrl(),
          importOperationFields(),
          { fieldName: "csv", filename: "import.csv", content: csv }
        );
        expect(res.ok).toBe(true);
        expect(res.updated).toBe(1);

        const raw = await getBargeOperationRow(sibargesId1);
        const rawData = decodeRawOperationData(raw?.operation_data);
        expect(rawData.barge_vendor).toBeUndefined();
        expect(rawData.qty_disc).toBeUndefined();
        expect(rawData.rc).toBe("5");
        // remarks column sourced from the CSV's own `remarks` column, not `operation_remarks`.
        expect(raw?.remarks).toBe("from csv");
      } finally {
        await deleteUserRow(itUser);
      }
    });
  });

  describe("tlu_grouped_export_data", () => {
    it("rejects an invalid scope", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(groupedExportUrl({ scope: "bogus" }));
      const json = JSON.parse(res.body) as AjaxResult;
      expect(json.ok).toBe(false);
      expect(json.msg).toContain("Pilihan export tidak valid");
    });

    it("validates year/month/no_pk depending on scope", async () => {
      const client = await loginAs(opUser, opPassword);

      const noYear = await client.get(groupedExportUrl({ scope: "vessel" }));
      expect((JSON.parse(noYear.body) as AjaxResult).msg).toContain("Tahun export tidak valid");

      const noMonth = await client.get(groupedExportUrl({ scope: "vessel", year: "2025" }));
      expect((JSON.parse(noMonth.body) as AjaxResult).msg).toContain("Bulan export tidak valid");

      const noNoPk = await client.get(
        groupedExportUrl({ scope: "vessel", year: "2025", month: "6" })
      );
      expect((JSON.parse(noNoPk.body) as AjaxResult).msg).toContain("Mother Vessel wajib dipilih");

      const monthNoYear = await client.get(groupedExportUrl({ scope: "month", month: "6" }));
      expect((JSON.parse(monthNoYear.body) as AjaxResult).msg).toContain("Tahun export tidak valid");

      const yearNoYear = await client.get(groupedExportUrl({ scope: "year" }));
      expect((JSON.parse(yearNoYear.body) as AjaxResult).msg).toContain("Tahun export tidak valid");
    });

    it("returns ok:false when no rows match the scope", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(groupedExportUrl({ scope: "year", year: "2099" }));
      const json = JSON.parse(res.body) as AjaxResult;
      expect(json.ok).toBe(false);
      expect(json.msg).toContain("Data Barges tidak ditemukan untuk pilihan export ini");
    });

    it("scope=vessel: returns our two barges ordered by discharge_sequence/barge_seq, raw (not cycle-time-computed), with the exact filename", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(
        groupedExportUrl({ scope: "vessel", year: "2025", month: "6", no_pk: noPk })
      );
      const json = JSON.parse(res.body) as AjaxResult;
      expect(json.ok).toBe(true);
      expect(json.filename).toBe(`tlu_${noPk}—${mothervessel}.csv`);

      const rows = (json.rows ?? []) as DecodedRow[];
      expect(rows).toHaveLength(2);
      expect(String(rows[0].id)).toBe(String(sibargesId1));
      expect(String(rows[1].id)).toBe(String(sibargesId2));

      const data1 = decodeRawOperationData(rows[0].operation_data);
      expect(data1.discharge_sequence).toBe("1");
      expect(data1.qty_disc).toBe("1000");
      // Raw, not cycle-time-computed — ADR-0001: no calculate*() output baked in.
      expect(data1.waiting_loading_jetty).toBeUndefined();
    });

    it("scope=month/year/all: include our two barges, with the exact filename", async () => {
      const client = await loginAs(opUser, opPassword);
      const oursIds = new Set([String(sibargesId1), String(sibargesId2)]);

      const month = await client.get(
        groupedExportUrl({ scope: "month", year: "2025", month: "6" })
      );
      const monthJson = JSON.parse(month.body) as AjaxResult;
      expect(monthJson.ok).toBe(true);
      expect(monthJson.filename).toBe("tlu_2025-06.csv");
      expect(
        (monthJson.rows as DecodedRow[]).filter((r) => oursIds.has(String(r.id)))
      ).toHaveLength(2);

      const year = await client.get(groupedExportUrl({ scope: "year", year: "2025" }));
      const yearJson = JSON.parse(year.body) as AjaxResult;
      expect(yearJson.ok).toBe(true);
      expect(yearJson.filename).toBe("tlu_2025.csv");
      expect(
        (yearJson.rows as DecodedRow[]).filter((r) => oursIds.has(String(r.id)))
      ).toHaveLength(2);

      const all = await client.get(groupedExportUrl({ scope: "all" }));
      const allJson = JSON.parse(all.body) as AjaxResult;
      expect(allJson.ok).toBe(true);
      expect(allJson.filename).toBe("tlu_all.csv");
      expect(
        (allJson.rows as DecodedRow[]).filter((r) => oursIds.has(String(r.id)))
      ).toHaveLength(2);
    });
  });

  describe("download=tlu_operation_template", () => {
    function csvHeaderIndex(header: string[]) {
      return (column: string) => header.indexOf(column);
    }

    it("rejects an invalid scope", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(templateDownloadUrl({ scope: "bogus" }));
      expect(res.status).toBe(400);
      expect(res.body).toContain("Pilihan template tidak valid");
    });

    it("scope=vessel requires no_pk", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(templateDownloadUrl({ scope: "vessel" }));
      expect(res.status).toBe(400);
      expect(res.body).toContain("No PK wajib dipilih");
    });

    it("scope=vessel: 404 when no SI Barges match", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(
        templateDownloadUrl({ scope: "vessel", no_pk: `NOPE-${uid}` })
      );
      expect(res.status).toBe(404);
      expect(res.body).toContain("Data SI Barges tidak ditemukan");
    });

    it("scope=vessel: not IT-gated — an Operation user gets a formatted CSV template", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(templateDownloadUrl({ scope: "vessel", no_pk: noPk }));
      expect(res.status).toBe(200);
      expect(res.contentType).toContain("text/csv");
      expect(decodeContentDisposition(res.contentDisposition)).toContain(
        `template_tlu_${noPk}—${mothervessel}.csv`
      );

      const allRows = parseCsv(stripBom(res.body));
      const header = allRows[0];
      expect(header).toEqual([...TLU_CSV_COLUMNS]);
      const idx = csvHeaderIndex(header);

      const ourRows = allRows.slice(1).filter((r) => r[idx("no_pk")] === noPk);
      expect(ourRows).toHaveLength(2);

      // barge_seq ASC order: sibargesId1 (has an operation row) first.
      const [row1, row2] = ourRows;
      expect(row1[idx("barge_vendor")]).toBe(vendorName);
      expect(row1[idx("qty_disc")]).toBe("1,000");
      expect(row1[idx("rc")]).toBe("0");
      expect(row1[idx("qty_actual")]).toBe("1,000");
      expect(row1[idx("laycan_start")]).toBe("01/Jun/25 00:00");
      expect(row1[idx("laycan_end")]).toBe("02/Jun/25 00:00");

      // sibargesId2 has no barge_operations row: qty/barge_vendor fields blank.
      expect(row2[idx("barge_vendor")]).toBe("");
      expect(row2[idx("qty_disc")]).toBe("");
      expect(row2[idx("qty_actual")]).toBe("");
    });

    it("scope=year: rejects non-IT users with 403", async () => {
      const client = await loginAs(opUser, opPassword);
      const res = await client.get(templateDownloadUrl({ scope: "year", year: "2025" }));
      expect(res.status).toBe(403);
      expect(res.body).toContain("Hanya Divisi IT");
    });

    it("scope=year: IT user with an invalid/missing year gets 400", async () => {
      const itUser = `it_${uid}`;
      await seedLegacyUser(itUser, opPassword, "Staff", "IT");
      try {
        const client = await loginAs(itUser, opPassword);
        const res = await client.get(templateDownloadUrl({ scope: "year" }));
        expect(res.status).toBe(400);
        expect(res.body).toContain("Tahun tidak valid");
      } finally {
        await deleteUserRow(itUser);
      }
    });

    it("scope=year: IT user gets a CSV grouped by vessel, blank-line-separated", async () => {
      const itUser = `it_${uid}`;
      await seedLegacyUser(itUser, opPassword, "Staff", "IT");

      const noPk2 = `TLU2.${uid}`;
      const mothervessel2 = `MV TLU2 ${uid}`;
      await seedVesselRow({
        no_pk: noPk2,
        no_si_vessel: "071",
        buyer: "BUYER TEST 2",
        mothervessel: mothervessel2,
        anchorage: "MUARA BERAU",
        term: "FOB",
      });
      const sibargesId3 = await seedSibargesRow({
        no_pk: noPk2,
        no_si_vessel: "071",
        buyer: "BUYER TEST 2",
        mothervessel: mothervessel2,
        barge_seq: 1,
        jetty_code: jettyCode,
        shipper_code: shipperCode,
        laycan_start: "2025-07-01",
        laycan_end: "2025-07-02",
      });

      try {
        const client = await loginAs(itUser, opPassword);
        const res = await client.get(templateDownloadUrl({ scope: "year", year: "2025" }));
        expect(res.status).toBe(200);

        const allRows = parseCsv(stripBom(res.body));
        const header = allRows[0];
        const idx = csvHeaderIndex(header);
        const blocks = splitIntoVesselBlocks(allRows.slice(1));

        // Every blank-separated block must belong to exactly one vessel.
        for (const block of blocks) {
          const noPksInBlock = new Set(block.map((row) => row[idx("no_pk")]));
          expect(noPksInBlock.size).toBe(1);
        }

        const ourBlock = blocks.find((b) => b[0][idx("no_pk")] === noPk);
        expect(ourBlock).toHaveLength(2);
        const otherBlock = blocks.find((b) => b[0][idx("no_pk")] === noPk2);
        expect(otherBlock).toHaveLength(1);
      } finally {
        await deleteSibargesRow(sibargesId3);
        await deleteVesselRow(noPk2);
        await deleteUserRow(itUser);
      }
    });
  });
});
