import { z } from "zod";

// Payloads for events the `procurement` module emits. Types + zod only, no logic.
export const procurementEvents = {
  "procurement.need.marked_critical": z.object({
    v: z.literal(1),
    needId: z.string().uuid(),
    teamId: z.string().uuid(),
    itemName: z.string(),
    quantity: z.number().positive(),
    unit: z.string(),
    neededBy: z.string().nullable(),
    editionId: z.string().uuid(),
  }),
  "procurement.need.purchase_requested": z.object({
    v: z.literal(1),
    needId: z.string().uuid(),
    teamId: z.string().uuid(),
    itemName: z.string(),
    quantity: z.number().positive(),
    unit: z.string(),
    estimateCents: z.number().int().positive().nullable(),
    requesterPersonId: z.string().uuid(),
    neededBy: z.string().nullable(),
    editionId: z.string().uuid(),
  }),
} as const;
