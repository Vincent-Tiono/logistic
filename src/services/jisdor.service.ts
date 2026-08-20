import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  defaultDateRange,
  fetchBiKursCached,
  paginateRows,
  validDateStr,
  type BiKursConfig,
  type PageResult,
} from "../lib/bi-kurs.js";

export interface JisdorRow {
  tanggal: string;
  kurs: number;
}

const config: BiKursConfig<JisdorRow> = {
  endpoint: "getSubKursJisdor3",
  cachePrefix: "jisdor",
  parseRow: (fields) => {
    const tanggal = fields.tgl_subkursasing;
    const kursRaw = fields.beli_subkursasing;
    if (!tanggal || kursRaw === undefined) return null;
    return { tanggal, kurs: Number(kursRaw) };
  },
};

const MTS = "USD";
const PER_PAGE = 15;

export interface JisdorQuery {
  dari?: string;
  sampai?: string;
  page?: number;
}

export interface JisdorResult extends PageResult<JisdorRow> {
  /** Live fetch to bi.go.id failed on this request. */
  fetchFailed: boolean;
  /** fetchFailed was true, but pageData was recovered from jisdor_rates
   * (previously cached dates) rather than being genuinely empty. */
  usingStaleData: boolean;
}

/** Unpaginated fetch for a specific date range, used by the Barges MHU daily engine. */
export function getJisdorRange(startDate: string, endDate: string): Promise<JisdorRow[] | null> {
  return fetchBiKursCached(config, MTS, startDate, endDate);
}

/** Upserts every fetched row into jisdor_rates so it survives a later bi.go.id outage. */
async function persistJisdorRows(pool: Pool, rows: JisdorRow[]): Promise<void> {
  if (rows.length === 0) return;
  const values = rows.map((r) => [MTS, r.tanggal, r.kurs]);
  await pool.query(
    "INSERT INTO jisdor_rates (mts, tanggal, kurs) VALUES ? ON DUPLICATE KEY UPDATE kurs = VALUES(kurs)",
    [values]
  );
}

/** Reads whatever dates in [startDate, endDate] were cached from earlier successful fetches. */
async function readCachedJisdorRows(
  pool: Pool,
  startDate: string,
  endDate: string
): Promise<JisdorRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    {
      sql: "SELECT tanggal, kurs FROM jisdor_rates WHERE mts = ? AND tanggal BETWEEN ? AND ?",
      dateStrings: true,
    },
    [MTS, startDate, endDate]
  );
  return rows.map((r) => ({ tanggal: String(r.tanggal), kurs: Number(r.kurs) }));
}

export async function getJisdorPage(query: JisdorQuery, pool: Pool): Promise<JisdorResult> {
  const dari = validDateStr(query.dari ?? "");
  const sampai = validDateStr(query.sampai ?? "");
  const isCustomRange = dari !== null && sampai !== null;

  const { startDate, endDate } = isCustomRange
    ? { startDate: dari, endDate: sampai }
    : defaultDateRange();

  const fetched = await fetchBiKursCached(config, MTS, startDate, endDate);
  const fetchFailed = fetched === null;

  let data: JisdorRow[];
  let usingStaleData = false;
  if (fetched !== null) {
    await persistJisdorRows(pool, fetched);
    data = fetched;
  } else {
    data = await readCachedJisdorRows(pool, startDate, endDate);
    usingStaleData = data.length > 0;
  }

  data.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));

  const paged = paginateRows(data, query.page ?? 1, PER_PAGE);

  return { ...paged, fetchFailed, usingStaleData };
}
