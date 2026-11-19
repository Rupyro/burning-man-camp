import type { ReactElement } from "react";
import type { JobResult } from "@/contracts/automations";
import type { Actor } from "../authz/actor";
import type { Db } from "../db/client";

// The module contract (MODULE_RULEBOOK.md §3). Re-exported from @/base/api.
export type {
  HandoverCandidate,
  HandoverTo,
  JobResult,
  ReminderCandidate,
} from "@/contracts/automations";

export type ModuleId =
  | "obligations"
  | "finance"
  | "procurement"
  | "logistics"
  | "shifts"
  | "kitchen"
  | "programming"
  | "content"
  | "exports"
  | "binder"
  | "applicants"
  | "registers";

export type RoleKey =
  | "admin"
  | "camp_lead"
  | "finance_approver"
  | "kitchen_sensitive_viewer"
  | "lnt_lead"
  | "fire_safety_officer"
  | "sound_officer"
  | "safety_officer"
  | "mv_dmv_contact"
  | "information_officer"
  | "pilot";
export type TeamRole = "lead" | "co_lead" | "member";
export type Capability = `${string}.${string}`;

/** Who may see the tile and open the module. Any one match is enough. Admins always match. */
export type AccessRule =
  | { everyone: true }
  | { role: RoleKey }
  | { team: string; teamRoles?: TeamRole[] }
  | { anyTeamLead: true }
  | { capability: Capability };

export interface NavEntry {
  label: string;
  /** Relative to the module route; "" = module home. */
  path: string;
  /** Defaults to the module's access. */
  access?: AccessRule[];
}

export interface MyItem {
  id: string;
  moduleId: ModuleId;
  kind: "shift" | "approval" | "alert" | "ride" | "deadline" | "handover" | "other";
  title: string;
  /** Handovers: why the system stopped ("3 reminders, no reply"). */
  reason?: string;
  dueAt?: Date;
  urgency: "normal" | "soon" | "overdue";
  href: string;
}

/**
 * Read-only by convention in B0 (modules use it for their own queries).
 * TODO(B2): back it with a read-only Postgres role.
 */
export type ReadOnlyDb = Db;

export interface ModuleContext {
  actor: Actor;
  edition: { id: string; year: number };
  now: Date;
  db: ReadOnlyDb;
}

export type MyItemsProvider = (ctx: ModuleContext) => Promise<MyItem[]>;

/** Runs once per daily tick as the system. Reads only; the base delivers what it returns. */
export type JobFn = (ctx: ModuleContext) => Promise<JobResult>;
export interface JobDecl {
  id: `${ModuleId}.${string}`;
  schedule: "every_tick";
  run: () => Promise<{ default: JobFn }>;
}

export type ExtraFilesFn = (
  ctx: ModuleContext,
) => Promise<{ path: string; content: Uint8Array | string }[]>;
export interface ExportHook {
  tables: { name: string; sensitiveColumns?: string[] }[];
  extraFiles?: () => Promise<{ default: ExtraFilesFn }>;
}

export interface BinderContext extends ModuleContext {
  days: Date[];
  contactVisibility: "leads_and_emergency" | "none";
}
export type BinderSectionRenderer = (
  ctx: BinderContext,
) => Promise<{ pdf: ReactElement; html: string }>;
export interface BinderSectionDecl {
  id: `${ModuleId}.${string}`;
  title: string;
  order: number;
  audience: "everyone" | "leads" | "admins";
  render: () => Promise<{ default: BinderSectionRenderer }>;
}

export interface DomainEventEnvelope<P = unknown> {
  id: string;
  name: string;
  version: number;
  payload: P;
  emittedByModule: string;
  editionId: string | null;
  occurredAt: Date;
}

// ActionContext lives in the guard; imported as a type only to avoid a cycle.
export type EventHandler = (
  ctx: import("../guard/context").ActionContext,
  event: DomainEventEnvelope,
) => Promise<void>;

export interface ModuleManifest {
  id: ModuleId;
  name: string;
  description: string;
  /** lucide icon name, e.g. "wallet" */
  icon: string;
  route: `/${string}`;
  tablePrefix: `${string}_`;
  access: AccessRule[];
  permissions: readonly Capability[];
  nav: NavEntry[];
  tile?: { order: number; badge?: (ctx: ModuleContext) => Promise<number | null> };
  myItems?: MyItemsProvider;
  /** Camp years an admin confirmed for this person (lights the years badges in the top row). */
  funYears?: (ctx: ModuleContext) => Promise<number[]>;
  taskKinds?: {
    key: `${ModuleId}.${string}`;
    label: string;
    /** Overdue alerts reach the camp lead on day 1, like milestones (PLAN.md §4.3). */
    escalateOverdueImmediately?: boolean;
    /** The module's own job sends the "coming up" reminders, so base due-soon (A1) skips it. */
    ownDueSoonReminders?: boolean;
  }[];
  notificationTypes?: { key: `${ModuleId}.${string}`; label: string; canMute: boolean }[];
  events?: {
    emits?: readonly string[];
    handles?: Record<string, () => Promise<{ default: EventHandler }>>;
  };
  jobs?: JobDecl[];
  exports?: ExportHook;
  binderSections?: BinderSectionDecl[];
  flag: { defaultEnabled: boolean; pilotOnly?: boolean };
}

/**
 * The task engine as a module sees it (`ctx.tasks`, `ModuleSeedContext.tasks`). Runs the base
 * engine as the acting person in the caller's transaction, so base permissions, audit and
 * notifications apply exactly as for the base screens.
 */
export interface ModuleTasksApi {
  /** Find this edition's live project by team key + name, or create it (needs project.manage). */
  ensureProject(input: {
    teamKey: string;
    name: string;
    kind?: "general" | "obligations";
    description?: string;
  }): Promise<{ id: string; teamId: string }>;
  create(input: {
    projectId: string;
    title: string;
    kind: string;
    description?: string | null;
    dueAt?: Date | null;
    ownerPersonId?: string | null;
    isCritical?: boolean;
    source?: { refType: string; refId: string };
  }): Promise<{ id: string }>;
  update(
    taskId: string,
    patch: {
      title?: string;
      description?: string | null;
      dueAt?: Date | null;
      status?: "todo" | "in_progress" | "blocked" | "done" | "cancelled";
      blockedReason?: string | null;
    },
  ): Promise<{ changed: boolean }>;
  setOwner(taskId: string, ownerPersonId: string | null): Promise<{ changed: boolean }>;
}

/** What a module's seed.ts receives from seed/index.ts (deterministic, fake data only). */
export interface ModuleSeedContext {
  db: Db;
  edition: { id: string; year: number };
  /** Demo accounts created by the base seed (the applicant personas once they exist). */
  people: {
    admin: string;
    lead: string;
    member: string;
    applicant?: string;
    new_applicant?: string;
  };
  /** Emit a domain event as the system (the seed dispatches them after every module seeded). */
  events?: { emit(name: string, payload: unknown): Promise<string> };
  /** The task engine acting as the seed admin (create tasks through the base, never directly). */
  tasks: ModuleTasksApi;
}
