import { type Actor, definePermissions } from "@/base/api";

export const schedulePermissions = definePermissions("schedule", {
  /** See the camp's schedule. */
  "schedule.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** Add and remove events; export for the event guide (schedule lead, camp lead, admin). */
  "schedule.manage": (a: Actor) =>
    a.isAdmin || (a.isConfirmedMember && (a.hasRole("camp_lead") || a.hasRole("schedule_lead"))),
});
