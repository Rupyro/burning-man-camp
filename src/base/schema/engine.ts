import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { idColumn, standardColumns } from "./columns";
import { buildAreas, editions, people, teams } from "./core";

// DATA_MODEL.md §3: the shared work engine (docs/specs/b2-task-engine.md).
// Templates, recurrence and search arrive in later B2 slices with their own columns.

export const projectKindEnum = pgEnum("project_kind", [
  "general",
  "build_area",
  "gift_project",
  "procurement",
  "logistics",
  "obligations",
  "content",
  "marketing",
  "knowledge",
  "kitchen",
  "programming",
  "must_fix",
]);
export const seasonPhaseEnum = pgEnum("season_phase", [
  "planning",
  "pre_build",
  "build",
  "event",
  "strike",
  "return",
  "post",
]);
export const projectStatusEnum = pgEnum("project_status", [
  "proposed",
  "active",
  "on_hold",
  "done",
  "cancelled",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);
export const priorityEnum = pgEnum("priority", ["must", "should", "could"]);
export const claimModeEnum = pgEnum("claim_mode", ["closed", "open", "open_with_approval"]);
export const dependencyKindEnum = pgEnum("dependency_kind", ["finish_to_start"]);
export const assignmentSourceEnum = pgEnum("assignment_source", ["assigned", "claimed"]);
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "pending_approval",
  "active",
  "declined",
  "withdrawn",
  "completed",
]);

const person = (name: string) => uuid(name).references(() => people.id, { onDelete: "restrict" });

export const projects = pgTable(
  "projects",
  {
    id: idColumn(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    parentProjectId: uuid("parent_project_id").references((): AnyPgColumn => projects.id, {
      onDelete: "restrict",
    }),
    key: varchar("key", { length: 40 }),
    name: text("name").notNull(),
    kind: projectKindEnum("kind").notNull().default("general"),
    phase: seasonPhaseEnum("phase"),
    leadPersonId: person("lead_person_id"),
    status: projectStatusEnum("status").notNull().default("active"),
    startsOn: date("starts_on"),
    dueOn: date("due_on"),
    description: text("description"),
    carryForward: boolean("carry_forward").notNull().default(false),
    ...standardColumns(),
  },
  (t) => [
    index("projects_edition_team_idx").on(t.editionId, t.teamId),
    index("projects_parent_idx").on(t.parentProjectId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: idColumn(),
    /** Optional build area this task belongs to. */
    buildAreaId: uuid("build_area_id").references(() => buildAreas.id, { onDelete: "set null" }),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "restrict",
    }),
    /** Base kinds `task`, `milestone`; module kinds are namespaced and checked on write. */
    kind: varchar("kind", { length: 40 }).notNull().default("task"),
    sourceRefType: varchar("source_ref_type", { length: 40 }),
    sourceRefId: uuid("source_ref_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("todo"),
    blockedReason: text("blocked_reason"),
    priority: priorityEnum("priority").notNull().default("should"),
    phase: seasonPhaseEnum("phase"),
    ownerPersonId: person("owner_person_id"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    location: text("location"),
    claimMode: claimModeEnum("claim_mode").notNull().default("closed"),
    claimCapacity: smallint("claim_capacity"),
    effortHours: numeric("effort_hours", { precision: 5, scale: 1 }),
    isCritical: boolean("is_critical").notNull().default(false),
    ...standardColumns(),
  },
  (t) => [
    index("tasks_edition_status_due_idx").on(t.editionId, t.status, t.dueAt),
    index("tasks_owner_status_idx").on(t.ownerPersonId, t.status),
    index("tasks_project_idx").on(t.projectId),
    index("tasks_unowned_open_idx")
      .on(t.editionId, t.dueAt)
      .where(sql`${t.ownerPersonId} is null and ${t.status} in ('todo', 'in_progress')`),
    index("tasks_available_idx")
      .on(t.editionId, t.dueAt)
      .where(sql`${t.claimMode} <> 'closed' and ${t.status} = 'todo'`),
    check(
      "tasks_blocked_needs_reason",
      sql`${t.status} <> 'blocked' or coalesce(length(trim(${t.blockedReason})), 0) > 0`,
    ),
  ],
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: idColumn(),
    /** The dependent task (it can start once depends_on is done). */
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    kind: dependencyKindEnum("kind").notNull().default("finish_to_start"),
    lagHours: smallint("lag_hours").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("task_dependencies_pair_uq").on(t.taskId, t.dependsOnTaskId),
    index("task_dependencies_depends_on_idx").on(t.dependsOnTaskId),
    check("task_dependencies_not_self", sql`${t.taskId} <> ${t.dependsOnTaskId}`),
  ],
);

/** Helpers and claims. The owner lives on tasks.owner_person_id. */
export const taskAssignments = pgTable(
  "task_assignments",
  {
    id: idColumn(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "restrict" }),
    personId: person("person_id").notNull(),
    source: assignmentSourceEnum("source").notNull(),
    status: assignmentStatusEnum("status").notNull(),
    decidedByPersonId: person("decided_by_person_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...standardColumns(),
  },
  (t) => [
    uniqueIndex("task_assignments_live_uq")
      .on(t.taskId, t.personId)
      .where(sql`${t.status} in ('pending_approval', 'active')`),
    index("task_assignments_person_status_idx").on(t.personId, t.status),
  ],
);

export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    id: idColumn(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    label: text("label").notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneByPersonId: person("done_by_person_id"),
    ...standardColumns(),
  },
  (t) => [index("task_checklist_items_task_idx").on(t.taskId, t.position)],
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: idColumn(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "restrict" }),
    authorPersonId: person("author_person_id").notNull(),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    ...standardColumns(),
  },
  (t) => [index("task_comments_task_idx").on(t.taskId, t.createdAt)],
);

export const taskWatchers = pgTable(
  "task_watchers",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    personId: person("person_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.personId] })],
);
