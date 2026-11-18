import { and, eq, notInArray, sql } from "drizzle-orm";
import type { EventHandler } from "@/base/api";
import type { EventPayload } from "@/contracts/events";
import { financeSpendRequests as r } from "../../schema";
import { nextRef } from "../next-ref";
import { budgetOf } from "../queries";

/** Requests in these states are over, so the same need may be asked about again. */
const ENDED = ["rejected", "cancelled", "closed"] as const;

/**
 * Procurement turned a gap into a purchase request (procurement P5): draft a spend request for
 * the person who converted it, with a soft ref back to the need, so they can check the amount and
 * send it. Nothing is submitted for them. Skipped (the need waits in "asked finance" for a lead
 * to handle by hand) when the team has no budget or no estimate was given. Idempotent: while an
 * open request for this need exists, a duplicate delivery or a repeat ask changes nothing.
 */
const handler: EventHandler = async (ctx, event) => {
  const p = event.payload as EventPayload<"procurement.need.purchase_requested">;
  if (!p.estimateCents || p.estimateCents <= 0) return;
  const budget = await budgetOf(ctx.tx, p.editionId, p.teamId);
  if (!budget) return;
  await ctx.tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`finance_src:${p.needId}`}))`);
  const [open] = await ctx.tx
    .select({ id: r.id })
    .from(r)
    .where(
      and(
        eq(r.editionId, p.editionId),
        eq(r.sourceRefType, "procurement.need"),
        eq(r.sourceRefId, p.needId),
        notInArray(r.status, [...ENDED]),
      ),
    );
  if (open) return;

  const { refSeq, refCode } = await nextRef(ctx);
  const title = `Buy ${p.quantity} ${p.unit} ${p.itemName}`.slice(0, 120);
  const [row] = await ctx.tx
    .insert(r)
    .values({
      editionId: p.editionId,
      refSeq,
      refCode,
      budgetId: budget.id,
      teamId: p.teamId,
      requesterPersonId: p.requesterPersonId,
      title,
      justification: "Drafted from a Kit and stock need. Check the amount, then send it.",
      estimatedCents: p.estimateCents,
      neededBy: p.neededBy,
      sourceRefType: "procurement.need",
      sourceRefId: p.needId,
    })
    .returning({ id: r.id });
  await ctx.audit.record({
    action: "finance.spend.drafted_from_need",
    entity: { type: "finance.spend_request", id: row?.id ?? "" },
    changes: {
      refCode: [null, refCode],
      estimatedCents: [null, p.estimateCents],
      sourceRefId: [null, p.needId],
    },
    significance: "significant",
  });
};
export default handler;
