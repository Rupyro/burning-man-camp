import { and, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import type { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import type { EditionRef } from "../editions/current";
import { ForbiddenError, ValidationError } from "../errors";
import { getRegistry } from "../registry/runtime";
import { editionMembers, projects, tasks } from "../schema";
import { RuleError } from "./rules/status";

export interface EngineCtx {
  db: DbOrTx;
  actor: Actor;
  edition: EditionRef;
  now?: Date;
}

export const nowOf = (ctx: EngineCtx) => ctx.now ?? new Date();

export const inTx = <T>(db: DbOrTx, fn: (tx: DbOrTx) => Promise<T>) =>
  "transaction" in db ? db.transaction(fn) : fn(db);

export function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new ValidationError(
      "Invalid input",
      r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  return r.data;
}

/** rules/ throws RuleError (it can't import base errors); callers see a ValidationError. */
export function rule<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof RuleError)
      throw new ValidationError(
        error.message,
        error.path ? [{ path: error.path, message: error.message }] : [],
      );
    throw error;
  }
}

export const BASE_TASK_KINDS = ["task", "milestone"] as const;

/** Base kinds plus every kind a module registered in its manifest (spec T6). */
export function allowedTaskKinds(): Set<string> {
  const kinds = new Set<string>(BASE_TASK_KINDS);
  for (const m of getRegistry().modules) for (const k of m.taskKinds ?? []) kinds.add(k.key);
  return kinds;
}

type KindFlag = "escalateOverdueImmediately" | "ownDueSoonReminders";

function kindsWith(flag: KindFlag): Set<string> {
  const kinds = new Set<string>();
  for (const m of getRegistry().modules)
    for (const k of m.taskKinds ?? []) if (k[flag]) kinds.add(k.key);
  return kinds;
}

/** Module task kinds whose overdue alert goes straight to the camp lead (PLAN.md §4.3). */
export const immediateEscalationKinds = () => kindsWith("escalateOverdueImmediately");

/** Module task kinds whose module job sends its own due-soon reminders (base A1 skips them). */
export const ownDueSoonKinds = () => kindsWith("ownDueSoonReminders");

/** A live project in the current edition, or Forbidden (no hint it exists elsewhere). */
export async function loadProject(db: DbOrTx, edition: EditionRef, projectId: string) {
  const [p] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.editionId, edition.id),
        isNull(projects.deletedAt),
      ),
    );
  if (!p) throw new ForbiddenError();
  return p;
}

/** A live task in the current edition with its owning team, or Forbidden. */
export async function loadTask(db: DbOrTx, edition: EditionRef, taskId: string) {
  const [row] = await db
    .select({ task: tasks, teamId: projects.teamId, projectName: projects.name })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.id, taskId), eq(tasks.editionId, edition.id), isNull(tasks.deletedAt)));
  if (!row) throw new ForbiddenError();
  return row;
}

/** Owners and helpers must be confirmed members this edition. */
export async function assertConfirmedMember(db: DbOrTx, edition: EditionRef, personId: string) {
  const [m] = await db
    .select({ status: editionMembers.status })
    .from(editionMembers)
    .where(
      and(
        eq(editionMembers.editionId, edition.id),
        eq(editionMembers.personId, personId),
        isNull(editionMembers.deletedAt),
      ),
    );
  if (m?.status !== "confirmed")
    throw new ValidationError("That person isn't a confirmed member this year");
}
