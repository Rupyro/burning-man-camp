import { type Actor, definePermissions } from "@/base/api";

const manages = (a: Actor) =>
  a.isAdmin || (a.isConfirmedMember && (a.hasRole("camp_lead") || a.hasRole("sound_officer")));

export const soundPermissions = definePermissions("sound", {
  /** See the sound plan and the neighbor log; log a neighbor's visit. */
  "sound.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** Change the sound plan (sound officer, camp lead, admin). */
  "sound.manage": manages,
});
