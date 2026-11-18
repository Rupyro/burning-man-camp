"use server";
import { z } from "zod";
import { getDb } from "../../db/client";
import { sessionAction } from "../../guard/module-action";
import { addChecklistItem, removeChecklistItem, tickChecklistItem } from "../checklist";
import { addHelper, claimTask, decideClaim, setClaimMode, withdrawClaim } from "../claims";
import { addComment, deleteComment, unwatchTask, watchTask } from "../comments";
import { addDependency, removeDependency } from "../dependencies";
import { markAllRead, markRead, setMyPreference } from "../notify";
import { createProject } from "../projects";
import { nudgePerson } from "../reminders";
import { createTask, setTaskOwner, updateTask } from "../tasks";

// Task screens' actions. sessionAction resolves the caller on the server; every engine function
// checks its own capability against the record (Forbidden is re-thrown, never swallowed).

type Ctx = Parameters<Parameters<typeof sessionAction>[1]>[0];

async function run<T>(ctx: Ctx, fn: (c: Ctx & { db: ReturnType<typeof getDb> }) => Promise<T>) {
  // Refusals (ValidationError, Forbidden) become { ok: false, error } in sessionAction.
  return { ok: true as const, data: await fn({ ...ctx, db: getDb() }) };
}

const id = z.string().uuid();
const when = z.string().datetime({ offset: true }).nullable().optional();

export const newProject = sessionAction(
  {
    input: z.object({
      teamId: id,
      name: z.string().max(200),
      parentProjectId: id.nullable().optional(),
    }),
  },
  (ctx, i) => run(ctx, (c) => createProject(c, i)),
);

export const newTask = sessionAction(
  {
    input: z.object({
      projectId: id,
      title: z.string().max(200),
      description: z.string().max(8000).nullable().optional(),
      dueAt: when,
      ownerPersonId: id.nullable().optional(),
    }),
  },
  (ctx, i) => run(ctx, (c) => createTask(c, i)),
);

export const editTask = sessionAction(
  { input: z.object({ taskId: id, patch: z.record(z.string(), z.unknown()) }) },
  (ctx, i) => run(ctx, (c) => updateTask(c, i.taskId, i.patch)),
);

export const setOwner = sessionAction(
  { input: z.object({ taskId: id, ownerPersonId: id.nullable() }) },
  (ctx, i) => run(ctx, (c) => setTaskOwner(c, i.taskId, i.ownerPersonId)),
);

export const openForHelpers = sessionAction(
  {
    input: z.object({
      taskId: id,
      claimMode: z.enum(["closed", "open", "open_with_approval"]),
      claimCapacity: z.number().int().nullable(),
    }),
  },
  (ctx, { taskId, ...mode }) => run(ctx, (c) => setClaimMode(c, taskId, mode)),
);

export const claim = sessionAction({ input: z.object({ taskId: id }) }, (ctx, i) =>
  run(ctx, (c) => claimTask(c, i.taskId)),
);

export const decideTaskClaim = sessionAction(
  { input: z.object({ assignmentId: id, approve: z.boolean() }) },
  (ctx, i) => run(ctx, (c) => decideClaim(c, i.assignmentId, i.approve)),
);

export const leaveTask = sessionAction({ input: z.object({ assignmentId: id }) }, (ctx, i) =>
  run(ctx, (c) => withdrawClaim(c, i.assignmentId)),
);

export const addTaskHelper = sessionAction(
  { input: z.object({ taskId: id, personId: id }) },
  (ctx, i) => run(ctx, (c) => addHelper(c, i.taskId, i.personId)),
);

export const linkTasks = sessionAction(
  { input: z.object({ taskId: id, dependsOnTaskId: id, remove: z.boolean() }) },
  (ctx, { remove, ...link }) =>
    run(ctx, async (c) =>
      remove
        ? { changed: (await removeDependency(c, link)).removed }
        : { changed: (await addDependency(c, link)).added },
    ),
);

export const addChecklist = sessionAction(
  { input: z.object({ taskId: id, label: z.string().max(200) }) },
  (ctx, i) => run(ctx, (c) => addChecklistItem(c, i.taskId, i.label)),
);

export const tickChecklist = sessionAction(
  { input: z.object({ itemId: id, done: z.boolean() }) },
  (ctx, i) => run(ctx, (c) => tickChecklistItem(c, i.itemId, i.done)),
);

export const removeChecklist = sessionAction({ input: z.object({ itemId: id }) }, (ctx, i) =>
  run(ctx, (c) => removeChecklistItem(c, i.itemId)),
);

export const comment = sessionAction(
  { input: z.object({ taskId: id, body: z.string().max(4000) }) },
  (ctx, i) => run(ctx, (c) => addComment(c, i.taskId, i.body)),
);

export const removeComment = sessionAction({ input: z.object({ commentId: id }) }, (ctx, i) =>
  run(ctx, (c) => deleteComment(c, i.commentId)),
);

export const watch = sessionAction({ input: z.object({ taskId: id, on: z.boolean() }) }, (ctx, i) =>
  run(ctx, (c) => (i.on ? watchTask(c, i.taskId) : unwatchTask(c, i.taskId))),
);

export const readNotification = sessionAction({ input: z.object({ id }) }, (ctx, i) =>
  run(ctx, (c) => markRead(c, i.id)),
);

export const readAllNotifications = sessionAction({ input: z.object({}) }, (ctx) =>
  run(ctx, (c) => markAllRead(c)),
);

export const saveNotificationPreference = sessionAction(
  {
    input: z.object({
      type: z.string().max(40),
      channel: z.enum(["in_app", "email_immediate", "email_digest", "off"]),
    }),
  },
  (ctx, i) => run(ctx, (c) => setMyPreference(c, i.type, i.channel)),
);

/** Team reminders: nudge one person about their late tasks (one alert, then a 2-day wait). */
export const nudge = sessionAction({ input: z.object({ teamId: id, personId: id }) }, (ctx, i) =>
  run(ctx, (c) => nudgePerson(c, i)),
);
