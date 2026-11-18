import "server-only";
import { handoverItems, type MyItemsProvider } from "@/base/api";
import { collectKitAutomations } from "./automations";

/** Kit handovers meant for this person (rule 14: unclaimed close to its date → camp lead). */
export const myKitItems: MyItemsProvider = async (ctx) => {
  if (!ctx.actor.personId || !ctx.actor.hasRole("camp_lead")) return [];
  const { handovers } = await collectKitAutomations(ctx);
  return handoverItems("procurement", ctx.actor, handovers);
};
