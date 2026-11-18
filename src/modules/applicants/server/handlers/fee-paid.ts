import { and, eq, isNull } from "drizzle-orm";
import type { EventHandler } from "@/base/api";
import type { EventPayload } from "@/contracts/events";
import { applicantApplications as apps } from "../../schema";
import { joinIfReady } from "../join";

/**
 * Finance recorded the camp fee as paid (spec §6): mark it, then join the applicant if nothing
 * else is missing. Idempotent: a duplicate finds it paid (and maybe joined) and changes nothing.
 */
const handler: EventHandler = async (ctx, event) => {
  const p = event.payload as EventPayload<"finance.fee.paid">;
  if (p.source.refType !== "applicants.application") return;
  const marked = await ctx.tx
    .update(apps)
    .set({ paidAt: new Date(p.paidAt), updatedAt: event.occurredAt })
    .where(and(eq(apps.id, p.source.refId), eq(apps.editionId, p.editionId), isNull(apps.paidAt)))
    .returning({ id: apps.id });
  if (marked.length)
    await ctx.audit.record({
      action: "applicants.application.fee_paid",
      entity: { type: "applicants.application", id: p.source.refId },
      changes: { paidAt: [null, p.paidAt] },
      significance: "significant",
    });
  await joinIfReady(ctx, p.source.refId);
};
export default handler;
