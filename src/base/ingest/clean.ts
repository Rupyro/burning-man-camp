// Shared dry-run cleaner for raw member, tool-list and family-year sheets (ingestion stage b).
// Pure: never writes anywhere. The report lists field names and issue codes only, never values,
// so it can be shared without leaking names, emails, phone numbers or ID numbers.
import { CAMP_START_YEAR } from "@/lib/family-years";
import { parseCsv } from "../people/import/csv";
import { IMPORT_FIELDS } from "../people/import/mapping";

export interface Cleaned<T> {
  value: T;
  issue?: string;
}

export const tidy = (s: string | undefined | null): string => (s ?? "").replace(/\s+/g, " ").trim();

const PARTICLES = new Set(["van", "der", "de", "du", "von", "la", "le", "den", "ter"]);

/** "mARY-jane van der merwe" -> "Mary-Jane van der Merwe". */
export function titleCase(s: string): string {
  return tidy(s)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w, i) =>
      i > 0 && PARTICLES.has(w)
        ? w
        : w
            .split(/(?=[-'])/)
            .map((p) => p.replace(/^([-']?)(.)/, (_, a, b) => a + b.toUpperCase()))
            .join(""),
    )
    .join(" ");
}

export function normEmail(raw: string): Cleaned<string | null> {
  const v = tidy(raw).toLowerCase();
  if (!v) return { value: null, issue: "blank" };
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? { value: v } : { value: null, issue: "bad_email" };
}

/** Local numbers are South African (0xx -> +27xx). Result is +digits, 10-15 digits long. */
export function normPhone(raw: string): Cleaned<string | null> {
  const t = tidy(raw);
  if (!t) return { value: null, issue: "blank" };
  let d = t.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = `+${d.slice(2)}`;
  else if (d.startsWith("0")) d = `+27${d.slice(1)}`;
  else if (!d.startsWith("+")) d = `+${d}`;
  const digits = d.slice(1).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15
    ? { value: `+${digits}` }
    : { value: null, issue: "bad_phone" };
}

type G = [string, string, string, string] & { index: number };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
function iso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? `${y}-${pad(m)}-${pad(d)}`
    : null;
}
const year = (s: string) => (s.length === 2 ? 2000 + Number(s) : Number(s));

/** To YYYY-MM-DD. Numeric dates are read day first (South Africa); flagged when it could be either. */
export function normDate(raw: string): Cleaned<string | null> {
  const t = tidy(raw).toLowerCase().replace(/,/g, "");
  if (!t) return { value: null, issue: "blank" };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t) as G | null;
  if (m) return ok(iso(+m[1], +m[2], +m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t) as G | null;
  if (m) {
    const v = iso(year(m[3]), +m[2], +m[1]);
    return v && +m[1] <= 12 && +m[2] <= 12 && m[1] !== m[2]
      ? { value: v, issue: "ambiguous_date" }
      : ok(v);
  }
  m = /^(\d{1,2}) ([a-z]+) (\d{4})$/.exec(t) as G | null;
  if (m) return ok(iso(+m[3], MONTHS.indexOf(m[2].slice(0, 3)) + 1, +m[1]));
  m = /^([a-z]+) (\d{1,2}) (\d{4})$/.exec(t) as G | null;
  if (m) return ok(iso(+m[3], MONTHS.indexOf(m[1].slice(0, 3)) + 1, +m[2]));
  return { value: null, issue: "bad_date" };
}
const ok = (v: string | null): Cleaned<string | null> =>
  v ? { value: v } : { value: null, issue: "bad_date" };

/** "a; b ;;A" -> ["a", "b"] (case-insensitive repeats dropped). */
export function splitList(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(";")
    .map(tidy)
    .filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()));
}

/** "Cloud feet x4" / "4x cable ties" / "Pegs ×12" -> name and quantity. "2x4 timber" is left alone. */
export function extractQty(raw: string): { name: string; qty: number | null } {
  const t = tidy(raw);
  const lead = /^(\d+)\s?[x×]\s+/i.exec(t) as G | null;
  if (lead) return { name: tidy(t.slice(lead[0].length)), qty: Number(lead[1]) };
  const inner = /(^|\s)[x×]\s?(\d+)(?=\s|$|[)])/i.exec(t) as G | null;
  if (inner)
    return {
      name: tidy(t.slice(0, inner.index) + t.slice(inner.index + inner[0].length)),
      qty: Number(inner[2]),
    };
  return { name: t, qty: null };
}

const STATUSES: Record<string, string> = {
  purchased: "purchased",
  bought: "purchased",
  "to be bought": "to_buy",
  "to buy": "to_buy",
  "to be checked": "to_check",
  "to check": "to_check",
  "not necessary": "not_needed",
  "not needed": "not_needed",
  built: "built",
  rent: "rent",
  rented: "rent",
};

/** The tool list's "situation" column mixes statuses and people; split them apart. */
export function splitStatus(raw: string): {
  status: string | null;
  person: string | null;
  issue?: string;
} {
  const t = tidy(raw);
  if (!t) return { status: null, person: null };
  const s = STATUSES[t.toLowerCase()];
  if (s) return { status: s, person: null };
  if (/^\p{Lu}[\p{L}'-]+( \p{Lu}[\p{L}'-]+)?$/u.test(t)) return { status: null, person: t };
  return { status: null, person: null, issue: "unknown_status" };
}

