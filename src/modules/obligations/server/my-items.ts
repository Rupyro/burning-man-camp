import type { ModuleContext, MyItemsProvider } from "@/base/api";
import { countNeedingAttention, listObligations } from "./queries";

/**
 * Base tasks already show on the home page, so this adds only a "check the date" nudge for
 * open obligations I own whose date is still TBC (spec §5).
 */
export const myObligations: MyItemsProvider = async (ctx) => {
  const me = ctx.actor.personId;
  if (!me || !ctx.actor.isConfirmedMember) return [];
  const rows = await listObligations(ctx.db, ctx.edition.id);
  return rows
    .filter(
      (r) =>
        r.ownerPersonId === me &&
        !r.dateConfirmed &&
        r.status !== "done" &&
        r.status !== "cancelled",
    )
    .map((r) => ({
      id: `obligations:${r.taskId}:confirm`,
      moduleId: "obligations" as const,
      kind: "deadline" as const,
      title: `Check the ${ctx.edition.year} date: ${r.title}`,
      urgency: "normal" as const,
      href: `/obligations/${r.taskId}`,
    }));
};

export const obligationsBadge = async (ctx: ModuleContext) => {
  const n = await countNeedingAttention(ctx.db, ctx.edition.id, ctx.now);
  return n || null;
};
