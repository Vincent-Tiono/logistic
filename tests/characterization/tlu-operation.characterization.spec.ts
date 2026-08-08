import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { deleteJettyRow, seedJettyRow } from "./jetty-fixture.js";
import { deleteShipperRow, seedShipperRow } from "./shipper-fixture.js";
import { deleteSibargesRow, seedSibargesRow } from "./sibarges-fixture.js";
import {
  deleteBargeOperationRow,
  seedBargeOperationRow,
} from "./tlu-operation-fixture.js";
import { targets } from "./targets.js";
import { deleteVendorRow, seedVendorRow } from "./vendor-fixture.js";
import { deleteVesselRow, seedVesselRow } from "./vessel-fixture.js";

interface AjaxResult {
  ok: boolean;
  msg?: string;
  data?: any[];
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

  function siBargesByVesselUrl(no_pk: string) {
    const isPhp = target.name.startsWith("PHP");
    const ajaxPrefix = isPhp ? "" : "ajax=1&";
    return `${target.paths.tluOperation}?${ajaxPrefix}action=si_barges_by_vessel&no_pk=${encodeURIComponent(no_pk)}`;
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
});
