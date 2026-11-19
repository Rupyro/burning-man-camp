import { type Actor, definePermissions } from "@/base/api";

export const villagePermissions = definePermissions("village", {
  /** See what's shared with partner camps. */
  "village.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /**
   * Record and settle shares (team leads, camp lead, admin). The pack's village liaison joins once
   * it's a base role key (src/base/registry/types.ts).
   */
  "village.manage": (a: Actor) =>
    a.isAdmin || (a.isConfirmedMember && (a.isAnyTeamLead || a.hasRole("camp_lead"))),
});
