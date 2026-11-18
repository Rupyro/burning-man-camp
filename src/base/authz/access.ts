import type { AccessRule } from "../registry/types";
import type { Actor } from "./actor";
import { can } from "./permissions";

/** Any one rule is enough. Admins always pass (they see every module). System actors never do. */
export function evaluateAccess(actor: Actor, rules: readonly AccessRule[]): boolean {
  if (actor.isSystem) return false;
  if (actor.isAdmin) return true;
  return rules.some((rule) => {
    if ("everyone" in rule) return actor.isConfirmedMember;
    if ("role" in rule) return actor.hasRole(rule.role);
    if ("anyTeamLead" in rule) return actor.isAnyTeamLead;
    if ("capability" in rule) return can(actor, rule.capability);
    if ("team" in rule) {
      const role = actor.teamRole(rule.team);
      return role !== null && (!rule.teamRoles || rule.teamRoles.includes(role));
    }
    return false;
  });
}

export type ModuleAudience = "everyone" | "pilot" | "admins";

export function audienceAllows(actor: Actor, audience: ModuleAudience): boolean {
  if (actor.isAdmin) return true;
  if (audience === "admins") return false;
  if (audience === "pilot") return actor.hasRole("pilot");
  return true;
}
