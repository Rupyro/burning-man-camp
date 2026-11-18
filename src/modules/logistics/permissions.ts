import { type Actor, definePermissions } from "@/base/api";

const live = (a: Actor) => a.isConfirmedMember && a.personId !== null;
const campLead = (a: Actor) => live(a) && a.hasRole("camp_lead");
/** On the Logistics team (any role), by team key. */
const logisticsTeam = (a: Actor, roles: string[] = ["lead", "co_lead", "member"]) =>
  live(a) && a.teams.some((t) => t.teamKey === "logistics" && roles.includes(t.role));

export const logisticsPermissions = definePermissions("logistics", {
  /** Your travel, the ride board and loads (read-only). */
  "logistics.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** Your own travel plans (checked against the plan's person in the action). */
  "logistics.travel.edit": (a: Actor) => live(a),
  /** Ask a driver for a seat; drivers answer requests on their own offers. */
  "logistics.ride.ask": (a: Actor) => live(a),
  /** Places, vehicles, loads, items, putting gaps on loads (L1). */
  "logistics.loads.manage": (a: Actor) => logisticsTeam(a) || campLead(a),
  /** Confirm a delivery on site (L2). */
  "logistics.delivery.confirm": (a: Actor) =>
    logisticsTeam(a) || campLead(a) || (live(a) && a.isAnyTeamLead),
  /** Arrival manifest and the builders' WAP list, name and email only (L7). */
  "logistics.export": (a: Actor) =>
    logisticsTeam(a, ["lead", "co_lead"]) || campLead(a) || a.isAdmin,
});
