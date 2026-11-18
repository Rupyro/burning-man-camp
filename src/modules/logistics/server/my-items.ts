import type { MyItemsProvider } from "@/base/api";
import { qtyText } from "../rules/loads";
import { criticalGaps } from "./queries";
import { travelFor } from "./rides";

/**
 * "My stuff": the Logistics team and camp leads get one alert per critical gap; everyone gets seat
 * requests waiting for them as a driver and their agreed rides (spec §6).
 */
export const myLogisticsItems: MyItemsProvider = async (ctx) => {
  const me = ctx.actor.personId;
  if (!me || !ctx.actor.isConfirmedMember) return [];
  const out: Awaited<ReturnType<MyItemsProvider>> = [];
  if (ctx.actor.isMemberOf("logistics") || ctx.actor.hasRole("camp_lead")) {
    for (const g of await criticalGaps(ctx.db, ctx.edition.id))
      out.push({
        id: `logistics:gap:${g.id}`,
        moduleId: "logistics",
        kind: "alert",
        title: `Critical, not on its way: ${g.description} ${qtyText(g.quantity, g.unit)}`,
        urgency: "soon",
        href: "/logistics#gaps",
      });
  }
  const { rides } = await travelFor(ctx.db, ctx.edition.id, me);
  for (const r of rides) {
    if (r.driving && r.status === "proposed")
      out.push({
        id: `logistics:ask:${r.id}`,
        moduleId: "logistics",
        kind: "ride",
        title: `${r.otherName} asked for ${r.seats === 1 ? "a seat" : `${r.seats} seats`}`,
        urgency: "soon",
        href: "/logistics#rides",
      });
    if (r.status === "accepted")
      out.push({
        id: `logistics:ride:${r.id}`,
        moduleId: "logistics",
        kind: "ride",
        title: r.driving ? `Driving ${r.otherName}` : `Riding with ${r.otherName}`,
        urgency: "normal",
        href: "/logistics#rides",
      });
  }
  return out;
};
