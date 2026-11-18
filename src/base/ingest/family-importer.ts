// Family batches (stage d/e): each approved row's years become past_family_years rows, one per
// email and year, stamped with import_batch_id. People are linked by email when they exist.
// Safe to run twice (unique email + year); undo deletes exactly the stamped rows.
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { pastFamilyYears, people } from "../schema";
import type { ApprovedRow, BatchImporter } from "./batches";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const familyImporter: BatchImporter = {
  async apply(db, batchId, rows: ApprovedRow[]) {
    const emails = [...new Set(rows.map((r) => str(r.values.email).toLowerCase()).filter(Boolean))];
    const found = emails.length
      ? await db
          .select({ id: people.id, email: sql<string>`lower(${people.email})` })
          .from(people)
          .where(and(inArray(sql`lower(${people.email})`, emails), isNull(people.deletedAt)))
      : [];
    const personOf = new Map(found.map((p) => [p.email, p.id]));
    let added = 0;
    let alreadyThere = 0;
    for (const r of rows) {
      const email = str(r.values.email).toLowerCase();
      const years = Array.isArray(r.values.years)
        ? r.values.years.filter((y) => typeof y === "number" && y >= 2023)
        : [];
      for (const year of years as number[]) {
        if (!email) {
          alreadyThere++;
          continue;
        }
        const ins = await db
          .insert(pastFamilyYears)
          .values({
            email,
            year,
            personId: personOf.get(email) ?? null,
            displayName: str(r.values.name) || null,
            role: str(r.values.role) || null,
            importBatchId: batchId,
          })
          .onConflictDoNothing()
          .returning({ id: pastFamilyYears.id });
        if (ins.length) added++;
        else alreadyThere++;
      }
    }
    return { added, alreadyThere };
  },
  async undo(db, batchId) {
    const gone = await db
      .delete(pastFamilyYears)
      .where(eq(pastFamilyYears.importBatchId, batchId))
      .returning({ id: pastFamilyYears.id });
    return { removed: gone.length, keptInUse: 0 };
  },
};

/** Past family years for one person (linked or by their email), for the journey and badges. */
export async function pastFamilyYearsFor(
  db: DbOrTx,
  who: { personId: string | null; email: string | null },
): Promise<number[]> {
  const conds = [
    ...(who.personId ? [eq(pastFamilyYears.personId, who.personId)] : []),
    ...(who.email ? [eq(sql`lower(${pastFamilyYears.email})`, who.email.toLowerCase())] : []),
  ];
  if (!conds.length) return [];
  const rows = await db
    .select({ y: pastFamilyYears.year })
    .from(pastFamilyYears)
    .where(or(...conds));
  return [...new Set(rows.map((r) => r.y))].sort((a, b) => a - b);
}
