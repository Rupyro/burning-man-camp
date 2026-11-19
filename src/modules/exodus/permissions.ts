import { type Actor, definePermissions } from "@/base/api";

export const exodusPermissions = definePermissions("exodus", {
  /** See the departure plan and set your own departure. */
  "exodus.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** See everyone's travel notes and the sweep crew gap (camp lead, LNT lead, admin). */
  "exodus.manage": (a: Actor) =>
    a.isAdmin || (a.isConfirmedMember && (a.hasRole("camp_lead") || a.hasRole("lnt_lead"))),
});
