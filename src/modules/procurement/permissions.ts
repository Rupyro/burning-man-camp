import { type Actor, definePermissions } from "@/base/api";

const live = (a: Actor) => a.isConfirmedMember && a.personId !== null;
const campLead = (a: Actor) => live(a) && a.hasRole("camp_lead");
const teamOf = (r?: unknown) => (r as { teamId?: string } | undefined)?.teamId;

export const procurementPermissions = definePermissions("procurement", {
  /** Catalogue, stock and needs (supplier phones need procurement.supplier.contact). */
  "procurement.view": (a: Actor) => a.isConfirmedMember || a.isAdmin,
  /** Update a stock count on site (P2). Every change is logged with who and when. */
  "procurement.stock.count": (a: Actor) => live(a),
  /** Raise a need for a team you're on. */
  "procurement.need.raise": (a: Actor, r?: unknown) => {
    const teamId = teamOf(r);
    return live(a) && teamId !== undefined && a.isMemberOf(teamId);
  },
  /** Status, critical flag, turn into a spend request: the team's leads and camp leads (P5, P6). */
  "procurement.need.manage": (a: Actor, r?: unknown) => {
    const teamId = teamOf(r);
    return teamId !== undefined && live(a) && (a.isLeadOf(teamId) || campLead(a));
  },
  /** Items, locations, suppliers, CSV import (P1). */
  "procurement.catalogue.manage": (a: Actor) =>
    (live(a) && (a.isAnyTeamLead || a.hasRole("camp_lead"))) || a.isAdmin,
  /** "Ask the camp": team leads and camp leads type a request and the app files it. */
  "procurement.ask": (a: Actor) => live(a) && (a.isAnyTeamLead || campLead(a)),
  /** Drafts: team leads and camp leads ask for a vendor email or WhatsApp update. */
  "procurement.draft": (a: Actor) => live(a) && (a.isAnyTeamLead || campLead(a)),
  /** The daily review of what the AI parts did: camp admins. */
  "procurement.review": (a: Actor) => a.isAdmin,
  /** Supplier phone numbers (P3). */
  "procurement.supplier.contact": (a: Actor) =>
    live(a) && (a.isAnyTeamLead || a.hasRole("camp_lead")),
});
