import { z } from "zod";

// Payloads for events the `finance` module emits. Types + zod only, no logic.
export const financeEvents = {
  "finance.spend.decided": z.object({
    v: z.literal(1),
    spendRequestId: z.string().uuid(),
    refCode: z.string(),
    decision: z.enum(["approved", "rejected"]),
    editionId: z.string().uuid(),
    /** What asked for the money, when another module did (e.g. a procurement need). Optional, v1. */
    source: z.object({ refType: z.string().max(40), refId: z.string().uuid() }).optional(),
  }),
  /** A camp fee is due for someone (applicants spec §6). `source` is what asked for it. */
  "finance.fee.created": z.object({
    v: z.literal(1),
    feeId: z.string().uuid(),
    personId: z.string().uuid(),
    editionId: z.string().uuid(),
    amountCents: z.number().int().positive(),
    currency: z.string().length(3),
    source: z.object({ refType: z.string().max(40), refId: z.string().uuid() }),
  }),
  /** Finance recorded that a camp fee was paid (demo: no real money moves). */
  "finance.fee.paid": z.object({
    v: z.literal(1),
    feeId: z.string().uuid(),
    personId: z.string().uuid(),
    editionId: z.string().uuid(),
    paidAt: z.string(),
    source: z.object({ refType: z.string().max(40), refId: z.string().uuid() }),
  }),
} as const;
