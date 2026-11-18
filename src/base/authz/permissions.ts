import { globalSingleton } from "@/lib/global-singleton";
import type { Capability } from "../registry/types";
import type { Actor } from "./actor";

// biome-ignore lint/suspicious/noExplicitAny: each capability declares its own resource shape
export type CapabilityCheck = (actor: Actor, resource?: any) => boolean;

export interface PermissionSet<K extends Capability = Capability> {
  owner: string;
  keys: readonly K[];
  checks: Record<K, CapabilityCheck>;
}

/** Capabilities the base defines; modules may check them but never redefine them. */
export const BASE_CAPABILITIES = [
  "admin.settings",
  "member.view_directory",
  "member.view_contacts",
  "member.view_dietary",
  "member.view_payment",
  "member.edit_profile",
  "member.manage",
  "member.admin_notes",
  "member.import",
  "team.manage",
  "team.manage_members",
  "role.assign",
  "edition.manage",
  "task.edit",
  "task.claim",
  "task.view",
  "task.comment",
  "task.create",
  "task.manage",
  "project.manage",
  "readiness.view",
] as const;

type Store = Map<string, { owner: string; check: CapabilityCheck }>;
const store: Store = globalSingleton<Store>("__campCapabilities", () => new Map());

/**
 * Declare a module's capabilities. Every key must start with "<moduleId>." and
 * is registered so the guard can evaluate it by name.
 */
export function definePermissions<K extends Capability>(
  owner: string,
  checks: Record<K, CapabilityCheck>,
): PermissionSet<K> {
  const keys = Object.keys(checks) as K[];
  for (const key of keys) {
    const isBase = owner === "base";
    if (!isBase && !key.startsWith(`${owner}.`)) {
      throw new Error(`Capability "${key}" must start with "${owner}."`);
    }
    if (!isBase && (BASE_CAPABILITIES as readonly string[]).includes(key)) {
      throw new Error(`Capability "${key}" is a base capability and can't be redefined`);
    }
    const existing = store.get(key);
    if (existing && existing.owner !== owner) {
      throw new Error(`Capability "${key}" is already defined by "${existing.owner}"`);
    }
    store.set(key, { owner, check: checks[key] });
  }
  return { owner, keys, checks };
}

export function isCapabilityDefined(cap: string): boolean {
  return store.has(cap);
}

/** Server-side capability check. Unknown capabilities are denied. Admins pass base capabilities. */
export function can(actor: Actor, cap: Capability, resource?: unknown): boolean {
  const entry = store.get(cap);
  if (!entry) return false;
  try {
    return entry.check(actor, resource) === true;
  } catch {
    return false;
  }
}

/** A person record as the people permissions see it (docs/specs/b1-people-teams-roles.md §3). */
export interface PersonResource {
  personId: string;
  /** Teams the person is on this edition (ids or keys). */
  teamIds?: readonly string[];
  visibility?: "hidden" | "members" | "members_with_contact";
}

const isSelf = (a: Actor, r?: { personId: string }) => r !== undefined && r.personId === a.personId;
const leadsAnyOf = (a: Actor, teamIds?: readonly string[]) =>
  (teamIds ?? []).some((t) => a.isLeadOf(t));
const campLead = (a: Actor) => a.isAdmin || a.hasRole("camp_lead");

/** A task or project as the engine permissions see it (docs/specs/b2-task-engine.md §3). */
export interface TeamResource {
  /** The owning team (id or key). */
  teamId: string;
}
export interface TaskResource extends TeamResource {
  ownerPersonId: string | null;
}
const managesTeam = (a: Actor, r?: TeamResource) =>
  campLead(a) || (r !== undefined && a.isLeadOf(r.teamId));

// Admins pass every base capability. Leading a team is never a camp-wide power.
export const basePermissions = definePermissions("base", {
  "admin.settings": (a) => a.isAdmin,
  "member.view_directory": (a, r?: PersonResource) => {
    if (a.isAdmin) return true;
    if (!a.isConfirmedMember) return false;
    if (r?.visibility !== "hidden") return true;
    return isSelf(a, r) || leadsAnyOf(a, r.teamIds);
  },
  "member.view_contacts": (a, r?: PersonResource) => {
    if (a.isAdmin) return true;
    if (r === undefined) return a.isAnyTeamLead;
    if (isSelf(a, r)) return true;
    if (leadsAnyOf(a, r.teamIds)) return true;
    return r.visibility === "members_with_contact" && a.isConfirmedMember;
  },
  "member.view_dietary": (a, r?: PersonResource) =>
    a.isAdmin || isSelf(a, r) || a.hasRole("kitchen_sensitive_viewer"),
  "member.view_payment": (a, r?: PersonResource) =>
    a.isAdmin || isSelf(a, r) || a.hasRole("finance_approver"),
  "member.edit_profile": (a, r?: PersonResource) =>
    campLead(a) || (isSelf(a, r) && a.memberStatus !== null),
  "member.manage": campLead,
  "member.admin_notes": (a) => a.isAdmin,
  "member.import": (a) => a.isAdmin,
  "team.manage": campLead,
  "team.manage_members": (a, r?: { teamId: string; role?: "lead" | "co_lead" | "member" }) =>
    campLead(a) || (r !== undefined && r.role !== "lead" && a.isLeadOf(r.teamId)),
  "role.assign": (a) => a.isAdmin,
  "edition.manage": campLead,
  // Without a task: any confirmed member (B0). With one: a lead of its team, or its owner.
  "task.edit": (a, r?: TaskResource) => {
    if (r === undefined) return a.isConfirmedMember || a.isAdmin;
    if (managesTeam(a, r)) return true;
    return a.isConfirmedMember && r.ownerPersonId !== null && r.ownerPersonId === a.personId;
  },
  "task.claim": (a) => a.isConfirmedMember,
  "task.view": (a) => a.isConfirmedMember || a.isAdmin,
  "task.comment": (a) => a.isConfirmedMember || a.isAdmin,
  "task.create": (a, r?: TeamResource) =>
    campLead(a) || (r !== undefined && a.isConfirmedMember && a.isMemberOf(r.teamId)),
  "task.manage": managesTeam,
  "project.manage": managesTeam,
  "readiness.view": (a, r?: TeamResource) =>
    campLead(a) || (r === undefined ? a.isAnyTeamLead : a.isLeadOf(r.teamId)),
});
