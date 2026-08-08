const MONTH_MAP: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const ROMAN_MONTHS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

function isValidDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/** Strict YYYY-MM-DD check with real-calendar-date validation (no format fallbacks). */
export function isValidYmd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  return isValidDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Today's date in Asia/Jakarta (UTC+7, no DST) as YYYY-MM-DD. */
export function todayYmdInJakarta(now: Date = new Date()): string {
  const d = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Accepts, in order: strict YYYY-MM-DD, dd/mmm/yy(yy) (e.g. 16/Dec/25),
 * then a JS-native Date.parse fallback. Ports parseDateAny() from
 * Operation/7sibarges.php:34-71.
 */
export function parseDateAny(s: string | undefined): string | null {
  const trimmed = (s ?? "").trim();
  if (trimmed === "") return null;

  const strict = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (strict) {
    const year = Number(strict[1]);
    const month = Number(strict[2]);
    const day = Number(strict[3]);
    if (isValidDate(year, month, day)) {
      return trimmed;
    }
  }

  const normalized = trimmed.replace(/[-. ]/g, "/");
  const parts = normalized.split("/");
  if (parts.length === 3) {
    const day = Number(parts[0]);
    const monthToken = parts[1].toUpperCase();
    const month = MONTH_MAP[monthToken];
    let year = Number(parts[2]);
    if (month !== undefined && Number.isFinite(day) && Number.isFinite(year)) {
      if (year < 100) year += 2000;
      if (isValidDate(year, month, day)) {
        return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  const ts = Date.parse(trimmed);
  if (!Number.isNaN(ts)) {
    const d = new Date(ts);
    return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  return null;
}

/** Ports addDaysYmd() from Operation/7sibarges.php:73-79. */
export function addDaysYmd(ymd: string | null, days: number): string | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Ports romawiBulan() from Operation/7sibarges.php:81-84. */
export function romanMonth(month: number): string {
  return ROMAN_MONTHS[month - 1] ?? "";
}
