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
  fetchFailed: boolean;
}

/** Unpaginated fetch for a specific date range, used by the Barges MHU daily engine. */
export function getJisdorRange(startDate: string, endDate: string): Promise<JisdorRow[] | null> {
  return fetchBiKursCached(config, MTS, startDate, endDate);
}

export async function getJisdorPage(query: JisdorQuery): Promise<JisdorResult> {
  const dari = validDateStr(query.dari ?? "");
  const sampai = validDateStr(query.sampai ?? "");
  const isCustomRange = dari !== null && sampai !== null;

  const { startDate, endDate } = isCustomRange
    ? { startDate: dari, endDate: sampai }
    : defaultDateRange();

  const fetched = await fetchBiKursCached(config, MTS, startDate, endDate);
  const fetchFailed = fetched === null;
  const data = fetched ?? [];

  data.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));

  const paged = paginateRows(data, query.page ?? 1, PER_PAGE);

  return { ...paged, fetchFailed };
}
