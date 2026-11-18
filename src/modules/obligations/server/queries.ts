import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { editionMembers, people, tasks } from "@/base/api/schema";
import { obligationState } from "../rules/status";
import { obligationDetails, obligationDocuments } from "../schema";

const columns = {
  taskId: tasks.id,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  dueAt: tasks.dueAt,
  ownerPersonId: tasks.ownerPersonId,
  ownerName: people.displayName,
  key: obligationDetails.key,
  authority: obligationDetails.authority,
  category: obligationDetails.category,
  sourceUrl: obligationDetails.sourceUrl,
  dateConfirmed: obligationDetails.dateConfirmed,
  previousYearDate: obligationDetails.previousYearDate,
  documentCount: sql<number>`(select count(*)::int from ${obligationDocuments} where ${obligationDocuments.taskId} = ${obligationDetails.taskId})`,
  submittedAt: obligationDetails.submittedAt,
  confirmationRef: obligationDetails.confirmationRef,
  notes: obligationDetails.notes,
  version: obligationDetails.version,
};

function base(db: ReadOnlyDb, editionId: string) {
  return db
    .select(columns)
    .from(obligationDetails)
    .innerJoin(tasks, eq(tasks.id, obligationDetails.taskId))
    .leftJoin(people, eq(people.id, tasks.ownerPersonId))
    .where(and(eq(obligationDetails.editionId, editionId), isNull(tasks.deletedAt)))
    .$dynamic();
}

export type ObligationRow = Awaited<ReturnType<typeof listObligations>>[number];

/** Every live obligation this edition, unsorted (sort with rules/status sortForBoard). */
export async function listObligations(db: ReadOnlyDb, editionId: string) {
  return base(db, editionId);
}

export async function getObligation(db: ReadOnlyDb, editionId: string, taskId: string) {
  const rows = await db
    .select(columns)
    .from(obligationDetails)
    .innerJoin(tasks, eq(tasks.id, obligationDetails.taskId))
    .leftJoin(people, eq(people.id, tasks.ownerPersonId))
    .where(
      and(
        eq(obligationDetails.editionId, editionId),
        eq(obligationDetails.taskId, taskId),
        isNull(tasks.deletedAt),
      ),
    );
  return rows[0] ?? null;
}

/** Open obligations due within 14 days or late (the tile badge). */
export async function countNeedingAttention(db: ReadOnlyDb, editionId: string, now: Date) {
  const rows = await listObligations(db, editionId);
  return rows.filter((r) => {
    const s = obligationState(r, now);
    return s === "late" || s === "due_soon";
  }).length;
}

/** Owner of an obligation, for the submit record check (null when not an obligation). */
export async function obligationOwner(db: ReadOnlyDb, editionId: string, taskId: string) {
  const row = await getObligation(db, editionId, taskId);
  return row ? { ownerPersonId: row.ownerPersonId } : null;
}

/** Confirmed members this edition, for the manager's owner picker (names only). */
export async function listAssignable(db: ReadOnlyDb, editionId: string) {
  return db
    .select({ id: people.id, name: people.displayName })
    .from(editionMembers)
    .innerJoin(people, eq(people.id, editionMembers.personId))
    .where(
      and(
        eq(editionMembers.editionId, editionId),
        eq(editionMembers.status, "confirmed"),
        isNull(editionMembers.deletedAt),
        isNull(people.deletedAt),
      ),
    )
    .orderBy(asc(people.displayName));
}

/** The documents an obligation needs, in checklist order. */
export async function listDocuments(db: ReadOnlyDb, taskId: string) {
  return db
    .select({
      id: obligationDocuments.id,
      name: obligationDocuments.name,
      status: obligationDocuments.status,
    })
    .from(obligationDocuments)
    .where(eq(obligationDocuments.taskId, taskId))
    .orderBy(asc(obligationDocuments.position));
}
