import { z } from "zod";

// Payloads for events the `applicants` module emits. Types + zod only, no logic.
export const applicantsEvents = {
  /** A lead accepted an applicant after their interview: the camp fee is now due (spec §6). */
  "applicants.application.accepted": z.object({
    v: z.literal(1),
    applicationId: z.string().uuid(),
    personId: z.string().uuid(),
    editionId: z.string().uuid(),
  }),
} as const;
