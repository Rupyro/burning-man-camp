// The camp's event schedule (plan Phase 7, Workshops and Offerings pack): what the camp offers,
// when, and an export for the official event guide. Pure rules, no database.

export const CATEGORIES = ["class", "food", "party", "ritual", "care", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  class: "Class or workshop",
  food: "Food or drink",
  party: "Party or music",
  ritual: "Ritual or ceremony",
  care: "Care or healing",
  other: "Other",
};

export interface Slot {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

/** Pairs of events that overlap in time (same camp space), so the schedule lead can fix them. */
export function clashes(slots: readonly Slot[]): [string, string][] {
  const sorted = [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const out: [string, string][] = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (!a) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (!b || b.startsAt >= a.endsAt) break;
      out.push([a.id, b.id]);
    }
  }
  return out;
}

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

export interface ExportRow {
  title: string;
  description: string;
  category: Category;
  date: string;
  start: string;
  end: string;
  location: string;
}

/**
 * CSV for the event guide submission: one row per event. Check the guide's own form for its
 * current columns before uploading; this keeps the common ones.
 */
export function toCsv(rows: readonly ExportRow[]): string {
  const head = ["Title", "Description", "Category", "Date", "Start", "End", "Location"];
  const lines = rows.map((r) =>
    [r.title, r.description, CATEGORY_LABEL[r.category], r.date, r.start, r.end, r.location]
      .map(cell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n");
}
