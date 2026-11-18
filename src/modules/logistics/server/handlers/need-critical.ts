import type { EventHandler } from "@/base/api";
import type { EventPayload } from "@/contracts/events";
import { logisticsLoadItems as loadItems } from "../../schema";

/**
 * Procurement marked a need critical: add it as an unassigned critical load item so it shows as
 * a gap until it's on a load with a destination (L8). Idempotent: one row per event id.
 */
const handler: EventHandler = async (ctx, event) => {
  const p = event.payload as EventPayload<"procurement.need.marked_critical">;
  const rows = await ctx.tx
    .insert(loadItems)
    .values({
      editionId: p.editionId,
      sourceRefType: "procurement.need",
      sourceRefId: p.needId,
      sourceEventId: event.id,
      description: p.itemName,
      quantity: p.quantity,
      unit: p.unit.slice(0, 16),
      isCritical: true,
      neededBy: p.neededBy,
    })
    .onConflictDoNothing({ target: loadItems.sourceEventId })
    .returning({ id: loadItems.id, description: loadItems.description });
  const row = rows[0];
  if (!row) return;
  await ctx.audit.record({
    action: "logistics.item.added_from_need",
    entity: { type: "logistics.load_item", id: row.id },
    changes: { description: [null, row.description], sourceRefId: [null, p.needId] },
    significance: "significant",
  });
};
export default handler;
