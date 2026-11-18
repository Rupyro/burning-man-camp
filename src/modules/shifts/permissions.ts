import { type Actor, definePermissions } from "@/base/api";

const live = (a: Actor) => a.isConfirmedMember && a.personId !== null;
const campLead = (a: Actor) => live(a) && a.hasRole("camp_lead");
const dutiesLead = (a: Actor) =>
  live(a) && a.teams.some((t) => t.teamKey === "duties" && ["lead", "co_lead"].includes(t.role));

export const shiftsPermissions = definePermissions("shifts", {
  /** Open shifts, your own shifts and contribution. */
  "shifts.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** Claim an open shift you qualify for (checked against skills in the action). */
  "shifts.claim": (a: Actor) => live(a),
  /** Duty types, checklists, slots, settings and pre-Burn credit. */
  "shifts.manage": (a: Actor) => dutiesLead(a) || campLead(a),
});
