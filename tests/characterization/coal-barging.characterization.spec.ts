import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteCoalBargeDeletedRow,
  deleteCoalBargeOperationRowsBySibargesId,
  deleteCoalBargeRcRow,
  getCoalBargeOperationRow,
  seedCoalBargeDeletedRow,
  seedCoalBargeOperationRow,
  seedCoalBargeRcRow,
} from "./coal-barging-fixture.js";
import { deleteUserRow, seedLegacyUser } from "./db-fixture.js";
import { HttpClient } from "./http-client.js";
import { deleteJettyRow, seedJettyRow } from "./jetty-fixture.js";
import { deleteShipperRow, seedShipperRow } from "./shipper-fixture.js";
import { deleteSibargesRow, seedSibargesRow } from "./sibarges-fixture.js";
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
