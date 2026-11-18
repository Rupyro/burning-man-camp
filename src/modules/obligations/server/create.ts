import { and, eq } from "drizzle-orm";
import type { ActionContext, ModuleTasksApi } from "@/base/api";
import { obligationDetails, obligationDocuments } from "../schema";

export const OBLIGATION_KIND = "obligations.obligation";
export const OBLIGATIONS_TEAM = "camp_infra";
export const projectName = (year: number) => `AfrikaBurn obligations ${year}`;

export interface NewObligation {
  key: string;
  title: string;
  description?: string | null;
  authority: (typeof obligationDetails.$inferInsert)["authority"];
  category: (typeof obligationDetails.$inferInsert)["category"];
  dueAt?: Date | null;
  dateConfirmed?: boolean;
  previousYearDate?: string | null;
  sourceUrl?: string | null;
  sourceDocSlug?: string | null;
  requiredDocuments?: string[];
  ownerPersonId?: string | null;
  notes?: string | null;
}

/**
 * One base task (through ctx.tasks, so base permissions + audit apply) plus its detail row.
 * Returns null if this edition already has an obligation with that key (safe to re-run).
 */
export async function createObligation(
  tasksApi: ModuleTasksApi,
  db: ActionContext["tx"] | ActionContext["db"],
  edition: { id: string; year: number },
  o: NewObligation,
): Promise<{ taskId: string } | null> {
  const [existing] = await db
    .select({ taskId: obligationDetails.taskId })
    .from(obligationDetails)
    .where(and(eq(obligationDetails.editionId, edition.id), eq(obligationDetails.key, o.key)));
  if (existing) return null;
  const project = await tasksApi.ensureProject({
    teamKey: OBLIGATIONS_TEAM,
    name: projectName(edition.year),
    kind: "obligations",
    description: "AfrikaBurn and other authority deadlines (Obligations module).",
  });
  const task = await tasksApi.create({
    projectId: project.id,
    title: o.title,
    kind: OBLIGATION_KIND,
    description: o.description ?? null,
    dueAt: o.dueAt ?? null,
    ownerPersonId: o.ownerPersonId ?? null,
  });
  await db.insert(obligationDetails).values({
    taskId: task.id,
    editionId: edition.id,
    key: o.key,
    authority: o.authority,
    category: o.category,
    dateConfirmed: o.dateConfirmed ?? false,
    previousYearDate: o.previousYearDate ?? null,
    sourceUrl: o.sourceUrl ?? null,
    sourceDocSlug: o.sourceDocSlug ?? null,
    notes: o.notes ?? null,
  });
  const docs = [...new Set(o.requiredDocuments ?? [])];
  if (docs.length)
    await db
      .insert(obligationDocuments)
      .values(docs.map((name, position) => ({ taskId: task.id, position, name })));
  return { taskId: task.id };
}
