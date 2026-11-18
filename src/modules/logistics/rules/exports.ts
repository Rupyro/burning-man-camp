// Builders' WAP list and the arrival manifest (docs/specs/logistics.md §3, L5). Pure.
export interface MemberRow {
  name: string;
  email: string;
  status: string;
  buildCommitment: "none" | "partial" | "full";
  /** Arrival as a camp-day date (YYYY-MM-DD), or null if unknown. */
  arrivalDay: string | null;
}

/** Quote one CSV field (RFC 4180), and defuse spreadsheet formulas. */
export function csvField(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Confirmed builders (partial or full), name and email only, sorted by name. */
export function wapCsv(rows: MemberRow[]): string {
  const lines = rows
    .filter((r) => r.status === "confirmed" && r.buildCommitment !== "none")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => `${csvField(r.name)},${csvField(r.email)}`);
  return ["name,email", ...lines].join("\n");
}

/** Confirmed members grouped by arrival day (unknown last). */
export function arrivalsByDay(rows: MemberRow[]): { day: string | null; names: string[] }[] {
  const by = new Map<string | null, string[]>();
  for (const r of rows.filter((x) => x.status === "confirmed"))
    by.set(r.arrivalDay, [...(by.get(r.arrivalDay) ?? []), r.name]);
  return [...by.entries()]
    .sort(([a], [b]) => (a ?? "9999").localeCompare(b ?? "9999"))
    .map(([day, names]) => ({ day, names: names.sort((a, b) => a.localeCompare(b)) }));
}

/** The manifest as CSV: day,name,builder. */
export function arrivalsCsv(rows: MemberRow[]): string {
  const builder = new Map(rows.map((r) => [r.name, r.buildCommitment !== "none"]));
  const out = ["day,name,builder"];
  for (const g of arrivalsByDay(rows))
    for (const n of g.names)
      out.push(`${g.day ?? "unknown"},${csvField(n)},${builder.get(n) ? "yes" : "no"}`);
  return out.join("\n");
}