/** "2024, 2023; '25" -> [2023, 2024, 2025], only years from the first camp to now. */
export function normYears(raw: string, nowYear: number): Cleaned<number[]> {
  const found = (tidy(raw).match(/\d{4}|'\d{2}/g) ?? []).map((y) =>
    y.startsWith("'") ? 2000 + Number(y.slice(1)) : Number(y),
  );
  if (!found.length) return { value: [], issue: "blank" };
  const good = [...new Set(found.filter((y) => y >= CAMP_START_YEAR && y <= nowYear))].sort(
    (a, b) => a - b,
  );
  return good.length === new Set(found).size
    ? { value: good }
    : { value: good, issue: "year_out_of_range" };
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j] ?? 0;
      row[j] = Math.min(tmp + 1, (row[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length] ?? 0;
}

/** Index -> earlier row it repeats. Exact after tidying and lower-casing; near = 1 edit per 10 letters. */
export function findDuplicates(
  values: readonly string[],
): Map<number, { kind: "exact" | "near"; of: number }> {
  const keys = values.map((v) => tidy(v).toLowerCase());
  const out = new Map<number, { kind: "exact" | "near"; of: number }>();
  for (const [i, k] of keys.entries()) {
    if (!k) continue;
    const exact = keys.findIndex((o, j) => j < i && o === k);
    if (exact >= 0) {
      out.set(i, { kind: "exact", of: exact });
      continue;
    }
    const limit = Math.max(1, Math.floor(k.length / 10));
    const near = keys.findIndex(
      (o, j) => j < i && o && Math.abs(o.length - k.length) <= limit && distance(o, k) <= limit,
    );
    if (near >= 0) out.set(i, { kind: "near", of: near });
  }
  return out;
}

export type Kind = "members" | "tools" | "family";
export type Label = "ok" | "cleaned" | "needs_review" | "duplicate";
export interface CleanRow {
  line: number;
  label: Label;
  /** Field names that the cleaner changed (no values). */
  changes: string[];
  issues: string[];
}
export interface CleanReport {
  kind: Kind;
  headers: string[];
  counts: { rows: number } & Record<Label, number>;
  issues: Record<string, number>;
  rows: CleanRow[];
  warnings: string[];
}

const ALIASES: Record<Kind, Record<string, readonly string[]>> = {
  members: {
    name: IMPORT_FIELDS.fullName.aliases,
    first: IMPORT_FIELDS.firstName.aliases,
    last: IMPORT_FIELDS.lastName.aliases,
    email: IMPORT_FIELDS.email.aliases,
    phone: IMPORT_FIELDS.phone.aliases,
    arrival: IMPORT_FIELDS.arrivalAt.aliases,
    departure: IMPORT_FIELDS.departureAt.aliases,
  },
  family: {
    name: IMPORT_FIELDS.fullName.aliases,
    email: IMPORT_FIELDS.email.aliases,
    years: ["years", "family years", "years attended", "burns", "year"],
    role: ["role", "roles", "what they did"],
  },
  tools: {
    name: ["name", "item", "tool"],
    type: ["type"],
    departments: ["departments", "department"],
    location: ["location"],
    situation: ["situation", "status"],
    qty: ["qty_guess", "qty", "quantity"],
  },
};

interface Out {
  values: Record<string, unknown>;
  changes: string[];
  issues: string[];
  dupKey: string;
  emailKey?: string;
}

function cleanRow(kind: Kind, get: (f: string) => string | undefined, nowYear: number): Out {
  const o: Out = { values: {}, changes: [], issues: [], dupKey: "" };
  const set = (f: string, raw: string | undefined, v: unknown, issue?: string) => {
    if (raw === undefined) return;
    o.values[f] = v;
    if (issue) o.issues.push(issue === "blank" ? `blank_${f}` : issue);
    else if (String(Array.isArray(v) ? v.join(";") : (v ?? "")) !== raw) o.changes.push(f);
  };
  if (kind === "tools") {
    const raw = get("name");
    const { name, qty } = extractQty(raw ?? "");
    set("name", raw, name, name ? undefined : "blank");
    if (qty !== null) o.values.qty = qty;
    if (qty !== null && !tidy(get("qty"))) o.changes.push("qty");
    o.dupKey = name;
    const dep = get("departments");
    if (dep !== undefined) {
      const parts = splitList(dep);
      o.values.departments = parts;
      if (!parts.length) o.issues.push("blank_departments");
      else if (parts.length > 1 || parts[0] !== dep) o.changes.push("departments");
    }
    for (const f of ["type", "location"]) {
      const r = get(f);
      set(f, r, tidy(r), r !== undefined && !tidy(r) ? "blank" : undefined);
    }
    const sit = get("situation");
    if (sit !== undefined) {
      const s = splitStatus(sit);
      o.values.status = s.status;
      if (s.person) o.values.responsible = s.person;
      if (s.issue) o.issues.push(s.issue);
      else if (s.person) o.issues.push("person_in_status");
      else if (!s.status) o.issues.push("blank_status");
      else if (s.status !== sit) o.changes.push("situation");
    }
    return o;
  }
  const first = get("first");
  const rawName =
    get("name") ?? (first !== undefined ? `${first} ${get("last") ?? ""}` : undefined);
  const name = titleCase(rawName ?? "");
  set("name", rawName, name, rawName !== undefined && !name ? "blank" : undefined);
  o.dupKey = name;
  const e = get("email");
  if (e !== undefined) {
    const r = normEmail(e);
    set("email", e, r.value, r.issue);
    o.emailKey = r.value ?? undefined;
  }
  if (kind === "family") {
    const y = get("years");
    if (y !== undefined) {
      const r = normYears(y, nowYear);
      set("years", y, r.value, r.issue);
    }
    const role = get("role");
    if (role !== undefined && tidy(role)) set("role", role, tidy(role));
    return o;
  }
  const p = get("phone");
  if (p !== undefined && tidy(p)) {
    const r = normPhone(p);
    set("phone", p, r.value, r.issue);
  }
  for (const f of ["arrival", "departure"]) {
    const d = get(f);
    if (d !== undefined && tidy(d)) {
      const r = normDate(d);
      set(f, d, r.value, r.issue);
      if (r.issue === "ambiguous_date" && r.value && r.value !== d) o.changes.push(f);
    }
  }
  return o;
}

export interface RowDetail {
  raw: Record<string, string>;
  cleaned: Record<string, unknown>;
  duplicateOfLine: number | null;
}

/** Dry run over a whole CSV file. Nothing is saved; the report holds counts, codes and labels only. */
export function cleanFile(kind: Kind, csv: string, opts: { now?: Date } = {}): CleanReport {
  return analyseFile(kind, csv, opts).report;
}

/** The report plus each row's raw and cleaned values, for the admin-only review screen. */
export function analyseFile(
  kind: Kind,
  csv: string,
  opts: { now?: Date } = {},
): { report: CleanReport; details: RowDetail[] } {
  const [headers = [], ...data] = parseCsv(csv);
  const lc = headers.map((h) => tidy(h).toLowerCase());
  const col: Record<string, number> = {};
  for (const [f, al] of Object.entries(ALIASES[kind])) {
    const i = lc.findIndex((h) => al.includes(h));
    if (i >= 0) col[f] = i;
  }
  const warnings: string[] = [];
  if (
    kind !== "tools" &&
    col.name === undefined &&
    col.first === undefined &&
    col.email === undefined
  )
    warnings.push("no name or email column found");
  const nowYear = (opts.now ?? new Date()).getUTCFullYear();
  const outs = data.map((r) =>
    cleanRow(kind, (f) => (col[f] === undefined ? undefined : (r[col[f]] ?? "")), nowYear),
  );
  const byName = findDuplicates(outs.map((o) => o.dupKey));
  const byEmail = findDuplicates(outs.map((o) => o.emailKey ?? ""));
  const counts = { rows: outs.length, ok: 0, cleaned: 0, needs_review: 0, duplicate: 0 };
  const issues: Record<string, number> = {};
  const details: RowDetail[] = [];
  const rows = outs.map((o, i): CleanRow => {
    const dup = byEmail.get(i)?.kind === "exact" ? byEmail.get(i) : byName.get(i);
    const r = data[i] ?? [];
    details.push({
      raw: Object.fromEntries(headers.map((h, j) => [tidy(h).toLowerCase(), r[j] ?? ""])),
      cleaned: o.values,
      duplicateOfLine: dup ? dup.of + 2 : null,
    });
    if (dup) o.issues.unshift(`${dup.kind}_duplicate`);
    const serious = o.issues.some((x) => !x.startsWith("blank_"));
    const label: Label = dup
      ? "duplicate"
      : serious
        ? "needs_review"
        : o.changes.length
          ? "cleaned"
          : "ok";
    counts[label]++;
    for (const x of o.issues) issues[x] = (issues[x] ?? 0) + 1;
    return { line: i + 2, label, changes: o.changes, issues: o.issues };
  });
  return { report: { kind, headers, counts, issues, rows, warnings }, details };
}
