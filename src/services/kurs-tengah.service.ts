import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  defaultDateRange,
  fetchBiKursCached,
  paginateRows,
  validDateStr,
  type BiKursConfig,
  type PageResult,
} from "../lib/bi-kurs.js";

export interface KursTengahRow {
  tanggal: string;
  jual: number;
  beli: number;
  tengah: number;
}

const config: BiKursConfig<KursTengahRow> = {
  endpoint: "getSubKursLokal3",
  cachePrefix: "kurs-tengah",
  parseRow: (fields) => {
    const tanggal = fields.tgl_subkurslokal;
    const jualRaw = fields.jual_subkurslokal;
    const beliRaw = fields.beli_subkurslokal;
    if (!tanggal || jualRaw === undefined || beliRaw === undefined) return null;
    const jual = Number(jualRaw);
    const beli = Number(beliRaw);
    return { tanggal, jual, beli, tengah: (jual + beli) / 2 };
  },
};

const MTS = "USD";
const PER_PAGE = 15;

export interface KursTengahQuery {
  dari?: string;
  sampai?: string;
  page?: number;
}

export interface KursTengahResult extends PageResult<KursTengahRow> {
  /** Live fetch to bi.go.id failed on this request. */
  fetchFailed: boolean;
  /** fetchFailed was true, but pageData was recovered from kurs_tengah_rates
   * (previously cached dates) rather than being genuinely empty. */
  usingStaleData: boolean;
}

/** Unpaginated fetch for a specific date range, used by the Barges MHU daily engine. */
export function getKursTengahRange(
  startDate: string,
  endDate: string
): Promise<KursTengahRow[] | null> {
  return fetchBiKursCached(config, MTS, startDate, endDate);
}

/** Upserts every fetched row into kurs_tengah_rates so it survives a later bi.go.id outage. */
async function persistKursTengahRows(pool: Pool, rows: KursTengahRow[]): Promise<void> {
  if (rows.length === 0) return;
  const values = rows.map((r) => [MTS, r.tanggal, r.jual, r.beli]);
  await pool.query(
    "INSERT INTO kurs_tengah_rates (mts, tanggal, jual, beli) VALUES ? ON DUPLICATE KEY UPDATE jual = VALUES(jual), beli = VALUES(beli)",
    [values]
  );
}

/** Reads whatever dates in [startDate, endDate] were cached from earlier successful fetches. */
async function readCachedKursTengahRows(
  pool: Pool,
  startDate: string,
  endDate: string
): Promise<KursTengahRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    {
      sql: "SELECT tanggal, jual, beli FROM kurs_tengah_rates WHERE mts = ? AND tanggal BETWEEN ? AND ?",
      dateStrings: true,
    },
    [MTS, startDate, endDate]
  );
  return rows.map((r) => {
    const jual = Number(r.jual);
    const beli = Number(r.beli);
    return { tanggal: String(r.tanggal), jual, beli, tengah: (jual + beli) / 2 };
  });
}

export async function getKursTengahPage(
  query: KursTengahQuery,
  pool: Pool
): Promise<KursTengahResult> {
  const dari = validDateStr(query.dari ?? "");
  const sampai = validDateStr(query.sampai ?? "");
  const isCustomRange = dari !== null && sampai !== null;

  const { startDate, endDate } = isCustomRange
    ? { startDate: dari, endDate: sampai }
    : defaultDateRange();

  const fetched = await fetchBiKursCached(config, MTS, startDate, endDate);
  const fetchFailed = fetched === null;

  let data: KursTengahRow[];
  let usingStaleData = false;
  if (fetched !== null) {
    await persistKursTengahRows(pool, fetched);
    data = fetched;
  } else {
    data = await readCachedKursTengahRows(pool, startDate, endDate);
    usingStaleData = data.length > 0;
  }

  data.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));

  const paged = paginateRows(data, query.page ?? 1, PER_PAGE);

  return { ...paged, fetchFailed, usingStaleData };
}
