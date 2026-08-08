/** Minimal RFC4180-ish CSV parser: configurable delimiter (default comma),
 * double-quote enclosure with "" escaping, tolerant of trailing rows with
 * no newline. */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // skip
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Sniffs the delimiter of a CSV's first line by trying comma/semicolon/tab
 * and picking whichever yields the most fields, mirroring the inline
 * detection in Operation/7sibarges.php:1371-1379. */
export function detectCsvDelimiter(firstLine: string): string {
  let best = ",";
  let bestCount = 0;
  for (const candidate of [",", ";", "\t"]) {
    const count = parseCsv(firstLine, candidate)[0]?.length ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}
