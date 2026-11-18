import { and, eq } from "drizzle-orm";
import type { EventHandler } from "@/base/api";
import type { EventPayload } from "@/contracts/events";
import { afterSpendDecision } from "../../rules/status";
import { procurementNeeds as needs } from "../../schema";

/**
 * Finance decided a spend request. If it came from one of our needs, approved → "to buy" (with
 * the spend request ref), turned down → back to "needed". Idempotent: a duplicate delivery finds
 * the need already moved and changes nothing.
 */
const handler: EventHandler = async (ctx, event) => {
  const p = event.payload as EventPayload<"finance.spend.decided">;
  if (p.source?.refType !== "procurement.need") return;
  const [row] = await ctx.tx
    .select()
    .from(needs)
    .where(and(eq(needs.id, p.source.refId), eq(needs.editionId, p.editionId)))
    .for("update");
  if (!row) return;
  const next = afterSpendDecision(row.status, p.decision);
  if (!next) return;
  await ctx.tx
    .update(needs)
    .set({
      status: next,
      spendRequestRefId: p.spendRequestId,
      updatedAt: event.occurredAt,
      version: row.version + 1,
    })
    .where(eq(needs.id, row.id));
  await ctx.audit.record({
    action: "procurement.need.spend_decided",
    entity: { type: "procurement.need", id: row.id },
    changes: {
      status: [row.status, next],
      spendRequestRefId: [row.spendRequestRefId, p.spendRequestId],
    },
    significance: "significant",
  });
};
export default handler;
