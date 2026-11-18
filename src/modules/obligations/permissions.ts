import { type Actor, definePermissions } from "@/base/api";

const manages = (a: Actor) => a.isAdmin || (a.isConfirmedMember && a.hasRole("camp_lead"));

export const obligationsPermissions = definePermissions("obligations", {
  "obligations.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** Assign, edit dates/links/documents, confirm a date, reopen (spec §4, decision D2). */
  "obligations.manage": manages,
  /** Mark submitted: the obligation's owner, or a manager (record check). */
  "obligations.submit": (a: Actor, r?: unknown) =>
    manages(a) ||
    (a.isConfirmedMember &&
      a.personId !== null &&
      (r as { ownerPersonId?: string | null } | undefined)?.ownerPersonId === a.personId),
});
