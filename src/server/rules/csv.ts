/**
 * Minimal RFC 4180 CSV parser for the partner bulk-property upload. Handles quoted fields,
 * escaped quotes, commas and newlines inside quotes, CRLF, and a UTF-8 BOM.
 * Returns rows as objects keyed by the normalised header (lower-case, spaces → "_").
 */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");

  for (let index = 0; index < input.length; index++) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field === "") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  const [header, ...body] = nonEmpty;
  if (!header) return [];
  const keys = header.map((cell) => cell.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return body.map((cells) => Object.fromEntries(keys.map((key, index) => [key, (cells[index] ?? "").trim()])));
}
