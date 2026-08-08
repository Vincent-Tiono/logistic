import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBiKursCache,
  defaultDateRange,
  fetchBiKurs,
  fetchBiKursCached,
  formatRupiah,
  formatTanggalID,
  paginateRows,
  validDateStr,
  type BiKursConfig,
} from "../../src/lib/bi-kurs.js";

interface JisdorRow {
  tanggal: string;
  kurs: number;
}

const jisdorConfig: BiKursConfig<JisdorRow> = {
  endpoint: "getSubKursJisdor3",
  cachePrefix: "jisdor-test",
  parseRow: (fields) => {
    const tanggal = fields.tgl_subkursasing;
    const kurs = fields.beli_subkursasing;
    if (!tanggal || kurs === undefined) return null;
    return { tanggal, kurs: Number(kurs) };
  },
};

const XML_TWO_ROWS = `<?xml version="1.0" encoding="utf-8"?>
<NewDataSet xmlns="http://tempuri.org/">
  <Table diffgr:id="Table1" xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
    <tgl_subkursasing>2024-01-02</tgl_subkursasing>
    <beli_subkursasing>15645.00</beli_subkursasing>
  </Table>
  <Table diffgr:id="Table2" xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
    <tgl_subkursasing>2024-01-03</tgl_subkursasing>
    <beli_subkursasing>15700.50</beli_subkursasing>
  </Table>
</NewDataSet>`;

const XML_EMPTY = `<?xml version="1.0" encoding="utf-8"?>
<NewDataSet xmlns="http://tempuri.org/"></NewDataSet>`;

function fakeFetch(body: string, status = 200): typeof fetch {
  return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

beforeEach(() => {
  clearBiKursCache();
});

describe("formatRupiah", () => {
  it("formats with dot thousands separator and comma decimal", () => {
    expect(formatRupiah(1234567.5)).toBe("Rp1.234.567,50");
  });

  it("formats small values", () => {
    expect(formatRupiah(15645)).toBe("Rp15.645,00");
  });
});

describe("formatTanggalID", () => {
  it("formats an ISO date into Indonesian long form", () => {
    expect(formatTanggalID("2024-01-05")).toBe("5 Januari 2024");
  });

  it("returns the original string when unparseable", () => {
    expect(formatTanggalID("not-a-date")).toBe("not-a-date");
  });
});

describe("validDateStr", () => {
  it("accepts a real calendar date in Y-m-d form", () => {
    expect(validDateStr("2024-02-10")).toBe("2024-02-10");
  });

  it("rejects an impossible calendar date", () => {
    expect(validDateStr("2024-02-30")).toBeNull();
  });

  it("rejects empty and malformed input", () => {
    expect(validDateStr("")).toBeNull();
    expect(validDateStr("10/02/2024")).toBeNull();
  });
});

describe("paginateRows", () => {
  const rows = Array.from({ length: 37 }, (_, i) => i);

  it("slices the requested page", () => {
    const result = paginateRows(rows, 3, 15);
    expect(result.pageData).toEqual(rows.slice(30, 37));
    expect(result.totalPages).toBe(3);
    expect(result.totalRows).toBe(37);
    expect(result.page).toBe(3);
  });

  it("clamps a page beyond the last page", () => {
    const result = paginateRows(rows, 99, 15);
    expect(result.page).toBe(3);
    expect(result.pageData).toEqual(rows.slice(30, 37));
  });

  it("clamps a page below 1", () => {
    const result = paginateRows(rows, 0, 15);
    expect(result.page).toBe(1);
  });

  it("returns totalPages of 1 for empty rows", () => {
    const result = paginateRows([], 1, 15);
    expect(result.totalPages).toBe(1);
    expect(result.pageData).toEqual([]);
  });
});

describe("defaultDateRange", () => {
  it("spans 45 days back to 5 days forward from Jakarta today", () => {
    const now = new Date("2024-06-15T10:00:00Z"); // 17:00 Jakarta
    const range = defaultDateRange(now);
    expect(range.startDate).toBe("2024-05-01");
    expect(range.endDate).toBe("2024-06-20");
  });
});

describe("fetchBiKurs", () => {
  it("parses Table rows via the config's field mapping", async () => {
    const fetchImpl = fakeFetch(XML_TWO_ROWS);
    const rows = await fetchBiKurs(jisdorConfig, "USD", "2024-01-01", "2024-01-05", fetchImpl);
    expect(rows).toEqual([
      { tanggal: "2024-01-02", kurs: 15645 },
      { tanggal: "2024-01-03", kurs: 15700.5 },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const calledUrl = String((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(calledUrl).toContain("getSubKursJisdor3");
    expect(calledUrl).toContain("mts=USD");
  });

  it("returns an empty array when the feed has no rows", async () => {
    const rows = await fetchBiKurs(jisdorConfig, "USD", "2024-01-01", "2024-01-05", fakeFetch(XML_EMPTY));
    expect(rows).toEqual([]);
  });

  it("returns null on HTTP failure (retry-worthy)", async () => {
    const rows = await fetchBiKurs(jisdorConfig, "USD", "2024-01-01", "2024-01-05", fakeFetch("", 500));
    expect(rows).toBeNull();
  });

  it("returns null when the network throws", async () => {
    const throwing = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const rows = await fetchBiKurs(jisdorConfig, "USD", "2024-01-01", "2024-01-05", throwing);
    expect(rows).toBeNull();
  });

  it("returns null on unparseable XML", async () => {
    const rows = await fetchBiKurs(jisdorConfig, "USD", "2024-01-01", "2024-01-05", fakeFetch("<<not xml"));
    expect(rows).toBeNull();
  });
});

describe("fetchBiKursCached", () => {
  it("serves a second call within the TTL from cache without refetching", async () => {
    const fetchImpl = fakeFetch(XML_TWO_ROWS);
    const first = await fetchBiKursCached(jisdorConfig, "USD", "2024-01-01", "2024-01-05", 900, fetchImpl);
    const second = await fetchBiKursCached(jisdorConfig, "USD", "2024-01-01", "2024-01-05", 900, fetchImpl);
    expect(first).toEqual(second);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refetches once the TTL has elapsed", async () => {
    const fetchImpl = fakeFetch(XML_TWO_ROWS);
    await fetchBiKursCached(jisdorConfig, "USD", "2024-01-01", "2024-01-05", 0, fetchImpl);
    await fetchBiKursCached(jisdorConfig, "USD", "2024-01-01", "2024-01-05", 0, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed fetch", async () => {
    const failing = fakeFetch("", 500);
    const result = await fetchBiKursCached(jisdorConfig, "USD", "2024-01-01", "2024-01-05", 900, failing);
    expect(result).toBeNull();
    expect(failing).toHaveBeenCalledTimes(1);
    const again = await fetchBiKursCached(jisdorConfig, "USD", "2024-01-01", "2024-01-05", 900, failing);
    expect(again).toBeNull();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("keys the cache by mts/startDate/endDate so different ranges don't collide", async () => {
    const fetchImpl = fakeFetch(XML_TWO_ROWS);
    await fetchBiKursCached(jisdorConfig, "USD", "2024-01-01", "2024-01-05", 900, fetchImpl);
    await fetchBiKursCached(jisdorConfig, "USD", "2024-02-01", "2024-02-05", 900, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
