import { type Actor, definePermissions } from "@/base/api";

export const registersPermissions = definePermissions("registers", {
  /** See the registers (everyone on site needs to know where fuel and fire are). */
  "registers.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** Add and remove lines, and count stakes pulled (team leads, safety roles, camp lead, admin). */
  "registers.manage": (a: Actor) =>
    a.isAdmin ||
    (a.isConfirmedMember &&
      (a.isAnyTeamLead ||
        a.hasRole("camp_lead") ||
        a.hasRole("fire_safety_officer") ||
        a.hasRole("lnt_lead") ||
        a.hasRole("safety_officer"))),
});
