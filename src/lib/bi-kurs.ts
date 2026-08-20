import { XMLParser } from "fast-xml-parser";
import { addDaysYmd, isValidYmd, todayYmdInJakarta } from "./date.js";

/**
 * Shared client for Bank Indonesia's wskursbi.asmx GET webservice, used by
 * both the Jisdor and Kurs Tengah pages (Operation/1jisdor.php,
 * Operation/2kurstengah.php). The two pages differ only in which method
 * they call and which <Table> fields they read, so that's the seam this
 * module is parameterized on.
 */
export interface BiKursConfig<T> {
  endpoint: "getSubKursJisdor3" | "getSubKursLokal3";
  cachePrefix: string;
  parseRow: (fields: Record<string, string>) => T | null;
}

const BASE_URL = "https://www.bi.go.id/biwebservice/wskursbi.asmx";

function findAllTables(node: unknown): Record<string, unknown>[] {
  if (node === null || typeof node !== "object") return [];
  const result: Record<string, unknown>[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "Table") {
      const entries = Array.isArray(value) ? value : [value];
      for (const entry of entries) {
        if (entry && typeof entry === "object") {
          result.push(entry as Record<string, unknown>);
        }
      }
    } else if (value && typeof value === "object") {
      result.push(...findAllTables(value));
    }
  }
  return result;
}

function normalizeFields(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && typeof value === "object") continue;
    out[key] = String(value ?? "");
  }
  return out;
}

/** Fetches and parses one BI response. null = transient failure (worth retrying), [] = fetched OK but no rows. */
export async function fetchBiKurs<T>(
  config: BiKursConfig<T>,
  mts: string,
  startDate: string,
  endDate: string,
  fetchImpl: typeof fetch = fetch
): Promise<T[] | null> {
  const url = `${BASE_URL}/${config.endpoint}?${new URLSearchParams({
    mts,
    startdate: startDate,
    enddate: endDate,
  }).toString()}`;

  let raw: string;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    raw = await res.text();
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    const parser = new XMLParser({
      ignoreAttributes: true,
      removeNSPrefix: true,
      parseTagValue: false,
    });
    parsed = parser.parse(raw);
  } catch {
    return null;
  }

  const rows: T[] = [];
  for (const table of findAllTables(parsed)) {
    const row = config.parseRow(normalizeFields(table));
    if (row !== null) rows.push(row);
  }
  return rows;
}

interface CacheEntry {
  expiresAt: number;
  data: unknown;
}

const cache = new Map<string, CacheEntry>();

/** Test-only: reset the in-memory cache between spec files. */
export function clearBiKursCache(): void {
  cache.clear();
}

export async function fetchBiKursCached<T>(
  config: BiKursConfig<T>,
  mts: string,
  startDate: string,
  endDate: string,
  ttlSeconds = 900,
  fetchImpl: typeof fetch = fetch
): Promise<T[] | null> {
  const key = `${config.cachePrefix}|${mts}|${startDate}|${endDate}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data as T[];
  }

  const data = await fetchBiKurs(config, mts, startDate, endDate, fetchImpl);
  if (data !== null) {
    cache.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, data });
  }
  return data;
}

const BULAN_ID = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatTanggalID(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return isoDate;
  return `${day} ${BULAN_ID[month]} ${year}`;
}

/** Collapses a date range into the shortest Indonesian form that still reads
 * unambiguously — e.g. "9 – 11 Mei 2026" when month/year match, falling back
 * to full dates on both ends when they don't (cth: "30 Mei – 2 Juni 2026"). */
export function formatTanggalRangeID(isoStart: string, isoEnd: string): string {
  const start = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoStart);
  const end = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoEnd);
  if (!start || !end) return `${isoStart} – ${isoEnd}`;

  const [, startYear, startMonth, startDay] = start;
  const [, endYear, endMonth, endDay] = end;
  if (isoStart === isoEnd) return formatTanggalID(isoStart);

  if (startYear === endYear && startMonth === endMonth) {
    return `${Number(startDay)} – ${Number(endDay)} ${BULAN_ID[Number(startMonth)]} ${startYear}`;
  }
  return `${formatTanggalID(isoStart)} – ${formatTanggalID(isoEnd)}`;
}

export function formatRupiah(n: number): string {
  const fixed = n.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp${withThousands},${decPart}`;
}

/** Strict Y-m-d validation, mirrors PHP's validDateStr() round-trip check. */
export function validDateStr(s: string): string | null {
  if (!s) return null;
  return isValidYmd(s) ? s : null;
}

export interface PageResult<T> {
  pageData: T[];
  page: number;
  totalPages: number;
  totalRows: number;
}

export function paginateRows<T>(
  rows: T[],
  requestedPage: number,
  perPage: number
): PageResult<T> {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * perPage;
  return { pageData: rows.slice(start, start + perPage), page, totalPages, totalRows };
}

/** Default 45-days-back to 5-days-forward window, anchored on Jakarta "today". */
export function defaultDateRange(now: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const today = todayYmdInJakarta(now);
  return {
    startDate: addDaysYmd(today, -45) ?? today,
    endDate: addDaysYmd(today, 5) ?? today,
  };
}
