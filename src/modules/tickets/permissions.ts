import { type Actor, definePermissions } from "@/base/api";

export const ticketsPermissions = definePermissions("tickets", {
  /** See and set your own ticket and passes. */
  "tickets.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** See everyone's, and set the camp's allocations (camp leads, admins). */
  "tickets.manage": (a: Actor) => a.isAdmin || (a.isConfirmedMember && a.hasRole("camp_lead")),
});
