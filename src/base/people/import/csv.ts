/** RFC 4180 CSV: quoted fields, "" escapes, CRLF or LF, a leading BOM. Blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  const src = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
    field = "";
  };
  while (i < src.length) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (c === '"') quoted = false;
      else field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      endRow();
      if (c === "\r" && src[i + 1] === "\n") i++;
    } else field += c;
    i++;
  }
  if (quoted) throw new Error("The CSV has an unterminated quote");
  if (field !== "" || row.length) endRow();
  return rows;
}
