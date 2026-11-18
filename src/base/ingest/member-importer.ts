// Members batches (stage d/e): approved rows go through the existing member importer, so its
// email matching and duplicate rules apply; new people are stamped with import_batch_id.
// Undo removes only stamped people with nothing else pointing at them.
import { eq, sql } from "drizzle-orm";
import type { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import { applyImport } from "../people/import/import";
import { guessMapping, type ImportField } from "../people/import/mapping";
import { editionMembers, people } from "../schema";
import type { ApprovedRow, BatchImporter } from "./batches";
import { tidy } from "./clean";

const CLEANER_FIELD: Partial<Record<ImportField, string>> = {
  fullName: "name",
  firstName: "first",
  lastName: "last",
  email: "email",
  phone: "phone",
  arrivalAt: "arrival",
  departureAt: "departure",
};

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/** Rebuild a CSV from the batch: the sheet's own values, with the admin's fixes on top. */
export function batchCsv(
  headers: string[],
  rows: { raw: Record<string, string>; fix: Record<string, unknown> }[],
) {
  const mapping = guessMapping(headers);
  const lines = rows.map((r) =>
    headers
      .map((h, i) => {
        const key = tidy(h).toLowerCase();
        const field = mapping[i];
        const cleanerKey = field ? CLEANER_FIELD[field] : undefined;
        const fixed = r.fix[key] ?? (cleanerKey ? r.fix[cleanerKey] : undefined);
        return cell(typeof fixed === "string" ? fixed : (r.raw[key] ?? ""));
      })
      .join(","),
  );
  return [headers.map(cell).join(","), ...lines].join("\n");
}

/** Any row in another table that points at this record (via a foreign key), except `skip`. */
async function attached(db: DbOrTx, table: string, id: string, skip: string[]): Promise<boolean> {
  const fks = await db.execute<{ t: string; c: string }>(sql`
    select cl.relname as t, a.attname as c
    from pg_constraint k
    join pg_class cl on cl.oid = k.conrelid
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey)
    where k.contype = 'f' and k.confrelid = ${table}::regclass`);
  for (const fk of fks) {
    if (skip.includes(fk.t)) continue;
    const hit = await db.execute(
      sql`select 1 from ${sql.identifier(fk.t)} where ${sql.identifier(fk.c)} = ${id} limit 1`,
    );
    if (hit.length) return true;
  }
  return false;
}

export function memberImporter(ctx: {
  actor: Actor;
  edition: { id: string; year: number };
  headers: string[];
  rowsByLine: Map<number, { raw: Record<string, string>; fix: Record<string, unknown> }>;
}): BatchImporter {
  return {
    async apply(db, batchId, rows: ApprovedRow[]) {
      const picked = rows.flatMap((r) => {
        const x = ctx.rowsByLine.get(r.line);
        return x ? [x] : [];
      });
      if (!picked.length) return { added: 0, alreadyThere: 0 };
      const res = await applyImport(
        { db, actor: ctx.actor, edition: ctx.edition },
        {
          csv: batchCsv(ctx.headers, picked),
          fileName: `batch ${batchId}`,
          importBatchId: batchId,
        },
      );
      return { added: res.applied.created, alreadyThere: picked.length - res.applied.created };
    },
    async undo(db, batchId) {
      const stamped = await db
        .select({ id: people.id })
        .from(people)
        .where(eq(people.importBatchId, batchId));
      let removed = 0;
      for (const p of stamped) {
        const members = await db
          .select({ id: editionMembers.id })
          .from(editionMembers)
          .where(eq(editionMembers.personId, p.id));
        let busy = await attached(db, "people", p.id, ["edition_members"]);
        for (const m of members) busy ||= await attached(db, "edition_members", m.id, []);
        if (busy) continue;
        await db.delete(editionMembers).where(eq(editionMembers.personId, p.id));
        await db.delete(people).where(eq(people.id, p.id));
        removed++;
      }
      return { removed, keptInUse: stamped.length - removed };
    },
  };
}
