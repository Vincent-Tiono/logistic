const ONES = [
  "",
  "Satu",
  "Dua",
  "Tiga",
  "Empat",
  "Lima",
  "Enam",
  "Tujuh",
  "Delapan",
  "Sembilan",
];

/** Converts 0-999 to Indonesian words, without a trailing scale word. */
function belowThousand(n: number): string {
  if (n === 0) return "";
  if (n < 10) return ONES[n];
  if (n < 20) return n === 10 ? "Sepuluh" : n === 11 ? "Sebelas" : `${ONES[n - 10]} Belas`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const rest = n % 10;
    return rest === 0 ? `${ONES[tens]} Puluh` : `${ONES[tens]} Puluh ${ONES[rest]}`;
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hundredsWord = hundreds === 1 ? "Seratus" : `${ONES[hundreds]} Ratus`;
  return rest === 0 ? hundredsWord : `${hundredsWord} ${belowThousand(rest)}`;
}

const SCALES: Array<[number, string]> = [
  [1_000_000_000, "Milyar"],
  [1_000_000, "Juta"],
  [1_000, "Ribu"],
];

/** Converts a non-negative integer to Indonesian words (e.g. 35000000 -> "Tiga Puluh Lima Juta"). */
export function terbilang(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`terbilang: expected a non-negative integer, got ${value}`);
  }
  if (value === 0) return "Nol";

  let remaining = value;
  const parts: string[] = [];

  for (const [scale, scaleWord] of SCALES) {
    const count = Math.floor(remaining / scale);
    if (count > 0) {
      const countWord = scale === 1_000 && count === 1 ? "Se" + scaleWord.toLowerCase() : `${belowThousand(count)} ${scaleWord}`;
      parts.push(countWord);
      remaining %= scale;
    }
  }

  if (remaining > 0) {
    parts.push(belowThousand(remaining));
  }

  return parts.join(" ");
}
