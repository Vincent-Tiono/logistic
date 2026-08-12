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
  fetchFailed: boolean;
}

/** Unpaginated fetch for a specific date range, used by the Barges MHU daily engine. */
export function getKursTengahRange(
  startDate: string,
  endDate: string
): Promise<KursTengahRow[] | null> {
  return fetchBiKursCached(config, MTS, startDate, endDate);
}

export async function getKursTengahPage(
  query: KursTengahQuery
): Promise<KursTengahResult> {
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
