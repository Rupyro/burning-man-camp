import type { ImportReport, ReportRow, Resolution } from "@/base/people/import/import";

/** Plain-text pieces of the import screen, kept out of the component so they're testable. */

export function rowSummary(r: ReportRow): string {
  const who = [r.displayName, r.email].filter(Boolean).join(" ");
  const changes = r.changes.length ? ` (changes ${r.changes.join(", ")})` : "";
  const issues = r.issues.length ? ` — ${r.issues.join("; ")}` : "";
  return `Line ${r.line}: ${r.action}${who ? ` ${who}` : ""}${changes}${issues}`;
}

export const rowsToShow = (report: ImportReport) =>
  report.rows.filter((r) => r.action !== "unchanged");

export const needsChoice = (r: ReportRow, resolutions: Record<string, Resolution>) =>
  r.action === "duplicate" || resolutions[r.line] !== undefined;

export function choices(r: ReportRow): { value: string; label: string }[] {
  return [
    { value: JSON.stringify("skip"), label: "Skip this row" },
    { value: JSON.stringify("create"), label: "Create a new person" },
    ...(r.candidates ?? []).map((c) => ({
      value: JSON.stringify({ link: c.personId }),
      label: `Same person as ${c.displayName} (${c.email})`,
    })),
  ];
}

export function readChoice(value: string): Resolution {
  const v: unknown = JSON.parse(value);
  if (v === "create" || v === "skip") return v;
  if (v && typeof v === "object" && "link" in v && typeof v.link === "string")
    return { link: v.link };
  return "skip";
}

export const countsLine = (counts: ImportReport["counts"]) =>
  Object.entries(counts)
    .map(([k, n]) => `${n} ${k}`)
    .join(" · ");

export function resultMessage(data: ImportReport & { applied?: unknown }): string {
  const a = data.applied as { created: number; updated: number; skipped: number } | undefined;
  return a
    ? `Applied: ${a.created} created, ${a.updated} updated, ${a.skipped} skipped.`
    : "Dry run only. Nothing has been saved yet.";
}
