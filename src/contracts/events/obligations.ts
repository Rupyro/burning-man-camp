import { z } from "zod";

// Payloads for events the `obligations` module emits. Types + zod only, no logic.
export const obligationsEvents = {
  "obligations.obligation.submitted": z.object({
    v: z.literal(1),
    taskId: z.string().uuid(),
    editionId: z.string().uuid(),
    confirmationRef: z.string().nullable(),
  }),
} as const;
