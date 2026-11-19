import { type Actor, definePermissions } from "@/base/api";

export const mvPermissions = definePermissions("mv", {
  /** See the driver roster and offer to drive. */
  "mv.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** Clear drivers (the DMV contact, camp lead, admin). */
  "mv.manage": (a: Actor) =>
    a.isAdmin || (a.isConfirmedMember && (a.hasRole("mv_dmv_contact") || a.hasRole("camp_lead"))),
});
