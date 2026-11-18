import { and, eq } from "drizzle-orm";
import type { EventHandler } from "@/base/api";
import type { EventPayload } from "@/contracts/events";
import { applicantApplications as apps } from "../../schema";

/**
 * Finance made a camp fee for one of our applications (spec §6): keep the amount and a soft ref
 * so the applicant's to-do can show it. Idempotent: a duplicate delivery writes the same values.
 */
const handler: EventHandler = async (ctx, event) => {
  const p = event.payload as EventPayload<"finance.fee.created">;
  if (p.source.refType !== "applicants.application") return;
  await ctx.tx
    .update(apps)
    .set({
      feeCents: p.amountCents,
      feeCurrency: p.currency,
      feeRefType: "finance.camp_fee",
      feeRefId: p.feeId,
      updatedAt: event.occurredAt,
    })
    .where(and(eq(apps.id, p.source.refId), eq(apps.editionId, p.editionId)));
};
export default handler;
