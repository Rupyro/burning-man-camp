import { and, eq } from "drizzle-orm";
import type { EventHandler } from "@/base/api";
import type { EventPayload } from "@/contracts/events";
import { CAMP_FEE_PLACEHOLDER_CENTS } from "../../rules/fees";
import { financeCampFees as fees } from "../../schema";

const REF = "applicants.application";

/**
 * A lead accepted an applicant (applicants spec §6): the camp fee is now due. Creates one fee per
 * application and announces it. Idempotent: a duplicate delivery re-announces the fee as it stands
 * (and that it's paid, if it is) instead of making a second one.
 */
const handler: EventHandler = async (ctx, event) => {
  const p = event.payload as EventPayload<"applicants.application.accepted">;
  const source = { refType: REF, refId: p.applicationId };
  const inserted = await ctx.tx
    .insert(fees)
    .values({
      editionId: p.editionId,
      personId: p.personId,
      amountCents: CAMP_FEE_PLACEHOLDER_CENTS,
      sourceRefType: REF,
      sourceRefId: p.applicationId,
    })
    .onConflictDoNothing()
    .returning();
  const [fee] = inserted.length
    ? inserted
    : await ctx.tx
        .select()
        .from(fees)
        .where(and(eq(fees.sourceRefType, REF), eq(fees.sourceRefId, p.applicationId)));
  if (!fee) return;
  if (inserted.length)
    await ctx.audit.record({
      action: "finance.fee.created",
      entity: { type: "finance.camp_fee", id: fee.id },
      changes: { amountCents: [null, fee.amountCents], sourceRefId: [null, p.applicationId] },
      significance: "significant",
    });
  const base = {
    v: 1 as const,
    feeId: fee.id,
    personId: fee.personId,
    editionId: fee.editionId,
    source,
  };
  await ctx.events.emit("finance.fee.created", {
    ...base,
    amountCents: fee.amountCents,
    currency: fee.currency,
  });
  if (fee.status === "paid" && fee.paidAt)
    await ctx.events.emit("finance.fee.paid", { ...base, paidAt: fee.paidAt.toISOString() });
};
export default handler;
