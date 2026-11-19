import { type Actor, definePermissions } from "@/base/api";

export const schedulePermissions = definePermissions("schedule", {
  /** See the camp's schedule. */
  "schedule.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /**
   * Add and remove events; export for the event guide (camp lead, admin). The pack's
   * schedule_lead role joins once it's a base role key (src/base/authz is protected).
   */
  "schedule.manage": (a: Actor) => a.isAdmin || (a.isConfirmedMember && a.hasRole("camp_lead")),
});
