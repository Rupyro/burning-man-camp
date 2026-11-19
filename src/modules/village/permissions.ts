import { type Actor, definePermissions } from "@/base/api";

export const villagePermissions = definePermissions("village", {
  /** See what's shared with partner camps. */
  "village.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** Record and settle shares (village liaison, team leads, camp lead, admin). */
  "village.manage": (a: Actor) =>
    a.isAdmin ||
    (a.isConfirmedMember &&
      (a.isAnyTeamLead || a.hasRole("camp_lead") || a.hasRole("village_liaison"))),
});
